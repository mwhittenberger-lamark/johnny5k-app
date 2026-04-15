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
			'get_recipe_cookbook'        => self::tool_recipe_cookbook( $user_id, $arguments ),
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
			'add_recipe_to_cookbook'     => self::tool_add_recipe_to_cookbook( $user_id, $arguments ),
			'swap_workout_exercise'      => self::tool_swap_workout_exercise( $user_id, $arguments, $deps ),
			'schedule_sms_reminder'      => self::tool_schedule_sms_reminder( $user_id, $arguments, $deps ),
			'clear_follow_ups'          => self::tool_clear_follow_ups( $user_id, $arguments, $deps ),
			'clear_sms_reminders'       => self::tool_clear_sms_reminders( $user_id, $arguments, $deps ),
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

		CalorieEngine::refresh_active_goal_targets( $user_id );

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
		$cookbook_lookup = self::load_recipe_lookup_by_key( self::load_recipe_cookbook_items() );
		$catalog_result  = self::load_recipe_catalog_items();

		if ( ! empty( $catalog_result['error'] ) ) {
			return [ 'error' => $catalog_result['error'] ];
		}

		$recipes = self::filter_recipe_tool_items( $catalog_result['recipes'], $meal_type, $minimum_protein );
		$recipes = array_map( static function( array $recipe ) use ( $cookbook_lookup ): array {
			$key                     = (string) ( $recipe['key'] ?? '' );
			$recipe['is_in_cookbook'] = '' !== $key && isset( $cookbook_lookup[ $key ] );
			return $recipe;
		}, $recipes );
		$visible_recipes = array_slice( $recipes, 0, $limit );

		return [
			'ok'                => true,
			'action'            => 'show_recipe_catalog',
			'meal_type'         => $meal_type,
			'minimum_protein_g' => $minimum_protein,
			'recipe_count'      => count( $recipes ),
			'recipes'           => $visible_recipes,
			'summary'           => empty( $visible_recipes )
				? 'Johnny did not find any recipe matches for that filter yet.'
				: sprintf(
					'Johnny found %d recipe recommendation%s%s%s.',
					count( $visible_recipes ),
					1 === count( $visible_recipes ) ? '' : 's',
					'' !== $meal_type ? ' for ' . $meal_type : '',
					$minimum_protein > 0 ? sprintf( ' at %.0f g protein or higher', $minimum_protein ) : ''
				),
		];
	}

	private static function tool_recipe_cookbook( int $user_id, array $arguments = [] ): array {
		$limit           = max( 1, min( 12, (int) ( $arguments['limit'] ?? 12 ) ) );
		$meal_type       = self::sanitize_meal_type_value( (string) ( $arguments['meal_type'] ?? '' ), false );
		$minimum_protein = isset( $arguments['minimum_protein_g'] ) ? max( 0, (float) $arguments['minimum_protein_g'] ) : 0;
		$cookbook_result = self::load_recipe_cookbook_items();

		if ( ! empty( $cookbook_result['error'] ) ) {
			return [ 'error' => $cookbook_result['error'] ];
		}

		$recipes = array_map( static function( array $recipe ): array {
			$recipe['is_in_cookbook'] = true;
			return $recipe;
		}, self::filter_recipe_tool_items( $cookbook_result['recipes'], $meal_type, $minimum_protein ) );
		$visible_recipes = array_slice( $recipes, 0, $limit );

		return [
			'ok'                => true,
			'action'            => 'show_recipe_cookbook',
			'meal_type'         => $meal_type,
			'minimum_protein_g' => $minimum_protein,
			'recipe_count'      => count( $recipes ),
			'recipes'           => $visible_recipes,
			'summary'           => empty( $visible_recipes )
				? 'My Cookbook is empty for that filter right now.'
				: sprintf(
					'Johnny pulled %d recipe%s from My Cookbook%s%s.',
					count( $visible_recipes ),
					1 === count( $visible_recipes ) ? '' : 's',
					'' !== $meal_type ? ' for ' . $meal_type : '',
					$minimum_protein > 0 ? sprintf( ' at %.0f g protein or higher', $minimum_protein ) : ''
				),
		];
	}

	private static function tool_add_recipe_to_cookbook( int $user_id, array $arguments = [] ): array {
		$cookbook_result = self::load_recipe_cookbook_items();
		if ( ! empty( $cookbook_result['error'] ) ) {
			return [ 'error' => $cookbook_result['error'] ];
		}
		$catalog_result = self::load_recipe_catalog_items();
		if ( ! empty( $catalog_result['error'] ) ) {
			return [ 'error' => $catalog_result['error'] ];
		}

		$cookbook_lookup = self::load_recipe_lookup_by_key( $cookbook_result );
		$matched_recipe  = self::find_recipe_tool_match( array_merge( $cookbook_result['recipes'], $catalog_result['recipes'] ), $arguments );

		if ( empty( $matched_recipe['recipe_name'] ) ) {
			return [ 'error' => 'Johnny could not match that recipe in your recipe library.' ];
		}

		$recipe_key = (string) ( $matched_recipe['key'] ?? '' );
		if ( '' !== $recipe_key && isset( $cookbook_lookup[ $recipe_key ] ) ) {
			$recipe = $cookbook_lookup[ $recipe_key ];
			$recipe['is_in_cookbook'] = true;

			return [
				'ok'             => true,
				'action'         => 'add_recipe_to_cookbook',
				'added'          => false,
				'cookbook_count' => count( $cookbook_result['recipes'] ),
				'recipe'         => $recipe,
				'summary'        => sprintf( '%s is already in My Cookbook.', (string) ( $recipe['recipe_name'] ?? 'That recipe' ) ),
				'coach_note'     => 'Johnny kept the existing cookbook entry so you can come back to it later.',
			];
		}

		$request = new \WP_REST_Request( 'PUT', '/fit/v1/nutrition/recipe-cookbook' );
		$request->set_param( 'recipes', array_merge( $cookbook_result['recipes'], [ $matched_recipe ] ) );

		$response = NutritionRecipeController::update_recipe_cookbook( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();
		if ( $status >= 400 || ! is_array( $data ) ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not save that recipe to My Cookbook.' ) ];
		}

		$persisted_result = [
			'recipes' => array_map( [ self::class, 'normalize_recipe_tool_item' ], is_array( $data['recipes'] ?? null ) ? $data['recipes'] : [] ),
		];
		$persisted_lookup = self::load_recipe_lookup_by_key( $persisted_result );
		$recipe           = $persisted_lookup[ $recipe_key ] ?? self::normalize_recipe_tool_item( $matched_recipe );
		$recipe['is_in_cookbook'] = true;

		return [
			'ok'             => true,
			'action'         => 'add_recipe_to_cookbook',
			'added'          => true,
			'cookbook_count' => count( $persisted_result['recipes'] ),
			'recipe'         => $recipe,
			'summary'        => sprintf( 'Johnny added %s to My Cookbook.', (string) ( $recipe['recipe_name'] ?? 'that recipe' ) ),
			'coach_note'     => 'You can open Recipes anytime and switch to My Cookbook to pull it back up fast.',
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
		$time_tier      = self::normalize_time_tier( (string) ( $arguments['time_tier'] ?? '' ) );

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
		if ( '' !== $time_tier ) {
			$request->set_param( 'time_tier', $time_tier );
		}
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
			'time_tier'         => sanitize_key( (string) ( $draft['time_tier'] ?? '' ) ),
			'exercise_count'    => $exercise_count,
			'exercise_names'    => array_values( array_filter( array_map( static fn( array $item ): string => sanitize_text_field( (string) ( $item['exercise_name'] ?? '' ) ), is_array( $draft['exercises'] ?? null ) ? $draft['exercises'] : [] ) ) ),
			'coach_note'        => sanitize_textarea_field( (string) ( $draft['coach_note'] ?? '' ) ),
			'summary'           => sprintf( 'Queued %s as a custom %s workout with %d exercises on the workout page.', (string) ( $draft['name'] ?? $name ), str_replace( '_', ' ', $day_type ), $exercise_count ),
		];
	}

	private static function normalize_time_tier( string $value ): string {
		$time_tier = sanitize_key( $value );
		if ( 'long' === $time_tier ) {
			$time_tier = 'full';
		}

		return in_array( $time_tier, [ 'short', 'medium', 'full' ], true ) ? $time_tier : '';
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
	 * @param array<string,callable> $deps
	 */
	private static function tool_clear_follow_ups( int $user_id, array $arguments, array $deps ): array {
		$clear_all = ! empty( $arguments['clear_all'] );
		$follow_up_ids = self::sanitize_string_list( is_array( $arguments['follow_up_ids'] ?? null ) ? $arguments['follow_up_ids'] : [] );

		if ( ! $clear_all && empty( $follow_up_ids ) ) {
			return [ 'error' => 'Follow-up ids are required unless Johnny is clearing all pending follow-ups.' ];
		}

		$pending = self::list_pending_follow_ups( $user_id, $deps );
		if ( $clear_all ) {
			$follow_up_ids = array_values( array_filter( array_map(
				static fn( array $item ): string => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				$pending
			) ) );
		}
		$follow_up_ids = array_values( array_unique( $follow_up_ids ) );

		if ( empty( $follow_up_ids ) ) {
			return [
				'ok'            => true,
				'action'        => 'clear_follow_ups',
				'cleared_ids'   => [],
				'cleared_count' => 0,
				'failed_count'  => 0,
				'summary'       => 'No pending Johnny follow-ups were waiting to be cleared.',
			];
		}

		$cleared_ids = [];
		$failed_ids  = [];

		foreach ( $follow_up_ids as $follow_up_id ) {
			$dismissed = self::dismiss_follow_up( $user_id, $follow_up_id, $deps );
			if ( $dismissed ) {
				$cleared_ids[] = $follow_up_id;
				continue;
			}

			$failed_ids[] = $follow_up_id;
		}

		$cleared_count = count( $cleared_ids );
		$failed_count  = count( $failed_ids );
		$summary = 0 === $cleared_count
			? 'Johnny could not clear those follow-ups.'
			: sprintf(
				'Cleared %d Johnny follow-up%s%s.',
				$cleared_count,
				1 === $cleared_count ? '' : 's',
				$failed_count > 0 ? sprintf( ' %d could not be cleared.', $failed_count ) : ''
			);

		return [
			'ok'            => $cleared_count > 0,
			'action'        => 'clear_follow_ups',
			'cleared_ids'   => $cleared_ids,
			'failed_ids'    => $failed_ids,
			'cleared_count' => $cleared_count,
			'failed_count'  => $failed_count,
			'summary'       => $summary,
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_clear_sms_reminders( int $user_id, array $arguments, array $deps ): array {
		$clear_all    = ! empty( $arguments['clear_all'] );
		$reminder_ids = self::sanitize_string_list( is_array( $arguments['reminder_ids'] ?? null ) ? $arguments['reminder_ids'] : [] );

		if ( ! $clear_all && empty( $reminder_ids ) ) {
			return [ 'error' => 'Reminder ids are required unless Johnny is clearing all scheduled SMS reminders.' ];
		}

		$reminders = self::list_sms_reminders( $user_id, $deps );
		$scheduled = is_array( $reminders['scheduled'] ?? null ) ? $reminders['scheduled'] : [];

		if ( $clear_all ) {
			$reminder_ids = array_values( array_filter( array_map(
				static fn( array $item ): string => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				$scheduled
			) ) );
		}
		$reminder_ids = array_values( array_unique( $reminder_ids ) );

		if ( empty( $reminder_ids ) ) {
			return [
				'ok'             => true,
				'action'         => 'clear_sms_reminders',
				'canceled_ids'   => [],
				'canceled_count' => 0,
				'failed_count'   => 0,
				'summary'        => 'No scheduled SMS reminders were waiting to be cleared.',
			];
		}

		$canceled_ids = [];
		$failed_ids   = [];

		foreach ( $reminder_ids as $reminder_id ) {
			$result = self::cancel_sms_reminder( $user_id, $reminder_id, $deps );
			if ( is_wp_error( $result ) ) {
				$failed_ids[] = $reminder_id;
				continue;
			}

			$canceled_ids[] = $reminder_id;
		}

		$canceled_count = count( $canceled_ids );
		$failed_count   = count( $failed_ids );
		$summary = 0 === $canceled_count
			? 'Johnny could not cancel those SMS reminders.'
			: sprintf(
				'Canceled %d scheduled SMS reminder%s%s.',
				$canceled_count,
				1 === $canceled_count ? '' : 's',
				$failed_count > 0 ? sprintf( ' %d could not be canceled.', $failed_count ) : ''
			);

		return [
			'ok'             => $canceled_count > 0,
			'action'         => 'clear_sms_reminders',
			'canceled_ids'   => $canceled_ids,
			'failed_ids'     => $failed_ids,
			'canceled_count' => $canceled_count,
			'failed_count'   => $failed_count,
			'summary'        => $summary,
		];
	}

	/**
	 * @param array<string,callable> $deps
	 * @return array<int,array<string,mixed>>
	 */
	private static function list_pending_follow_ups( int $user_id, array $deps ): array {
		$callable = $deps['list_pending_follow_ups'] ?? null;
		if ( is_callable( $callable ) ) {
			$result = $callable( $user_id );
			return is_array( $result ) ? $result : [];
		}

		return AiService::get_pending_follow_ups( $user_id );
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function dismiss_follow_up( int $user_id, string $follow_up_id, array $deps ): bool {
		$callable = $deps['dismiss_follow_up'] ?? null;
		if ( is_callable( $callable ) ) {
			return (bool) $callable( $user_id, $follow_up_id );
		}

		return AiService::dismiss_follow_up( $user_id, $follow_up_id );
	}

	/**
	 * @param array<string,callable> $deps
	 * @return array<string,mixed>
	 */
	private static function list_sms_reminders( int $user_id, array $deps ): array {
		$callable = $deps['list_sms_reminders'] ?? null;
		if ( is_callable( $callable ) ) {
			$result = $callable( $user_id );
			return is_array( $result ) ? $result : [];
		}

		return SmsService::list_user_reminders( $user_id );
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function cancel_sms_reminder( int $user_id, string $reminder_id, array $deps ): array|\WP_Error {
		$callable = $deps['cancel_sms_reminder'] ?? null;
		if ( is_callable( $callable ) ) {
			$result = $callable( $user_id, $reminder_id );
			return is_array( $result ) || is_wp_error( $result ) ? $result : new \WP_Error( 'cancel_failed', 'Could not cancel reminder.' );
		}

		return SmsService::cancel_user_reminder( $user_id, $reminder_id );
	}

	/**
	 * @param array<int,mixed> $items
	 * @return array<int,string>
	 */
	private static function sanitize_string_list( array $items ): array {
		return array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $items ) ) );
	}

	private static function load_recipe_catalog_items(): array {
		$request  = new \WP_REST_Request( 'GET', '/fit/v1/nutrition/recipes' );
		$response = NutritionRecipeController::get_recipe_suggestions( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 || ! is_array( $data ) ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not load recipes.' ) ];
		}

		return [
			'recipes' => array_values( array_filter( array_map( [ self::class, 'normalize_recipe_tool_item' ], $data ), static fn( array $recipe ): bool => '' !== (string) ( $recipe['recipe_name'] ?? '' ) ) ),
		];
	}

	private static function load_recipe_cookbook_items(): array {
		$request  = new \WP_REST_Request( 'GET', '/fit/v1/nutrition/recipe-cookbook' );
		$response = NutritionRecipeController::get_recipe_cookbook( $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 || ! is_array( $data ) ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not load My Cookbook.' ) ];
		}

		return [
			'recipes' => array_values( array_filter( array_map( [ self::class, 'normalize_recipe_tool_item' ], $data ), static fn( array $recipe ): bool => '' !== (string) ( $recipe['recipe_name'] ?? '' ) ) ),
		];
	}

	private static function normalize_recipe_tool_item( mixed $recipe ): array {
		$payload       = is_array( $recipe ) ? $recipe : (array) $recipe;
		$meal_type     = self::sanitize_meal_type_value( (string) ( $payload['meal_type'] ?? '' ), true );
		$recipe_name   = sanitize_text_field( (string) ( $payload['recipe_name'] ?? '' ) );
		$key           = sanitize_title( (string) ( $payload['key'] ?? '' ) );
		$on_hand       = self::sanitize_string_list( is_array( $payload['on_hand_ingredients'] ?? null ) ? $payload['on_hand_ingredients'] : [] );
		$missing       = self::sanitize_string_list( is_array( $payload['missing_ingredients'] ?? null ) ? $payload['missing_ingredients'] : [] );

		if ( '' === $key ) {
			$key = sanitize_title( $meal_type . '-' . $recipe_name );
		}

		return [
			'key'                 => $key,
			'recipe_name'         => $recipe_name,
			'meal_type'           => $meal_type,
			'ingredients'         => self::sanitize_string_list( is_array( $payload['ingredients'] ?? null ) ? $payload['ingredients'] : [] ),
			'instructions'        => self::sanitize_string_list( is_array( $payload['instructions'] ?? null ) ? $payload['instructions'] : [] ),
			'estimated_calories'  => (int) ( $payload['estimated_calories'] ?? 0 ),
			'estimated_protein_g' => round( (float) ( $payload['estimated_protein_g'] ?? 0 ), 2 ),
			'estimated_carbs_g'   => round( (float) ( $payload['estimated_carbs_g'] ?? 0 ), 2 ),
			'estimated_fat_g'     => round( (float) ( $payload['estimated_fat_g'] ?? 0 ), 2 ),
			'dietary_tags'        => self::sanitize_string_list( is_array( $payload['dietary_tags'] ?? null ) ? $payload['dietary_tags'] : [] ),
			'why_this_works'      => sanitize_text_field( (string) ( $payload['why_this_works'] ?? '' ) ),
			'source'              => sanitize_key( (string) ( $payload['source'] ?? '' ) ) ?: 'generated',
			'source_title'        => sanitize_text_field( (string) ( $payload['source_title'] ?? '' ) ),
			'source_url'          => esc_url_raw( (string) ( $payload['source_url'] ?? '' ) ),
			'image_url'           => esc_url_raw( (string) ( $payload['image_url'] ?? '' ) ),
			'on_hand_ingredients' => $on_hand,
			'missing_ingredients' => $missing,
			'pantry_match_count'  => max( count( $on_hand ), (int) ( $payload['pantry_match_count'] ?? 0 ) ),
			'pantry_missing_count' => max( count( $missing ), (int) ( $payload['pantry_missing_count'] ?? 0 ) ),
		];
	}

	private static function filter_recipe_tool_items( array $recipes, string $meal_type = '', float $minimum_protein = 0 ): array {
		$filtered = array_values( array_filter( $recipes, static function( array $recipe ) use ( $meal_type, $minimum_protein ): bool {
			if ( '' !== $meal_type && $meal_type !== ( $recipe['meal_type'] ?? '' ) ) {
				return false;
			}

			return (float) ( $recipe['estimated_protein_g'] ?? 0 ) >= $minimum_protein;
		} ) );

		usort( $filtered, static function( array $left, array $right ): int {
			$protein_compare = (float) ( $right['estimated_protein_g'] ?? 0 ) <=> (float) ( $left['estimated_protein_g'] ?? 0 );
			if ( 0 !== $protein_compare ) {
				return $protein_compare;
			}

			return (int) ( $right['pantry_match_count'] ?? 0 ) <=> (int) ( $left['pantry_match_count'] ?? 0 );
		} );

		return $filtered;
	}

	private static function load_recipe_lookup_by_key( array $result ): array {
		$lookup = [];
		foreach ( is_array( $result['recipes'] ?? null ) ? $result['recipes'] : [] as $recipe ) {
			$key = (string) ( $recipe['key'] ?? '' );
			if ( '' === $key ) {
				continue;
			}

			$lookup[ $key ] = $recipe;
		}

		return $lookup;
	}

	private static function find_recipe_tool_match( array $recipes, array $arguments ): array {
		$recipe_key = sanitize_title( (string) ( $arguments['recipe_key'] ?? '' ) );
		$recipe_name = sanitize_text_field( (string) ( $arguments['recipe_name'] ?? '' ) );
		$meal_type = self::sanitize_meal_type_value( (string) ( $arguments['meal_type'] ?? '' ), false );

		if ( '' !== $recipe_key ) {
			foreach ( $recipes as $recipe ) {
				if ( $recipe_key === (string) ( $recipe['key'] ?? '' ) ) {
					return $recipe;
				}
			}
		}

		if ( '' === $recipe_name ) {
			return [];
		}

		$needle = sanitize_title( $recipe_name );
		foreach ( $recipes as $recipe ) {
			if ( $needle !== sanitize_title( (string) ( $recipe['recipe_name'] ?? '' ) ) ) {
				continue;
			}
			if ( '' !== $meal_type && $meal_type !== (string) ( $recipe['meal_type'] ?? '' ) ) {
				continue;
			}

			return $recipe;
		}

		return [];
	}

	private static function sanitize_meal_type_value( string $meal_type, bool $default_to_lunch = true ): string {
		$meal_type = sanitize_key( $meal_type );
		if ( in_array( $meal_type, [ 'breakfast', 'lunch', 'dinner', 'snack', 'beverage' ], true ) ) {
			return $meal_type;
		}

		return $default_to_lunch ? 'lunch' : '';
	}
}
