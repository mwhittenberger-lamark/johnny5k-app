<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\BodyMetricsController;
use Johnny5k\REST\DashboardController;
use Johnny5k\REST\NutritionController;
use Johnny5k\REST\NutritionRecipeController;
use Johnny5k\REST\TrainingController;
use Johnny5k\REST\WorkoutController;
use Johnny5k\Support\TrainingDayTypes;

class AiToolHandlerService {

	/**
	 * @param array<string,callable> $deps
	 */
	public static function execute( int $user_id, string $tool_name, array $arguments = [], array $deps = [] ): array {
		$redirect_tool = sanitize_key( (string) ( $arguments['_redirect_tool'] ?? '' ) );
		if ( '' !== $redirect_tool ) {
			unset( $arguments['_redirect_tool'] );
			if ( 'create_custom_workout' === $redirect_tool ) {
				return self::tool_create_custom_workout( $user_id, $arguments );
			}
		}

		return match ( $tool_name ) {
			'get_profile_summary'        => self::tool_profile_summary( $user_id, $deps ),
			'get_daily_targets'          => self::tool_daily_targets( $user_id ),
			'get_today_nutrition'        => self::tool_today_nutrition( $user_id, $deps ),
			'get_recent_meals'           => self::tool_recent_meals( $user_id, $arguments, $deps ),
			'get_pantry_snapshot'        => self::tool_pantry_snapshot( $user_id, $arguments ),
			'get_recipe_catalog'         => self::tool_recipe_catalog( $user_id, $arguments ),
			'get_recovery_snapshot'      => self::tool_recovery_snapshot( $user_id ),
			'get_current_workout'        => self::tool_current_workout( $user_id, $deps ),
			'log_steps'                  => self::tool_log_steps( $user_id, $arguments, $deps ),
			'log_food_from_description'  => self::tool_log_food_from_description( $user_id, $arguments, $deps ),
			'create_training_plan'       => self::tool_create_training_plan( $user_id, $arguments ),
			'create_custom_workout'      => self::tool_create_custom_workout( $user_id, $arguments ),
			'create_personal_exercise'   => self::tool_create_personal_exercise( $user_id, $arguments ),
			'log_sleep'                  => self::tool_log_sleep( $user_id, $arguments, $deps ),
			'add_pantry_items'           => self::tool_add_pantry_items( $user_id, $arguments, $deps ),
			'add_grocery_gap_items'      => self::tool_add_grocery_gap_items( $user_id, $arguments, $deps ),
			'swap_workout_exercise'      => self::tool_swap_workout_exercise( $user_id, $arguments, $deps ),
			'schedule_sms_reminder'      => self::tool_schedule_sms_reminder( $user_id, $arguments, $deps ),
			default                      => [ 'error' => 'Tool not available.' ],
		};
	}

	/**
	 * @param array<string,callable> $deps
	 * @return mixed
	 */
	private static function dep( array $deps, string $name, mixed ...$args ): mixed {
		$callable = $deps[ $name ] ?? null;
		if ( ! is_callable( $callable ) ) {
			throw new \RuntimeException( 'Missing AI tool dependency: ' . $name );
		}

		return $callable( ...$args );
	}

	private static function nutrition_log_meal( array $deps, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps['nutrition_log_meal'] ?? null;
		if ( is_callable( $callable ) ) {
			$response = $callable( $request );
			if ( $response instanceof \WP_REST_Response ) {
				return $response;
			}
		}

		return NutritionController::log_meal( $request );
	}

	private static function nutrition_add_pantry_items_bulk( array $deps, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps['nutrition_add_pantry_items_bulk'] ?? null;
		if ( is_callable( $callable ) ) {
			$response = $callable( $request );
			if ( $response instanceof \WP_REST_Response ) {
				return $response;
			}
		}

		return NutritionController::add_pantry_items_bulk( $request );
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_profile_summary( int $user_id, array $deps ): array {
		$result = self::dep( $deps, 'profile_summary', $user_id );
		return is_array( $result ) ? $result : [];
	}

	private static function tool_daily_targets( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_steps, target_sleep_hours, goal_type
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		return [
			'target_calories'    => (int) ( $goal->target_calories ?? 0 ),
			'target_protein_g'   => (int) ( $goal->target_protein_g ?? 0 ),
			'target_carbs_g'     => (int) ( $goal->target_carbs_g ?? 0 ),
			'target_fat_g'       => (int) ( $goal->target_fat_g ?? 0 ),
			'target_steps'       => (int) ( $goal->target_steps ?? 0 ),
			'target_sleep_hours' => (float) ( $goal->target_sleep_hours ?? 0 ),
			'goal_type'          => (string) ( $goal->goal_type ?? '' ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_today_nutrition( int $user_id, array $deps ): array {
		$today        = UserTime::today( $user_id );
		$meal_payload = self::dep( $deps, 'meal_breakdown_for_date', $user_id, $today, '', 12 );
		$totals       = is_array( $meal_payload['totals'] ?? null ) ? $meal_payload['totals'] : [];
		$entries      = is_array( $meal_payload['entries'] ?? null ) ? $meal_payload['entries'] : [];
		$meal_types   = array_values( array_unique( array_values( array_filter( array_map( static fn( array $entry ): string => (string) ( $entry['meal_type'] ?? '' ), $entries ) ) ) ) );
		$dinner_entries = array_values( array_filter( $entries, static fn( array $entry ): bool => 'dinner' === ( $entry['meal_type'] ?? '' ) ) );
		$latest_dinner = ! empty( $dinner_entries ) ? end( $dinner_entries ) : null;

		return [
			'date'              => $today,
			'calories'          => (int) ( $totals['calories'] ?? 0 ),
			'protein_g'         => (float) ( $totals['protein_g'] ?? 0 ),
			'carbs_g'           => (float) ( $totals['carbs_g'] ?? 0 ),
			'fat_g'             => (float) ( $totals['fat_g'] ?? 0 ),
			'meal_count'        => count( $entries ),
			'meal_type_count'   => count( $meal_types ),
			'meal_types_logged' => $meal_types,
			'meals'             => $entries,
			'latest_dinner'     => is_array( $latest_dinner ) ? $latest_dinner : null,
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_recent_meals( int $user_id, array $arguments, array $deps ): array {
		$date      = (string) self::dep( $deps, 'normalise_tool_date', $user_id, (string) ( $arguments['date'] ?? '' ) );
		$limit     = max( 1, min( 12, (int) ( $arguments['limit'] ?? 12 ) ) );
		$meal_type = self::sanitize_meal_type_value( (string) ( $arguments['meal_type'] ?? '' ), false );
		$payload   = self::dep( $deps, 'meal_breakdown_for_date', $user_id, $date, $meal_type, $limit );

		return [
			'date'       => $date,
			'meal_type'  => $meal_type,
			'totals'     => $payload['totals'] ?? [],
			'meals'      => $payload['entries'] ?? [],
			'meal_count' => count( is_array( $payload['entries'] ?? null ) ? $payload['entries'] : [] ),
		];
	}

	private static function tool_pantry_snapshot( int $user_id, array $arguments = [] ): array {
		global $wpdb;
		$p     = $wpdb->prefix;
		$limit = max( 1, min( 24, (int) ( $arguments['limit'] ?? 24 ) ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, item_name, quantity, unit, expires_on, category_override, updated_at
			 FROM {$p}fit_pantry_items
			 WHERE user_id = %d
			 ORDER BY updated_at DESC, id DESC
			 LIMIT %d",
			$user_id,
			$limit
		), ARRAY_A );

		$total_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_pantry_items WHERE user_id = %d",
			$user_id
		) );

		$items = array_map( static function( array $row ): array {
			return [
				'id'         => (int) ( $row['id'] ?? 0 ),
				'item_name'  => sanitize_text_field( (string) ( $row['item_name'] ?? '' ) ),
				'quantity'   => isset( $row['quantity'] ) ? (float) $row['quantity'] : null,
				'unit'       => sanitize_text_field( (string) ( $row['unit'] ?? '' ) ),
				'expires_on' => sanitize_text_field( (string) ( $row['expires_on'] ?? '' ) ),
				'category'   => sanitize_key( (string) ( $row['category_override'] ?? '' ) ),
				'updated_at' => sanitize_text_field( (string) ( $row['updated_at'] ?? '' ) ),
			];
		}, is_array( $rows ) ? $rows : [] );

		return [
			'total_count' => $total_count,
			'items'       => $items,
		];
	}

	private static function tool_recipe_catalog( int $user_id, array $arguments = [] ): array {
		$limit           = max( 1, min( 12, (int) ( $arguments['limit'] ?? 12 ) ) );
		$meal_type       = self::sanitize_meal_type_value( (string) ( $arguments['meal_type'] ?? '' ), false );
		$minimum_protein = isset( $arguments['minimum_protein_g'] ) ? max( 0, (float) $arguments['minimum_protein_g'] ) : 0;

		$request  = new \WP_REST_Request( 'GET', '/fit/v1/nutrition/recipes' );
		$response = NutritionRecipeController::get_recipe_suggestions( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 || ! is_array( $data ) ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not load recipes.' ) ];
		}

		$recipes = array_values( array_filter( array_map( static function( $recipe ) {
			$payload = is_array( $recipe ) ? $recipe : (array) $recipe;
			return [
				'recipe_name'          => sanitize_text_field( (string) ( $payload['recipe_name'] ?? '' ) ),
				'meal_type'            => sanitize_key( (string) ( $payload['meal_type'] ?? '' ) ),
				'estimated_calories'   => (int) ( $payload['estimated_calories'] ?? 0 ),
				'estimated_protein_g'  => (float) ( $payload['estimated_protein_g'] ?? 0 ),
				'estimated_carbs_g'    => (float) ( $payload['estimated_carbs_g'] ?? 0 ),
				'estimated_fat_g'      => (float) ( $payload['estimated_fat_g'] ?? 0 ),
				'on_hand_ingredients'  => self::sanitize_string_list( is_array( $payload['on_hand_ingredients'] ?? null ) ? $payload['on_hand_ingredients'] : [] ),
				'missing_ingredients'  => self::sanitize_string_list( is_array( $payload['missing_ingredients'] ?? null ) ? $payload['missing_ingredients'] : [] ),
				'pantry_match_count'   => (int) ( $payload['pantry_match_count'] ?? 0 ),
				'pantry_missing_count' => (int) ( $payload['pantry_missing_count'] ?? 0 ),
			];
		}, $data ), static function( array $recipe ) use ( $meal_type, $minimum_protein ): bool {
			if ( '' !== $meal_type && $meal_type !== ( $recipe['meal_type'] ?? '' ) ) {
				return false;
			}

			return (float) ( $recipe['estimated_protein_g'] ?? 0 ) >= $minimum_protein;
		} ) );

		usort( $recipes, static function( array $left, array $right ): int {
			$protein_compare = (float) ( $right['estimated_protein_g'] ?? 0 ) <=> (float) ( $left['estimated_protein_g'] ?? 0 );
			if ( 0 !== $protein_compare ) {
				return $protein_compare;
			}

			return (int) ( $right['pantry_match_count'] ?? 0 ) <=> (int) ( $left['pantry_match_count'] ?? 0 );
		} );

		return [
			'meal_type'         => $meal_type,
			'minimum_protein_g' => $minimum_protein,
			'recipe_count'      => count( $recipes ),
			'recipes'           => array_slice( $recipes, 0, $limit ),
		];
	}

	private static function tool_recovery_snapshot( int $user_id ): array {
		global $wpdb;
		$p         = $wpdb->prefix;
		$today     = UserTime::today( $user_id );
		$yesterday = UserTime::yesterday( $user_id );

		$sleep = $wpdb->get_row( $wpdb->prepare(
			"SELECT hours_sleep, sleep_quality FROM {$p}fit_sleep_logs WHERE user_id = %d AND sleep_date = %s LIMIT 1",
			$user_id,
			$yesterday
		) );
		$steps = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT steps FROM {$p}fit_step_logs WHERE user_id = %d AND step_date = %s LIMIT 1",
			$user_id,
			$today
		) );
		$latest_weight = $wpdb->get_row( $wpdb->prepare(
			"SELECT weight_lb, metric_date FROM {$p}fit_body_metrics WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );
		$recent_cardio = $wpdb->get_results( $wpdb->prepare(
			"SELECT cardio_date, cardio_type, duration_minutes
			 FROM {$p}fit_cardio_logs WHERE user_id = %d ORDER BY cardio_date DESC LIMIT 3",
			$user_id
		) );

		return [
			'steps_today'      => $steps,
			'sleep_last_night' => [
				'hours_sleep'   => (float) ( $sleep->hours_sleep ?? 0 ),
				'sleep_quality' => (string) ( $sleep->sleep_quality ?? '' ),
			],
			'latest_weight'    => [
				'weight_lb'   => isset( $latest_weight->weight_lb ) ? (float) $latest_weight->weight_lb : null,
				'metric_date' => $latest_weight->metric_date ?? null,
			],
			'recent_cardio'    => array_map( static function( object $row ): array {
				return [
					'cardio_date'      => $row->cardio_date,
					'cardio_type'      => $row->cardio_type,
					'duration_minutes' => (int) $row->duration_minutes,
				];
			}, $recent_cardio ?: [] ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_current_workout( int $user_id, array $deps ): array {
		$workout = self::dep( $deps, 'current_workout_payload' );
		if ( ! empty( $workout['error'] ) ) {
			return [ 'error' => $workout['error'] ];
		}

		$active_session    = is_array( $workout['session'] ?? null ) ? $workout['session'] : [];
		$active_exercises  = is_array( $workout['exercises'] ?? null ) ? $workout['exercises'] : [];
		$today_payload     = self::dep( $deps, 'latest_workout_session_for_date', $user_id, UserTime::today( $user_id ) );
		$today_session     = is_array( $today_payload['session'] ?? null ) ? $today_payload['session'] : $active_session;
		$today_exercises   = is_array( $today_payload['exercises'] ?? null ) ? $today_payload['exercises'] : $active_exercises;
		$last_completed    = self::dep( $deps, 'latest_completed_workout_session', $user_id );
		$snapshot          = DashboardController::get_daily_snapshot_data( $user_id );
		$training_status   = is_array( $snapshot['training_status'] ?? null ) ? $snapshot['training_status'] : [];
		$today_norm        = self::dep( $deps, 'normalise_tool_session_summary', $today_session );
		$last_completed_norm = self::dep( $deps, 'normalise_tool_session_summary', is_array( $last_completed['session'] ?? null ) ? $last_completed['session'] : [] );
		$today_exercise_norm = array_map( fn( array $exercise ): array => self::dep( $deps, 'normalise_tool_exercise_summary', $exercise ), $today_exercises );
		$last_completed_exercise_norm = array_map( fn( array $exercise ): array => self::dep( $deps, 'normalise_tool_exercise_summary', $exercise ), is_array( $last_completed['exercises'] ?? null ) ? $last_completed['exercises'] : [] );

		return [
			'session'                   => $active_session,
			'session_mode'              => (string) ( $workout['session_mode'] ?? 'normal' ),
			'exercises'                 => $active_exercises,
			'has_active_session'        => ! empty( $active_session['id'] ),
			'completed_today'           => ! empty( $today_session['completed'] ),
			'today_status'              => (string) ( $training_status['status'] ?? ( ! empty( $active_session['id'] ) ? 'active' : ( ! empty( $today_session['completed'] ) ? 'completed' : ( ! empty( $today_session['id'] ) ? 'scheduled' : 'none' ) ) ) ),
			'scheduled_day_type'        => (string) ( $training_status['scheduled_day_type'] ?? '' ),
			'today_recorded_for_schedule' => ! empty( $training_status['recorded'] ),
			'today_recorded_type'       => (string) ( $training_status['recorded_type'] ?? '' ),
			'today_training_status'     => $training_status,
			'today_session'             => $today_norm,
			'today_exercises'           => $today_exercise_norm,
			'last_completed_session'    => $last_completed_norm,
			'last_completed_exercises'  => $last_completed_exercise_norm,
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_log_steps( int $user_id, array $arguments, array $deps ): array {
		$steps = isset( $arguments['steps'] ) ? (int) $arguments['steps'] : -1;
		if ( $steps < 0 ) {
			return [ 'error' => 'A non-negative step count is required.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/body/steps' );
		$request->set_param( 'steps', $steps );

		$date = (string) self::dep( $deps, 'normalise_tool_date', $user_id, (string) ( $arguments['date'] ?? '' ) );
		if ( '' !== $date ) {
			$request->set_param( 'date', $date );
		}

		$response = BodyMetricsController::log_steps( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not log steps.' ) ];
		}

		$date_logged      = (string) ( $data['date'] ?? UserTime::today( $user_id ) );
		$date_display     = (string) self::dep( $deps, 'format_tool_display_date', $user_id, $date_logged );
		$targets          = self::dep( $deps, 'active_goal_targets', $user_id );
		$target_steps     = (int) ( $targets['target_steps'] ?? 0 );
		$steps_logged     = (int) ( $data['steps'] ?? $steps );
		$remaining_steps  = max( 0, $target_steps - $steps_logged );
		$coach_note       = $target_steps > 0
			? sprintf( 'That puts you at %s of %s steps. %s', number_format_i18n( $steps_logged ), number_format_i18n( $target_steps ), $remaining_steps > 0 ? sprintf( '%s left to close the target.', number_format_i18n( $remaining_steps ) ) : 'Step target closed for the day.' )
			: 'Step target updated for the day.';

		return [
			'ok'              => true,
			'action'          => 'log_steps',
			'date'            => $date_logged,
			'date_display'    => $date_display,
			'steps'           => $steps_logged,
			'target_steps'    => $target_steps,
			'remaining_steps' => $remaining_steps,
			'coach_note'      => $coach_note,
			'summary'         => sprintf( 'Logged %s steps for %s. %s', number_format_i18n( $steps_logged ), $date_display, $coach_note ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_log_food_from_description( int $user_id, array $arguments, array $deps ): array {
		$food_text = trim( (string) ( $arguments['food_text'] ?? '' ) );
		if ( '' === $food_text ) {
			return [ 'error' => 'A food description is required.' ];
		}

		$analysis = self::dep( $deps, 'analyse_food_text', $user_id, $food_text );
		if ( is_wp_error( $analysis ) ) {
			return [ 'error' => $analysis->get_error_message() ];
		}

		$meal_type = sanitize_key( (string) ( $arguments['meal_type'] ?? 'lunch' ) );
		if ( ! in_array( $meal_type, [ 'breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'shake' ], true ) ) {
			$meal_type = 'lunch';
		}

		$meal_datetime = (string) self::dep( $deps, 'normalise_tool_datetime', $user_id, (string) ( $arguments['meal_datetime'] ?? '' ) );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/meal' );
		$request->set_param( 'meal_type', $meal_type );
		$request->set_param( 'source', 'ai' );
		$request->set_param( 'meal_datetime', $meal_datetime );
		$request->set_param( 'items', [ [
			'food_name'      => (string) ( $analysis['food_name'] ?? 'Food item' ),
			'serving_amount' => 1,
			'serving_unit'   => (string) ( $analysis['serving_size'] ?? 'serving' ),
			'calories'       => (int) ( $analysis['calories'] ?? 0 ),
			'protein_g'      => (float) ( $analysis['protein_g'] ?? 0 ),
			'carbs_g'        => (float) ( $analysis['carbs_g'] ?? 0 ),
			'fat_g'          => (float) ( $analysis['fat_g'] ?? 0 ),
			'fiber_g'        => (float) ( $analysis['fiber_g'] ?? 0 ),
			'sugar_g'        => (float) ( $analysis['sugar_g'] ?? 0 ),
			'sodium_mg'      => (float) ( $analysis['sodium_mg'] ?? 0 ),
			'micros'         => (array) ( $analysis['micros'] ?? [] ),
		] ] );

		$response = self::nutrition_log_meal( $deps, $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not log that food.' ) ];
		}

		$food_name     = (string) ( $analysis['food_name'] ?? 'Food item' );
		$resolved_when = (string) ( $data['meal_datetime'] ?? $meal_datetime );
		$meal_date     = substr( $resolved_when, 0, 10 );
		$day_totals    = self::dep( $deps, 'daily_nutrition_totals_for_date', $user_id, $meal_date );
		$targets       = self::dep( $deps, 'active_goal_targets', $user_id );
		$estimated     = (float) ( $analysis['confidence'] ?? 0 ) < 0.72;
		$coach_note    = sprintf(
			'Today now sits at %d calories and %.0f g protein across %d meal%s.',
			(int) ( $day_totals['calories'] ?? 0 ),
			(float) ( $day_totals['protein_g'] ?? 0 ),
			(int) ( $day_totals['meal_count'] ?? 0 ),
			1 === (int) ( $day_totals['meal_count'] ?? 0 ) ? '' : 's'
		);
		if ( ! empty( $targets['target_calories'] ) ) {
			$coach_note .= sprintf( ' Target is %d calories.', (int) $targets['target_calories'] );
		}

		return [
			'ok'                 => true,
			'action'             => 'log_food_from_description',
			'meal_id'            => (int) ( $data['meal_id'] ?? 0 ),
			'meal_type'          => $meal_type,
			'meal_date'          => $meal_date,
			'food_name'          => $food_name,
			'calories'           => (int) ( $analysis['calories'] ?? 0 ),
			'protein_g'          => (float) ( $analysis['protein_g'] ?? 0 ),
			'confidence'         => (float) ( $analysis['confidence'] ?? 0 ),
			'notes'              => (string) ( $analysis['notes'] ?? '' ),
			'estimated'          => $estimated,
			'review_recommended' => $estimated,
			'coach_note'         => $coach_note,
			'summary'            => sprintf( '%s %s to %s. %s', $estimated ? 'Logged an estimate for' : 'Logged', $food_name, $meal_type, $coach_note ),
		];
	}

	private static function tool_create_training_plan( int $user_id, array $arguments = [] ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/training/plan' );
		$name    = sanitize_text_field( (string) ( $arguments['name'] ?? 'Johnny5k Plan' ) );
		$request->set_param( 'name', $name );

		$template_id   = isset( $arguments['program_template_id'] ) ? (int) $arguments['program_template_id'] : 0;
		$template_name = sanitize_text_field( (string) ( $arguments['template_name'] ?? '' ) );
		if ( $template_id > 0 ) {
			$request->set_param( 'program_template_id', $template_id );
		} elseif ( '' !== $template_name ) {
			$request->set_param( 'template_name', $template_name );
		}

		$response = TrainingController::create_plan( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not create a training plan.' ) ];
		}

		$plan_name = (string) ( $data['name'] ?? $name );

		return [
			'ok'                  => true,
			'action'              => 'create_training_plan',
			'plan_id'             => (int) ( $data['plan_id'] ?? 0 ),
			'name'                => $plan_name,
			'program_template_id' => (int) ( $data['program_template_id'] ?? 0 ),
			'days_created'        => (int) ( $data['days_created'] ?? 0 ),
			'summary'             => sprintf( 'Created and activated %s with %d training days.', $plan_name, (int) ( $data['days_created'] ?? 0 ) ),
		];
	}

	private static function tool_create_custom_workout( int $user_id, array $arguments = [] ): array {
		$name           = sanitize_text_field( (string) ( $arguments['name'] ?? '' ) );
		$exercise_names = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $arguments['exercise_names'] ?? [] ) ) ) );

		if ( '' === $name ) {
			return [ 'error' => 'A custom workout name is required.' ];
		}
		if ( empty( $exercise_names ) ) {
			return [ 'error' => 'At least one exercise name is required to build a custom workout.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/custom-draft' );
		$day_type = sanitize_text_field( (string) ( $arguments['day_type'] ?? TrainingDayTypes::custom_workout_fallback() ) );
		if ( 'rest' === sanitize_key( $day_type ) && ! empty( $exercise_names ) ) {
			$day_type = TrainingDayTypes::custom_workout_fallback();
		}
		$request->set_param( 'name', $name );
		$request->set_param( 'day_type', $day_type );
		$request->set_param( 'coach_note', sanitize_textarea_field( (string) ( $arguments['coach_note'] ?? '' ) ) );
		$request->set_param( 'exercises', array_map( static function( string $exercise_name ): array {
			return [ 'exercise_name' => $exercise_name ];
		}, $exercise_names ) );

		$response = WorkoutController::save_custom_draft( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not build that custom workout.' ) ];
		}

		$draft          = is_array( $data['custom_workout_draft'] ?? null ) ? $data['custom_workout_draft'] : [];
		$exercise_count = count( is_array( $draft['exercises'] ?? null ) ? $draft['exercises'] : [] );
		$day_type       = (string) ( $draft['day_type'] ?? TrainingDayTypes::custom_workout_fallback() );

		return [
			'ok'                => true,
			'action'            => 'create_custom_workout',
			'custom_workout_id' => sanitize_text_field( (string) ( $draft['id'] ?? '' ) ),
			'name'              => (string) ( $draft['name'] ?? $name ),
			'day_type'          => $day_type,
			'exercise_count'    => $exercise_count,
			'exercise_names'    => array_values( array_filter( array_map( static fn( array $item ): string => sanitize_text_field( (string) ( $item['exercise_name'] ?? '' ) ), is_array( $draft['exercises'] ?? null ) ? $draft['exercises'] : [] ) ) ),
			'coach_note'        => sanitize_textarea_field( (string) ( $draft['coach_note'] ?? '' ) ),
			'summary'           => sprintf( 'Queued %s as a custom %s workout with %d exercises on the workout page.', (string) ( $draft['name'] ?? $name ), str_replace( '_', ' ', $day_type ), $exercise_count ),
		];
	}

	private static function tool_create_personal_exercise( int $user_id, array $arguments = [] ): array {
		$name = sanitize_text_field( (string) ( $arguments['name'] ?? '' ) );
		if ( '' === $name ) {
			return [ 'error' => 'An exercise name is required to add something to the custom exercise library.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/training/exercises/personal' );
		$request->set_param( 'name', $name );
		$request->set_param( 'description', sanitize_textarea_field( (string) ( $arguments['description'] ?? '' ) ) );
		$request->set_param( 'primary_muscle', sanitize_key( (string) ( $arguments['primary_muscle'] ?? '' ) ) );
		$request->set_param( 'movement_pattern', sanitize_text_field( (string) ( $arguments['movement_pattern'] ?? '' ) ) );
		$request->set_param( 'equipment', sanitize_key( (string) ( $arguments['equipment'] ?? '' ) ) );
		$request->set_param( 'difficulty', sanitize_key( (string) ( $arguments['difficulty'] ?? 'beginner' ) ) );
		$request->set_param( 'default_rep_min', max( 1, (int) ( $arguments['default_rep_min'] ?? 8 ) ) );
		$request->set_param( 'default_rep_max', max( 1, (int) ( $arguments['default_rep_max'] ?? 12 ) ) );
		$request->set_param( 'default_sets', max( 1, (int) ( $arguments['default_sets'] ?? 3 ) ) );
		$request->set_param( 'day_types', array_values( array_filter( array_map( 'sanitize_key', (array) ( $arguments['day_types'] ?? [] ) ) ) ) );
		$request->set_param( 'slot_types', array_values( array_filter( array_map( 'sanitize_key', (array) ( $arguments['slot_types'] ?? [] ) ) ) ) );
		$request->set_param( 'coaching_cues', array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $arguments['coaching_cues'] ?? [] ) ) ) ) );

		$response = TrainingController::save_personal_exercise( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not save that exercise to the custom library.' ) ];
		}

		$created = ! empty( $data['created'] );

		return [
			'ok'             => true,
			'action'         => 'create_personal_exercise',
			'exercise_id'    => (int) ( $data['id'] ?? 0 ),
			'name'           => $name,
			'created'        => $created,
			'primary_muscle' => sanitize_key( (string) ( $arguments['primary_muscle'] ?? '' ) ),
			'equipment'      => sanitize_key( (string) ( $arguments['equipment'] ?? '' ) ),
			'difficulty'     => sanitize_key( (string) ( $arguments['difficulty'] ?? 'beginner' ) ),
			'summary'        => $created
				? sprintf( 'Saved %s to your custom exercise library.', $name )
				: sprintf( '%s was already in your custom exercise library, so Johnny kept the existing version.', $name ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_log_sleep( int $user_id, array $arguments, array $deps ): array {
		$hours_sleep = isset( $arguments['hours_sleep'] ) ? (float) $arguments['hours_sleep'] : 0;
		if ( $hours_sleep <= 0 || $hours_sleep > 24 ) {
			return [ 'error' => 'A sleep duration between 0 and 24 hours is required.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/body/sleep' );
		$request->set_param( 'hours_sleep', $hours_sleep );

		$date = (string) self::dep( $deps, 'normalise_tool_date', $user_id, (string) ( $arguments['date'] ?? '' ) );
		if ( '' !== $date ) {
			$request->set_param( 'date', $date );
		}

		$sleep_quality = sanitize_text_field( (string) ( $arguments['sleep_quality'] ?? '' ) );
		if ( '' !== $sleep_quality ) {
			$request->set_param( 'sleep_quality', $sleep_quality );
		}

		$response = BodyMetricsController::log_sleep( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not log sleep.' ) ];
		}

		$date_logged    = (string) ( $data['date'] ?? UserTime::today( $user_id ) );
		$date_display   = (string) self::dep( $deps, 'format_tool_display_date', $user_id, $date_logged );
		$targets        = self::dep( $deps, 'active_goal_targets', $user_id );
		$target_sleep   = (float) ( $targets['target_sleep_hours'] ?? 0 );
		$logged_sleep   = (float) ( $data['hours_sleep'] ?? $hours_sleep );
		$sleep_gap      = $target_sleep > 0 ? round( $logged_sleep - $target_sleep, 1 ) : 0;
		$coach_note     = $target_sleep > 0
			? sprintf( 'Target is %.1f hours, so this is %s%.1f hours.', $target_sleep, $sleep_gap >= 0 ? '+' : '', $sleep_gap )
			: 'Sleep target updated for the day.';

		return [
			'ok'                 => true,
			'action'             => 'log_sleep',
			'id'                 => (int) ( $data['id'] ?? 0 ),
			'date'               => $date_logged,
			'date_display'       => $date_display,
			'hours_sleep'        => $logged_sleep,
			'target_sleep_hours' => $target_sleep,
			'sleep_quality'      => $sleep_quality,
			'coach_note'         => $coach_note,
			'summary'            => sprintf( 'Logged %.1f hours of sleep for %s. %s', $logged_sleep, $date_display, $coach_note ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_add_pantry_items( int $user_id, array $arguments, array $deps ): array {
		$items = self::dep( $deps, 'build_tool_items_payload', $arguments, [ 'expires_on' ] );
		if ( empty( $items ) ) {
			return [ 'error' => 'At least one pantry item is required.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/pantry/bulk' );
		$request->set_param( 'items', $items );

		$response = self::nutrition_add_pantry_items_bulk( $deps, $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not update pantry.' ) ];
		}

		$item_names = array_values( array_filter( array_map( static function( array $item ): string {
			$result_item = is_array( $item['item'] ?? null ) ? $item['item'] : [];
			return sanitize_text_field( (string) ( $result_item['item_name'] ?? '' ) );
		}, is_array( $data['items'] ?? null ) ? $data['items'] : [] ) ) );

		return [
			'ok'            => true,
			'action'        => 'add_pantry_items',
			'created_count' => (int) ( $data['created_count'] ?? 0 ),
			'merged_count'  => (int) ( $data['merged_count'] ?? 0 ),
			'updated_count' => (int) ( $data['updated_count'] ?? 0 ),
			'item_names'    => $item_names,
			'coach_note'    => sprintf( 'Pantry now has %d item%s on hand.', count( $item_names ), 1 === count( $item_names ) ? '' : 's' ),
			'summary'       => (string) self::dep( $deps, 'build_bulk_action_summary', 'pantry', $item_names, $data ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_add_grocery_gap_items( int $user_id, array $arguments, array $deps ): array {
		$items = self::dep( $deps, 'build_tool_items_payload', $arguments, [ 'notes' ] );
		if ( empty( $items ) ) {
			return [ 'error' => 'At least one grocery gap item is required.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/grocery-gap/items' );
		$request->set_param( 'items', $items );

		$response = NutritionRecipeController::add_grocery_gap_items( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not update grocery gap.' ) ];
		}

		$item_names = array_values( array_filter( array_map( static function( array $item ): string {
			$result_item = is_array( $item['item'] ?? null ) ? $item['item'] : [];
			return sanitize_text_field( (string) ( $result_item['item_name'] ?? '' ) );
		}, is_array( $data['items'] ?? null ) ? $data['items'] : [] ) ) );

		return [
			'ok'            => true,
			'action'        => 'add_grocery_gap_items',
			'created_count' => (int) ( $data['created_count'] ?? 0 ),
			'merged_count'  => (int) ( $data['merged_count'] ?? 0 ),
			'item_names'    => $item_names,
			'coach_note'    => 'Those items are now queued in grocery gap so the next shopping pass is easier to execute.',
			'summary'       => (string) self::dep( $deps, 'build_bulk_action_summary', 'grocery gap', $item_names, $data ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_swap_workout_exercise( int $user_id, array $arguments, array $deps ): array {
		$workout = self::dep( $deps, 'current_workout_payload' );
		if ( ! empty( $workout['error'] ) ) {
			return [ 'error' => $workout['error'] ];
		}

		$session   = is_array( $workout['session'] ?? null ) ? $workout['session'] : [];
		$exercises = is_array( $workout['exercises'] ?? null ) ? $workout['exercises'] : [];
		if ( empty( $session['id'] ) || empty( $exercises ) ) {
			return [ 'error' => 'There is no active workout session to swap exercises in right now.' ];
		}

		$session_exercise_id = isset( $arguments['session_exercise_id'] ) ? (int) $arguments['session_exercise_id'] : 0;
		$current_name        = (string) ( $arguments['current_exercise_name'] ?? '' );
		$replacement_name    = (string) ( $arguments['replacement_exercise_name'] ?? '' );

		$exercise = self::dep( $deps, 'find_session_exercise_match', $exercises, $session_exercise_id, $current_name );
		if ( empty( $exercise ) ) {
			return [ 'error' => 'I could not find that exercise in the current workout.' ];
		}

		$replacement = self::dep( $deps, 'find_named_match', is_array( $exercise['swap_options'] ?? null ) ? $exercise['swap_options'] : [], $replacement_name, [ 'name' ] );
		if ( empty( $replacement ) ) {
			$available = array_values( array_filter( array_map( static fn( array $option ): string => (string) ( $option['name'] ?? '' ), is_array( $exercise['swap_options'] ?? null ) ? $exercise['swap_options'] : [] ) ) );
			return [
				'error' => empty( $available )
					? 'That exercise cannot be swapped right now.'
					: 'That swap is not available right now. Available options: ' . implode( ', ', array_slice( $available, 0, 6 ) ) . '.',
			];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/' . (int) $session['id'] . '/swap' );
		$request->set_param( 'id', (int) $session['id'] );
		$request->set_param( 'session_exercise_id', (int) ( $exercise['id'] ?? 0 ) );
		$request->set_param( 'new_exercise_id', (int) ( $replacement['id'] ?? 0 ) );

		$response = WorkoutController::swap_exercise( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not swap that exercise.' ) ];
		}

		$new_exercise = is_array( $data['exercise'] ?? null ) ? $data['exercise'] : [];
		$new_name     = (string) ( $new_exercise['name'] ?? ( $replacement['name'] ?? '' ) );

		return [
			'ok'                  => true,
			'action'              => 'swap_workout_exercise',
			'session_id'          => (int) $session['id'],
			'session_exercise_id' => (int) ( $exercise['id'] ?? 0 ),
			'previous_exercise'   => (string) ( $exercise['exercise_name'] ?? '' ),
			'new_exercise'        => $new_name,
			'coach_note'          => sprintf( 'The current workout now points you to %s instead.', $new_name ),
			'summary'             => sprintf( 'Swapped %s for %s in the current workout. The session is updated.', (string) ( $exercise['exercise_name'] ?? 'that exercise' ), $new_name ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_schedule_sms_reminder( int $user_id, array $arguments, array $deps ): array {
		$message       = sanitize_textarea_field( (string) ( $arguments['message'] ?? '' ) );
		$send_at_local = sanitize_text_field( (string) ( $arguments['send_at_local'] ?? '' ) );

		if ( '' === trim( $message ) ) {
			return [ 'error' => 'A reminder message is required.' ];
		}
		if ( '' === trim( $send_at_local ) ) {
			return [ 'error' => 'A future local date and time is required.' ];
		}

		$result = SmsService::schedule_user_reminder( $user_id, $send_at_local, $message );
		if ( is_wp_error( $result ) ) {
			return [ 'error' => $result->get_error_message() ];
		}

		$send_at_display  = (string) self::dep( $deps, 'format_tool_display_datetime', $user_id, (string) ( $result['send_at_local'] ?? '' ) );
		$timezone_display = (string) self::dep( $deps, 'format_tool_timezone_label', $user_id, (string) ( $result['timezone'] ?? '' ) );
		$timing_phrase    = (string) self::dep( $deps, 'build_tool_reminder_timing_phrase', $send_at_display, $timezone_display );

		return [
			'ok'               => true,
			'action'           => 'schedule_sms_reminder',
			'reminder_id'      => sanitize_text_field( (string) ( $result['id'] ?? '' ) ),
			'message'          => sanitize_textarea_field( (string) ( $result['message'] ?? $message ) ),
			'send_at_local'    => sanitize_text_field( (string) ( $result['send_at_local'] ?? '' ) ),
			'timezone'         => sanitize_text_field( (string) ( $result['timezone'] ?? '' ) ),
			'send_at_display'  => $send_at_display,
			'timezone_display' => $timezone_display,
			'coach_note'       => sprintf( 'SMS reminder locked for %s.', $timing_phrase ),
			'summary'          => sprintf( 'Scheduled an SMS reminder for %s.', $timing_phrase ),
		];
	}

	/**
	 * @param array<int,mixed> $items
	 * @return array<int,string>
	 */
	private static function sanitize_string_list( array $items ): array {
		return array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $items ) ) );
	}

	private static function sanitize_meal_type_value( string $meal_type, bool $default_to_lunch = true ): string {
		$meal_type = sanitize_key( $meal_type );
		if ( in_array( $meal_type, [ 'breakfast', 'lunch', 'dinner', 'snack', 'beverage' ], true ) ) {
			return $meal_type;
		}

		return $default_to_lunch ? 'lunch' : '';
	}
}
