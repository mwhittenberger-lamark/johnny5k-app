<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\BodyMetricsController;
use Johnny5k\REST\DashboardController;
use Johnny5k\REST\IronQuestController;
use Johnny5k\REST\NutritionController;
use Johnny5k\REST\NutritionRecipeController;
use Johnny5k\REST\OnboardingController;
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
			'get_grocery_gap'            => self::tool_grocery_gap( $user_id, $deps ),
			'get_recipe_catalog'         => self::tool_recipe_catalog( $user_id, $arguments ),
			'get_recipe_cookbook'        => self::tool_recipe_cookbook( $user_id, $arguments ),
			'get_recovery_snapshot'      => self::tool_recovery_snapshot( $user_id ),
			'get_weight_history'         => self::tool_weight_history( $user_id ),
			'get_current_workout'        => self::tool_current_workout( $user_id, $deps ),
			'get_saved_workouts'         => self::tool_saved_workouts( $arguments, $deps ),
			'present_choices'            => self::tool_present_choices( $arguments ),
			'create_visualization'       => self::tool_create_visualization( $arguments ),
			'set_ambient_color'          => self::tool_set_ambient_color( $arguments ),
			'activate_fire_mode'         => self::tool_activate_fire_mode(),
			'trigger_confetti_burst'     => self::tool_trigger_confetti_burst(),
			'set_text_size'              => self::tool_set_text_size( $arguments ),
			'search_gif'                 => self::tool_search_gif( $arguments ),
			'generate_image'              => JohnnyGeneratedImageService::generate( $user_id, $arguments ),
			'log_steps'                  => self::tool_log_steps( $user_id, $arguments, $deps ),
			'log_food_from_description'  => self::tool_log_food_from_description( $user_id, $arguments, $deps ),
			'create_food_tile'            => self::tool_create_food_tile( $user_id, $arguments, $deps ),
			'create_training_plan'       => self::tool_create_training_plan( $user_id, $arguments ),
			'set_training_schedule'      => self::tool_set_training_schedule( $user_id, $arguments, $deps ),
			'create_custom_workout'      => self::tool_create_custom_workout( $user_id, $arguments ),
			'create_personal_exercise'   => self::tool_create_personal_exercise( $user_id, $arguments, $deps ),
			'save_workout_to_library'   => self::tool_save_workout_to_library( $user_id, $arguments, $deps ),
			'load_saved_workout'         => self::tool_load_saved_workout( $user_id, $arguments ),
			'remove_saved_workout'       => self::tool_remove_saved_workout( $user_id, $arguments, $deps ),
			'log_sleep'                  => self::tool_log_sleep( $user_id, $arguments, $deps ),
			'log_cardio'                 => self::tool_log_cardio( $user_id, $arguments, $deps ),
			'log_rest_day'               => self::tool_log_rest_day( $user_id, $deps ),
			'approve_workout'             => self::tool_approve_workout( $user_id, $deps ),
			'search_exercises'            => self::tool_search_exercises( $arguments, $deps ),
			'modify_workout'              => self::tool_modify_workout( $user_id, $arguments, $deps ),
			'start_workout'               => self::tool_start_workout( $user_id, $arguments, $deps ),
			'activate_ironquest_mission'  => self::tool_activate_ironquest_mission( $user_id, $arguments, $deps ),
			'manage_workout_set'          => self::tool_manage_workout_set( $arguments, $deps ),
			'cancel_workout'              => self::tool_cancel_workout( $user_id, $deps ),
			'restart_workout_timer'       => self::tool_restart_workout_timer( $deps ),
			'complete_workout'            => self::tool_complete_workout( $deps ),
			'log_body_measurement'        => self::tool_log_body_measurement( $arguments, $deps ),
			'manage_health_log'           => self::tool_manage_health_log( $arguments, $deps ),
			'log_water'                   => self::tool_log_water( $arguments, $deps ),
			'manage_meal'                 => self::tool_manage_meal( $arguments, $deps ),
			'manage_saved_meal'           => self::tool_manage_saved_meal( $arguments, $deps ),
			'update_goals'                => self::tool_update_goals( $user_id, $arguments, $deps ),
			'update_profile'              => self::tool_update_profile( $arguments, $deps ),
			'update_personality_settings' => self::tool_update_personality_settings( $user_id, $arguments, $deps ),
			'add_pantry_items'           => self::tool_add_pantry_items( $user_id, $arguments, $deps ),
			'remove_pantry_items'        => self::tool_remove_pantry_items( $user_id, $arguments ),
			'add_grocery_gap_items'      => self::tool_add_grocery_gap_items( $user_id, $arguments, $deps ),
			'add_recipe_ingredients_to_grocery_list' => self::tool_add_recipe_ingredients_to_grocery_list( $user_id, $arguments, $deps ),
			'remove_grocery_gap_items'   => self::tool_remove_grocery_gap_items( $user_id, $arguments ),
			'add_recipe_to_cookbook'     => self::tool_add_recipe_to_cookbook( $user_id, $arguments ),
			'swap_workout_exercise'      => self::tool_swap_workout_exercise( $user_id, $arguments, $deps ),
			'schedule_sms_reminder'      => self::tool_schedule_sms_reminder( $user_id, $arguments, $deps ),
			'clear_follow_ups'          => self::tool_clear_follow_ups( $user_id, $arguments, $deps ),
			'clear_conversation'        => self::tool_clear_conversation(),
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

	private static function tool_clear_conversation(): array {
		return [
			'ok'      => true,
			'action'  => 'clear_conversation',
			'summary' => 'Chat cleared.',
		];
	}

	private static function tool_set_ambient_color( array $arguments ): array {
		$allowed = [ 'default', 'green', 'violet', 'rose', 'amber', 'dance' ];
		$color   = sanitize_key( (string) ( $arguments['color'] ?? 'default' ) );
		if ( ! in_array( $color, $allowed, true ) ) {
			$color = 'default';
		}

		$summary = match ( $color ) {
			'default' => 'Back to the default look.',
			'dance'   => 'Kicking off a little celebration light show.',
			default   => "Switched the vibe to {$color}.",
		};

		return [
			'ok'      => true,
			'action'  => 'set_ambient_color',
			'color'   => $color,
			'summary' => $summary,
		];
	}

	private static function tool_trigger_confetti_burst(): array {
		return [
			'ok'      => true,
			'action'  => 'trigger_confetti_burst',
			'summary' => 'Confetti time!',
		];
	}

	private static function tool_set_text_size( array $arguments ): array {
		$allowed = [ 'default', 'large' ];
		$size    = sanitize_key( (string) ( $arguments['size'] ?? 'default' ) );
		if ( ! in_array( $size, $allowed, true ) ) {
			$size = 'default';
		}

		return [
			'ok'      => true,
			'action'  => 'set_text_size',
			'size'    => $size,
			'summary' => 'large' === $size ? 'Bumped up the text size.' : 'Text size back to normal.',
		];
	}

	private static function tool_activate_fire_mode(): array {
		return [
			'ok'      => true,
			'action'  => 'activate_fire_mode',
			'summary' => 'Lighting it up!',
		];
	}

	private static function tool_search_gif( array $arguments ): array {
		$query = trim( sanitize_text_field( (string) ( $arguments['query'] ?? '' ) ) );
		if ( '' === $query ) {
			return [ 'error' => 'A search query is required.' ];
		}

		$api_key = trim( (string) get_option( 'jf_giphy_api_key', '' ) );
		if ( '' === $api_key ) {
			return [ 'error' => 'GIF search is not configured yet.' ];
		}

		$endpoint = add_query_arg(
			[
				'api_key' => $api_key,
				'q'       => $query,
				'limit'   => 1,
				'rating'  => 'g',
				'lang'    => 'en',
			],
			'https://api.giphy.com/v1/gifs/search'
		);

		$response = wp_remote_get( $endpoint, [ 'timeout' => 8 ] );
		if ( is_wp_error( $response ) ) {
			return [ 'error' => 'Could not reach GIPHY: ' . $response->get_error_message() ];
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( 200 !== $code || ! is_array( $body ) ) {
			return [ 'error' => 'GIPHY search failed.' ];
		}

		$result = $body['data'][0] ?? null;
		if ( ! is_array( $result ) ) {
			return [ 'error' => 'No GIF found for that search.' ];
		}

		$images      = is_array( $result['images'] ?? null ) ? $result['images'] : [];
		$gif_url     = (string) ( $images['original']['url'] ?? '' );
		$preview_url = (string) ( $images['fixed_height_small']['url'] ?? $images['downsized']['url'] ?? $gif_url );
		if ( '' === $gif_url ) {
			return [ 'error' => 'That GIF result had no playable format.' ];
		}

		return [
			'action'      => 'search_gif',
			'query'       => $query,
			'gif_url'     => esc_url_raw( $gif_url ),
			'preview_url' => esc_url_raw( $preview_url ),
			'page_url'    => esc_url_raw( (string) ( $result['url'] ?? '' ) ),
			'title'       => sanitize_text_field( (string) ( $result['title'] ?? $query ) ),
			'summary'     => 'Found a GIF for that.',
		];
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

	private static function body_log_cardio( array $deps, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps['body_log_cardio'] ?? null;
		if ( is_callable( $callable ) ) {
			$response = $callable( $request );
			if ( $response instanceof \WP_REST_Response ) {
				return $response;
			}
		}

		return BodyMetricsController::log_cardio( $request );
	}

	private static function workout_start( array $deps, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps['workout_start'] ?? null;
		if ( is_callable( $callable ) ) {
			$response = $callable( $request );
			if ( $response instanceof \WP_REST_Response ) {
				return $response;
			}
		}

		return WorkoutController::start( $request );
	}

	private static function workout_complete( array $deps, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps['workout_complete'] ?? null;
		if ( is_callable( $callable ) ) {
			$response = $callable( $request );
			if ( $response instanceof \WP_REST_Response ) {
				return $response;
			}
		}

		return WorkoutController::complete_session( $request );
	}

	private static function daily_snapshot( int $user_id, array $deps ): array {
		$callable = $deps['daily_snapshot'] ?? null;
		if ( is_callable( $callable ) ) {
			$snapshot = $callable( $user_id );
			return is_array( $snapshot ) ? $snapshot : [];
		}

		return DashboardController::get_daily_snapshot_data( $user_id );
	}

	private static function today( int $user_id, array $deps ): string {
		$callable = $deps['today'] ?? null;
		return is_callable( $callable ) ? (string) $callable( $user_id ) : UserTime::today( $user_id );
	}

	private static function rest_call( array $deps, string $key, callable $fallback, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps[ $key ] ?? null;
		$response = is_callable( $callable ) ? $callable( $request ) : $fallback( $request );
		return $response instanceof \WP_REST_Response ? $response : new \WP_REST_Response( [ 'message' => 'Invalid service response.' ], 500 );
	}

	private static function rest_result( \WP_REST_Response $response, string $action, string $failure ): array {
		$data = $response->get_data();
		if ( (int) $response->get_status() >= 400 ) {
			return [ 'error' => (string) ( is_array( $data ) ? ( $data['message'] ?? $failure ) : $failure ) ];
		}
		return [ 'ok' => true, 'action' => $action, 'data' => $data ];
	}

	private static function onboarding_update_training_schedule( array $deps, \WP_REST_Request $request ): \WP_REST_Response {
		$callable = $deps['onboarding_update_training_schedule'] ?? null;
		if ( is_callable( $callable ) ) {
			$response = $callable( $request );
			if ( $response instanceof \WP_REST_Response ) {
				return $response;
			}
		}

		return OnboardingController::update_training_schedule( $request );
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_profile_summary( int $user_id, array $deps ): array {
		$result = self::dep( $deps, 'profile_summary', $user_id );
		return is_array( $result ) ? $result : [];
	}

	private static function tool_create_visualization( array $arguments ): array {
		$type = sanitize_key( (string) ( $arguments['type'] ?? '' ) );
		if ( ! in_array( $type, [ 'line', 'bar', 'progress', 'comparison', 'infographic' ], true ) ) {
			return [ 'error' => 'Choose a supported visualization type.' ];
		}

		$title = sanitize_text_field( (string) ( $arguments['title'] ?? '' ) );
		$raw_items = is_array( $arguments['items'] ?? null ) ? array_slice( $arguments['items'], 0, 12 ) : [];
		$items = [];
		foreach ( $raw_items as $raw_item ) {
			if ( ! is_array( $raw_item ) ) {
				continue;
			}
			$label = sanitize_text_field( (string) ( $raw_item['label'] ?? '' ) );
			if ( '' === $label ) {
				continue;
			}
			$item = [
				'label'  => $label,
				'detail' => sanitize_text_field( (string) ( $raw_item['detail'] ?? '' ) ),
			];
			if ( isset( $raw_item['value'] ) && is_numeric( $raw_item['value'] ) ) {
				$item['value'] = round( (float) $raw_item['value'], 2 );
			}
			if ( isset( $raw_item['secondary_value'] ) && is_numeric( $raw_item['secondary_value'] ) ) {
				$item['secondary_value'] = round( (float) $raw_item['secondary_value'], 2 );
			}
			$items[] = $item;
		}

		if ( '' === $title || empty( $items ) ) {
			return [ 'error' => 'A visualization needs a title and at least one labeled item.' ];
		}

		$result = [
			'action'       => 'create_visualization',
			'type'         => $type,
			'title'        => $title,
			'subtitle'     => sanitize_text_field( (string) ( $arguments['subtitle'] ?? '' ) ),
			'unit'         => sanitize_text_field( (string) ( $arguments['unit'] ?? '' ) ),
			'source_label' => sanitize_text_field( (string) ( $arguments['source_label'] ?? '' ) ),
			'items'        => $items,
			'summary'      => sprintf( 'Created %s.', $title ),
		];

		if ( isset( $arguments['target'] ) && is_numeric( $arguments['target'] ) ) {
			$result['target'] = round( (float) $arguments['target'], 2 );
		}

		return $result;
	}

	private static function tool_present_choices( array $arguments ): array {
		$allowed_routes = [ '/dashboard', '/workout', '/workout/library', '/nutrition', '/body', '/settings' ];
		$raw_choices = is_array( $arguments['choices'] ?? null ) ? array_slice( $arguments['choices'], 0, 4 ) : [];
		$choices = [];

		foreach ( $raw_choices as $raw_choice ) {
			if ( ! is_array( $raw_choice ) ) {
				continue;
			}

			$label = substr( sanitize_text_field( (string) ( $raw_choice['label'] ?? '' ) ), 0, 48 );
			$type = sanitize_key( (string) ( $raw_choice['type'] ?? 'reply' ) );
			$emphasis = 'primary' === sanitize_key( (string) ( $raw_choice['emphasis'] ?? '' ) ) ? 'primary' : 'secondary';
			if ( '' === $label || ! in_array( $type, [ 'reply', 'navigate' ], true ) ) {
				continue;
			}

			$choice = [
				'label'    => $label,
				'type'     => $type,
				'emphasis' => $emphasis,
			];
			if ( 'reply' === $type ) {
				$response = substr( sanitize_textarea_field( (string) ( $raw_choice['response'] ?? '' ) ), 0, 500 );
				if ( '' === $response ) {
					continue;
				}
				$choice['response'] = $response;
			} else {
				$route = '/' . ltrim( sanitize_text_field( (string) ( $raw_choice['route'] ?? '' ) ), '/' );
				if ( ! in_array( $route, $allowed_routes, true ) ) {
					continue;
				}
				$choice['route'] = $route;
			}

			$choices[] = $choice;
		}

		if ( count( $choices ) < 2 ) {
			return [ 'error' => 'A decision rail needs at least two valid choices.' ];
		}

		return [
			'action'  => 'present_choices',
			'prompt'  => substr( sanitize_text_field( (string) ( $arguments['prompt'] ?? '' ) ), 0, 120 ),
			'style'   => 'actions' === sanitize_key( (string) ( $arguments['style'] ?? '' ) ) ? 'actions' : 'chips',
			'choices' => $choices,
			'summary' => 'Presented the next choices.',
		];
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

	private static function tool_weight_history( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT starting_weight_lb FROM {$p}fit_user_profiles WHERE user_id = %d LIMIT 1",
			$user_id
		) );
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT goal_type, target_weight_lb FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, metric_date, weight_lb, waist_in, body_fat_pct, resting_hr, notes
			 FROM {$p}fit_body_metrics
			 WHERE user_id = %d
			 ORDER BY metric_date ASC, id ASC",
			$user_id
		) );

		$measurements = array_map( static function( object $row ): array {
			return [
				'id'           => (int) ( $row->id ?? 0 ),
				'metric_date'  => sanitize_text_field( (string) ( $row->metric_date ?? '' ) ),
				'weight_lb'    => isset( $row->weight_lb ) ? round( (float) $row->weight_lb, 2 ) : null,
				'waist_in'     => isset( $row->waist_in ) ? round( (float) $row->waist_in, 2 ) : null,
				'body_fat_pct' => isset( $row->body_fat_pct ) ? round( (float) $row->body_fat_pct, 2 ) : null,
				'resting_hr'   => isset( $row->resting_hr ) ? (int) $row->resting_hr : null,
				'notes'        => sanitize_text_field( (string) ( $row->notes ?? '' ) ),
			];
		}, is_array( $rows ) ? $rows : [] );
		$measurements = array_values( array_filter( $measurements, static fn( array $row ): bool => '' !== $row['metric_date'] ) );
		$weight_measurements = array_values( array_filter( $measurements, static fn( array $row ): bool => null !== $row['weight_lb'] ) );

		$first = $weight_measurements[0] ?? [];
		$latest = ! empty( $weight_measurements ) ? $weight_measurements[ count( $weight_measurements ) - 1 ] : [];
		$profile_start = isset( $profile->starting_weight_lb ) ? (float) $profile->starting_weight_lb : 0.0;
		$baseline_weight = $profile_start > 0 ? $profile_start : (float) ( $first['weight_lb'] ?? 0 );
		$latest_weight = (float) ( $latest['weight_lb'] ?? 0 );
		$target_weight = isset( $goal->target_weight_lb ) ? (float) $goal->target_weight_lb : 0.0;
		$total_change = $baseline_weight > 0 && $latest_weight > 0 ? round( $latest_weight - $baseline_weight, 2 ) : null;
		$remaining_to_goal = $target_weight > 0 && $latest_weight > 0 ? round( $latest_weight - $target_weight, 2 ) : null;
		$first_timestamp = ! empty( $first['metric_date'] ) ? strtotime( (string) $first['metric_date'] ) : false;
		$latest_timestamp = ! empty( $latest['metric_date'] ) ? strtotime( (string) $latest['metric_date'] ) : false;
		$days_spanned = false !== $first_timestamp && false !== $latest_timestamp ? max( 0, (int) floor( ( $latest_timestamp - $first_timestamp ) / DAY_IN_SECONDS ) ) : 0;
		$goal_distance = $baseline_weight > 0 && $target_weight > 0 ? abs( $baseline_weight - $target_weight ) : 0.0;
		$progress_distance = $target_weight < $baseline_weight ? $baseline_weight - $latest_weight : $latest_weight - $baseline_weight;
		$goal_progress = $goal_distance > 0 && $latest_weight > 0 ? round( max( 0, min( 100, ( $progress_distance / $goal_distance ) * 100 ) ), 1 ) : null;
		$weekly_change = null !== $total_change && $days_spanned > 0 ? round( ( $total_change / $days_spanned ) * 7, 2 ) : null;

		$result = [
			'measurement_count'        => count( $measurements ),
			'weight_measurement_count' => count( $weight_measurements ),
			'measurements'             => $measurements,
			'goal_type'                => sanitize_key( (string) ( $goal->goal_type ?? '' ) ),
			'starting_weight_lb'       => $baseline_weight > 0 ? round( $baseline_weight, 2 ) : null,
			'target_weight_lb'         => $target_weight > 0 ? round( $target_weight, 2 ) : null,
			'latest_weight_lb'         => $latest_weight > 0 ? round( $latest_weight, 2 ) : null,
			'latest_metric_date'       => sanitize_text_field( (string) ( $latest['metric_date'] ?? '' ) ),
			'total_change_lb'          => $total_change,
			'weight_lost_lb'           => null !== $total_change ? max( 0, round( -$total_change, 2 ) ) : null,
			'average_weekly_change_lb' => $weekly_change,
			'remaining_to_goal_lb'     => $remaining_to_goal,
			'goal_progress_pct'        => $goal_progress,
			'days_spanned'             => $days_spanned,
		];

		if ( count( $weight_measurements ) >= 2 ) {
			$chart_measurements = self::sample_weight_chart_measurements( $weight_measurements, 12 );
			$result = array_merge( $result, [
				'action'       => 'create_visualization',
				'type'         => 'line',
				'title'        => 'Weight Progress',
				'subtitle'     => sprintf( '%d weigh-ins across %d days', count( $weight_measurements ), $days_spanned ),
				'unit'         => 'lb',
				'source_label' => 'Body check-ins',
				'items'        => array_map( static fn( array $row ): array => [
					'label' => (string) $row['metric_date'],
					'value' => (float) $row['weight_lb'],
				], $chart_measurements ),
				'summary'      => 'Created a weight progress chart from the complete weight history.',
			] );
		}

		return $result;
	}

	private static function sample_weight_chart_measurements( array $measurements, int $maximum ): array {
		$count = count( $measurements );
		if ( $count <= $maximum ) {
			return array_values( $measurements );
		}

		$sampled = [];
		for ( $position = 0; $position < $maximum; $position++ ) {
			$index = (int) round( $position * ( $count - 1 ) / ( $maximum - 1 ) );
			$sampled[ $index ] = $measurements[ $index ];
		}

		return array_values( $sampled );
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
		$queued_workout    = is_array( $workout['custom_workout_draft'] ?? null ) ? $workout['custom_workout_draft'] : [];
		$workout_approval  = is_array( $workout['workout_approval'] ?? null ) ? $workout['workout_approval'] : [];
		$today_payload     = self::dep( $deps, 'latest_workout_session_for_date', $user_id, self::today( $user_id, $deps ) );
		$today_session     = is_array( $today_payload['session'] ?? null ) ? $today_payload['session'] : $active_session;
		$today_exercises   = is_array( $today_payload['exercises'] ?? null ) ? $today_payload['exercises'] : $active_exercises;
		$last_completed    = self::dep( $deps, 'latest_completed_workout_session', $user_id );
		$daily_snapshot    = $deps['daily_snapshot'] ?? null;
		$snapshot          = is_callable( $daily_snapshot ) ? $daily_snapshot( $user_id ) : DashboardController::get_daily_snapshot_data( $user_id );
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
			'queued_workout'            => $queued_workout,
			'has_queued_workout'        => ! empty( $queued_workout['id'] ),
			'workout_approval'          => $workout_approval,
			'queued_workout_is_approved' => ! empty( $queued_workout['id'] ) && (string) ( $workout_approval['workout_id'] ?? '' ) === (string) $queued_workout['id'],
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

	private static function tool_create_food_tile( int $user_id, array $arguments, array $deps ): array {
		$food_text = trim( sanitize_textarea_field( (string) ( $arguments['food_text'] ?? '' ) ) );
		if ( '' === $food_text ) return [ 'error' => 'Describe the food tile to create.' ];

		$analysis = self::dep( $deps, 'analyse_food_text', $user_id, $food_text );
		if ( is_wp_error( $analysis ) ) return [ 'error' => $analysis->get_error_message() ];
		$analysis = is_array( $analysis ) ? $analysis : [];
		$value = static fn( string $key, string $analysis_key, mixed $fallback = 0 ): mixed => array_key_exists( $key, $arguments ) ? $arguments[ $key ] : ( $analysis[ $analysis_key ] ?? $fallback );
		$name = sanitize_text_field( (string) $value( 'name', 'food_name', 'Food tile' ) );
		$serving = sanitize_text_field( (string) $value( 'serving_size', 'serving_size', '1 serving' ) );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/saved-foods' );
		$request->set_param( 'canonical_name', $name ?: 'Food tile' );
		$request->set_param( 'brand', sanitize_text_field( (string) ( $arguments['brand'] ?? $analysis['brand'] ?? '' ) ) );
		$request->set_param( 'serving_size', $serving ?: '1 serving' );
		$request->set_param( 'calories', max( 0, (int) $value( 'calories', 'calories' ) ) );
		foreach ( [ 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg' ] as $field ) {
			$request->set_param( $field, max( 0, (float) $value( $field, $field ) ) );
		}
		$request->set_param( 'micros', (array) ( $analysis['micros'] ?? [] ) );
		$request->set_param( 'source', 'ai_tile' );
		if ( ! empty( $arguments['category'] ) ) {
			$request->set_param( 'category', sanitize_key( (string) $arguments['category'] ) );
		}

		$result = self::rest_result( self::rest_call( $deps, 'nutrition_create_saved_food', [ NutritionController::class, 'create_saved_food' ], $request ), 'create_food_tile', 'Could not create that food tile.' );
		if ( empty( $result['ok'] ) ) return $result;
		$result['tile_id'] = (int) ( $result['data']['id'] ?? 0 );
		$result['name'] = $name;
		$result['serving_size'] = $serving;
		$result['calories'] = (int) $request->get_param( 'calories' );
		$result['protein_g'] = (float) $request->get_param( 'protein_g' );
		$result['carbs_g'] = (float) $request->get_param( 'carbs_g' );
		$result['fat_g'] = (float) $request->get_param( 'fat_g' );
		$result['summary'] = sprintf( 'Created a reusable %s tile: %s, %d calories, %sg protein, %sg carbs, and %sg fat.', $name, $serving, $result['calories'], $result['protein_g'], $result['carbs_g'], $result['fat_g'] );
		return $result;
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

	private static function tool_set_training_schedule( int $user_id, array $arguments = [], array $deps = [] ): array {
		$raw_schedule = $arguments['preferred_workout_days_json']
			?? $arguments['weekly_schedule']
			?? $arguments['week_split']
			?? $arguments['schedule']
			?? [];

		$schedule = self::normalize_tool_training_schedule_payload( $raw_schedule );

		if ( empty( $schedule ) ) {
			return [ 'error' => 'A weekly training schedule is required.' ];
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/onboarding/training-schedule' );
		$request->set_param( 'preferred_workout_days_json', $schedule );

		$previous_user_id = (int) get_current_user_id();
		$GLOBALS['johnny5k_test_current_user_id'] = $user_id;

		try {
			$response = self::onboarding_update_training_schedule( $deps, $request );
		} finally {
			$GLOBALS['johnny5k_test_current_user_id'] = $previous_user_id;
		}

		$data   = $response->get_data();
		$status = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not update the training schedule.' ) ];
		}

		$week_split  = array_values( array_filter( is_array( $data['week_split'] ?? null ) ? $data['week_split'] : [], static fn( $entry ): bool => is_array( $entry ) || is_object( $entry ) ) );
		$active_days = array_values( array_filter( $week_split, static function( $entry ): bool {
			$day_type = is_array( $entry ) ? (string) ( $entry['day_type'] ?? '' ) : (string) ( $entry->day_type ?? '' );
			return 'rest' !== $day_type;
		} ) );
		$day_labels = array_values( array_filter( array_map( static function( $entry ): string {
			$day_type = is_array( $entry ) ? (string) ( $entry['day_type'] ?? '' ) : (string) ( $entry->day_type ?? '' );
			if ( 'rest' === $day_type ) {
				return '';
			}

			$weekday_label = is_array( $entry ) ? (string) ( $entry['weekday_label'] ?? '' ) : (string) ( $entry->weekday_label ?? '' );
			$label         = TrainingDayTypes::label( $day_type );
			return '' !== $weekday_label ? sprintf( '%s %s', $weekday_label, $label ) : $label;
		}, $active_days ) ) );

		$summary = 'Johnny updated your weekly training schedule.';
		if ( ! empty( $day_labels ) ) {
			$summary = sprintf( 'Johnny updated your weekly training schedule to %s.', implode( ', ', $day_labels ) );
		}

		return [
			'ok'                => true,
			'action'            => 'set_training_schedule',
			'saved'             => ! empty( $data['saved'] ),
			'week_split'        => $week_split,
			'active_day_count'  => count( $active_days ),
			'active_day_labels' => $day_labels,
			'summary'           => $summary,
		];
	}

	private static function normalize_tool_training_schedule_payload( $raw_schedule ): array {
		if ( ! is_array( $raw_schedule ) ) {
			return [];
		}

		$is_string_schedule = ! empty( $raw_schedule ) && is_string( $raw_schedule[0] ?? null );
		if ( $is_string_schedule ) {
			$days = array_values( array_filter( array_map( [ __CLASS__, 'normalize_tool_schedule_weekday' ], $raw_schedule ) ) );
			return self::build_default_tool_schedule_entries( $days );
		}

		$entries = [];
		foreach ( $raw_schedule as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}

			$day = self::normalize_tool_schedule_weekday(
				(string) ( $entry['day'] ?? $entry['weekday'] ?? $entry['weekday_label'] ?? '' )
			);
			if ( '' === $day ) {
				continue;
			}

			$entries[ $day ] = [
				'day'      => $day,
				'day_type' => self::normalize_tool_schedule_day_type( $entry['day_type'] ?? $entry['type'] ?? $entry['split'] ?? $entry['training_type'] ?? '' ),
			];
		}

		if ( empty( $entries ) ) {
			return [];
		}

		$days           = array_keys( $entries );
		$default_cycle  = TrainingDayTypes::default_cycle();
		$cycle_position = 0;

		usort( $days, [ __CLASS__, 'sort_tool_schedule_weekdays' ] );

		$normalized = [];
		foreach ( $days as $day ) {
			$day_type = (string) ( $entries[ $day ]['day_type'] ?? '' );
			if ( '' === $day_type ) {
				$day_type = $default_cycle[ min( $cycle_position, count( $default_cycle ) - 1 ) ];
			}

			$normalized[] = [
				'day'      => $day,
				'day_type' => $day_type,
			];
			$cycle_position += 1;
		}

		return $normalized;
	}

	private static function build_default_tool_schedule_entries( array $days ): array {
		$days = array_values( array_unique( array_filter( $days ) ) );
		if ( empty( $days ) ) {
			return [];
		}

		usort( $days, [ __CLASS__, 'sort_tool_schedule_weekdays' ] );
		$default_cycle = TrainingDayTypes::default_cycle();
		$result        = [];

		foreach ( array_values( $days ) as $index => $day ) {
			$result[] = [
				'day'      => $day,
				'day_type' => $default_cycle[ min( $index, count( $default_cycle ) - 1 ) ],
			];
		}

		return $result;
	}

	private static function normalize_tool_schedule_weekday( $value ): string {
		$weekday = sanitize_key( strtolower( trim( (string) $value ) ) );

		return match ( $weekday ) {
			'mon', 'monday' => 'Mon',
			'tue', 'tues', 'tuesday' => 'Tue',
			'wed', 'wednesday' => 'Wed',
			'thu', 'thurs', 'thursday' => 'Thu',
			'fri', 'friday' => 'Fri',
			'sat', 'saturday' => 'Sat',
			'sun', 'sunday' => 'Sun',
			default => '',
		};
	}

	private static function normalize_tool_schedule_day_type( $value ): string {
		return TrainingDayTypes::normalize( $value ) ?? '';
	}

	private static function sort_tool_schedule_weekdays( string $left, string $right ): int {
		static $order = [
			'Mon' => 1,
			'Tue' => 2,
			'Wed' => 3,
			'Thu' => 4,
			'Fri' => 5,
			'Sat' => 6,
			'Sun' => 7,
		];

		return ( $order[ $left ] ?? 99 ) <=> ( $order[ $right ] ?? 99 );
	}

	private static function tool_create_custom_workout( int $user_id, array $arguments = [] ): array {
		$name           = sanitize_text_field( (string) ( $arguments['name'] ?? '' ) );
		$exercise_names = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $arguments['exercise_names'] ?? [] ) ) ) );
		$exercises      = is_array( $arguments['exercises'] ?? null ) ? array_values( $arguments['exercises'] ) : [];
		$time_tier      = self::normalize_time_tier( (string) ( $arguments['time_tier'] ?? '' ) );

		if ( '' === $name ) {
			return [ 'error' => 'A custom workout name is required.' ];
		}
		if ( empty( $exercises ) && empty( $exercise_names ) ) {
			return [ 'error' => 'At least one exercise name is required to build a custom workout.' ];
		}
		if ( empty( $exercises ) ) {
			$exercises = array_map( static fn( string $exercise_name ): array => [
				'exercise_name' => $exercise_name,
				'target_type' => 'reps',
			], $exercise_names );
		}

		$created_exercise_names = [];
		foreach ( $exercises as &$exercise ) {
			$exercise = is_array( $exercise ) ? $exercise : (array) $exercise;
			$exercise_name = sanitize_text_field( (string) ( $exercise['exercise_name'] ?? '' ) );
			if ( '' === $exercise_name ) {
				continue;
			}
			$existing = ExerciseLibraryService::find_accessible_exercise_by_name( $user_id, $exercise_name );
			if ( $existing ) {
				$exercise['exercise_id'] = (int) $existing->id;
				continue;
			}

			$metadata = self::infer_custom_exercise_metadata( $exercise_name, (string) ( $arguments['day_type'] ?? '' ) );
			$created = ExerciseLibraryService::create_personal_exercise( $user_id, array_merge( $metadata, [
				'name' => $exercise_name,
				'default_rep_min' => max( 1, (int) ( $exercise['target_reps'] ?? $exercise['target_rep_min'] ?? 8 ) ),
				'default_rep_max' => max( 1, (int) ( $exercise['target_reps'] ?? $exercise['target_rep_max'] ?? 12 ) ),
				'default_sets' => max( 1, (int) ( $exercise['sets'] ?? 1 ) ),
			] ) );
			if ( is_wp_error( $created ) ) {
				return [ 'error' => sprintf( 'Could not resolve or create %s: %s', $exercise_name, $created->get_error_message() ) ];
			}
			$exercise['exercise_id'] = (int) ( $created['id'] ?? 0 );
			if ( ! empty( $created['created'] ) ) {
				$created_exercise_names[] = $exercise_name;
			}
		}
		unset( $exercise );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/custom-draft' );
		$day_type = sanitize_text_field( (string) ( $arguments['day_type'] ?? TrainingDayTypes::custom_workout_fallback() ) );
		if ( 'rest' === sanitize_key( $day_type ) && ! empty( $exercises ) ) {
			$day_type = TrainingDayTypes::custom_workout_fallback();
		}
		$request->set_param( 'name', $name );
		$request->set_param( 'day_type', $day_type );
		if ( '' !== $time_tier ) {
			$request->set_param( 'time_tier', $time_tier );
		}
		$request->set_param( 'coach_note', sanitize_textarea_field( (string) ( $arguments['coach_note'] ?? '' ) ) );
		$request->set_param( 'workout_structure', 'circuit' === sanitize_key( (string) ( $arguments['workout_structure'] ?? '' ) ) ? 'circuit' : 'standard' );
		$request->set_param( 'rounds', max( 1, min( 20, (int) ( $arguments['rounds'] ?? 1 ) ) ) );
		foreach ( [ 'rest_between_exercises_seconds', 'rest_between_rounds_seconds', 'interpretation_notes' ] as $field ) {
			if ( array_key_exists( $field, $arguments ) ) {
				$request->set_param( $field, $arguments[ $field ] );
			}
		}
		if ( ! empty( $created_exercise_names ) ) {
			$notes = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $arguments['interpretation_notes'] ?? [] ) ) ) );
			$notes[] = 'Added missing exercises to your personal library: ' . implode( ', ', $created_exercise_names ) . '.';
			$request->set_param( 'interpretation_notes', $notes );
		}
		$request->set_param( 'exercises', $exercises );

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
			'workout_structure' => sanitize_key( (string) ( $draft['workout_structure'] ?? 'standard' ) ),
			'rounds'            => (int) ( $draft['rounds'] ?? 1 ),
			'exercise_count'    => $exercise_count,
			'exercise_names'    => array_values( array_filter( array_map( static fn( array $item ): string => sanitize_text_field( (string) ( $item['exercise_name'] ?? '' ) ), is_array( $draft['exercises'] ?? null ) ? $draft['exercises'] : [] ) ) ),
			'coach_note'        => sanitize_textarea_field( (string) ( $draft['coach_note'] ?? '' ) ),
			'summary'           => sprintf( 'Queued %s as a custom %s workout with %d exercises on the workout page.', (string) ( $draft['name'] ?? $name ), str_replace( '_', ' ', $day_type ), $exercise_count ),
		];
	}

	private static function infer_custom_exercise_metadata( string $name, string $day_type ): array {
		$key = strtolower( $name );
		$primary_muscle = 'full_body';
		$movement_pattern = 'other';
		$equipment = 'bodyweight';
		$slot_type = 'accessory';

		if ( str_contains( $key, 'tricep' ) || str_contains( $key, 'pushdown' ) || str_contains( $key, 'pressdown' ) ) {
			$primary_muscle = 'triceps';
			$movement_pattern = 'elbow_extension';
		} elseif ( str_contains( $key, 'shoulder press' ) || str_contains( $key, 'overhead press' ) ) {
			$primary_muscle = 'shoulders';
			$movement_pattern = 'vertical_push';
			$slot_type = 'main';
		} elseif ( str_contains( $key, 'lateral raise' ) || str_contains( $key, 'front raise' ) ) {
			$primary_muscle = 'shoulders';
			$movement_pattern = 'shoulder_abduction';
		} elseif ( str_contains( $key, 'chest fly' ) || str_contains( $key, 'chest flye' ) || str_contains( $key, 'pec deck' ) ) {
			$primary_muscle = 'chest';
			$movement_pattern = 'horizontal_adduction';
		} elseif ( str_contains( $key, 'push-up' ) || str_contains( $key, 'pushup' ) || str_contains( $key, 'bench press' ) || str_contains( $key, 'chest press' ) ) {
			$primary_muscle = 'chest';
			$movement_pattern = 'horizontal_push';
			$slot_type = 'main';
		} elseif ( str_contains( $key, 'row' ) ) {
			$primary_muscle = 'back';
			$movement_pattern = 'pull';
			$slot_type = 'main';
		} elseif ( str_contains( $key, 'pulldown' ) || str_contains( $key, 'pull-up' ) || str_contains( $key, 'pullup' ) ) {
			$primary_muscle = 'back';
			$movement_pattern = 'vertical_pull';
			$slot_type = 'main';
		} elseif ( str_contains( $key, 'squat' ) || str_contains( $key, 'lunge' ) || str_contains( $key, 'leg press' ) ) {
			$primary_muscle = 'quads';
			$movement_pattern = 'squat';
			$slot_type = 'main';
		} elseif ( str_contains( $key, 'deadlift' ) || str_contains( $key, 'romanian' ) || preg_match( '/\brdl\b/', $key ) ) {
			$primary_muscle = 'hamstrings';
			$movement_pattern = 'hinge';
			$slot_type = 'main';
		} elseif ( str_contains( $key, 'curl' ) ) {
			$primary_muscle = 'biceps';
			$movement_pattern = 'elbow_flexion';
		} elseif ( str_contains( $key, 'plank' ) || str_contains( $key, 'crunch' ) || str_contains( $key, 'core' ) ) {
			$primary_muscle = 'core';
			$movement_pattern = 'core';
			$slot_type = 'abs';
		}
		if ( str_contains( $key, 'machine' ) || str_contains( $key, 'pec deck' ) ) $equipment = 'machine';
		elseif ( str_contains( $key, 'dumbbell' ) ) $equipment = 'dumbbell';
		elseif ( str_contains( $key, 'barbell' ) ) $equipment = 'barbell';
		elseif ( str_contains( $key, 'cable' ) ) $equipment = 'cable';
		elseif ( str_contains( $key, 'kettlebell' ) ) $equipment = 'kettlebell';
		elseif ( str_contains( $key, 'band' ) ) $equipment = 'band';

		$normalized_day_type = TrainingDayTypes::normalize( $day_type ) ?? TrainingDayTypes::custom_workout_fallback();
		return [
			'description' => 'Personal exercise created automatically from a custom workout request.',
			'primary_muscle' => $primary_muscle,
			'movement_pattern' => $movement_pattern,
			'equipment' => $equipment,
			'difficulty' => 'beginner',
			'day_types' => array_values( array_unique( [ $normalized_day_type, 'full_body' ] ) ),
			'slot_types' => [ $slot_type ],
		];
	}

	private static function normalize_time_tier( string $value ): string {
		$time_tier = sanitize_key( $value );
		if ( 'long' === $time_tier ) {
			$time_tier = 'full';
		}

		return in_array( $time_tier, [ 'short', 'medium', 'full' ], true ) ? $time_tier : '';
	}

	private static function tool_create_personal_exercise( int $user_id, array $arguments = [], array $deps = [] ): array {
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

		$response = self::rest_call( $deps, 'training_save_personal_exercise', [ TrainingController::class, 'save_personal_exercise' ], $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not save that exercise to the custom library.' ) ];
		}

		$created = ! empty( $data['created'] );

		$result = [
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

		$pending = self::load_pending_workout_replacement( $user_id, $deps );
		if ( is_array( $pending ) && self::exercise_name_matches( $name, (string) ( $pending['replacement_exercise_name'] ?? '' ) ) ) {
			$retry = self::tool_modify_workout( $user_id, [
				'action'                    => 'replace',
				'exercise_name'             => (string) ( $pending['exercise_name'] ?? '' ),
				'replacement_exercise_name' => (string) ( $pending['replacement_exercise_name'] ?? $name ),
				'expected_draft_id'          => (string) ( $pending['draft_id'] ?? '' ),
			], $deps );
			if ( ! empty( $retry['ok'] ) ) {
				self::clear_pending_workout_replacement( $user_id, $deps );
				$result['completed_pending_replacement'] = true;
				$result['workout_update'] = $retry;
				$result['summary'] = (string) ( $retry['summary'] ?? sprintf( 'Created %s and completed the pending workout replacement.', $name ) );
			} else {
				$result['pending_replacement_error'] = (string) ( $retry['error'] ?? 'The pending workout replacement could not be completed.' );
				$result['summary'] .= ' The pending workout replacement still needs to be completed.';
			}
		}

		return $result;
	}

	private static function tool_save_workout_to_library( int $user_id, array $arguments, array $deps ): array {
		$current_request = new \WP_REST_Request( 'GET', '/fit/v1/workout/current' );
		$current_loader = $deps['workout_current'] ?? null;
		$current_response = is_callable( $current_loader ) ? $current_loader( $current_request ) : WorkoutController::get_current_session( $current_request );
		if ( ! $current_response instanceof \WP_REST_Response ) return [ 'error' => 'Could not read the current workout.' ];
		$current = $current_response->get_data();
		$draft = is_array( $current['custom_workout_draft'] ?? null ) ? $current['custom_workout_draft'] : [];
		if ( empty( $draft ) ) {
			$session = is_array( $current['session'] ?? null ) ? $current['session'] : [];
			$session_exercises = is_array( $current['exercises'] ?? null ) ? $current['exercises'] : [];
			if ( empty( $session['id'] ) || empty( $session_exercises ) ) {
				return [ 'error' => 'There is no queued or active workout to save.' ];
			}
			$draft = [
				'id' => 'session_' . (int) $session['id'],
				'name' => (string) ( $session['custom_title'] ?? $session['name'] ?? 'Saved Workout' ),
				'day_type' => (string) ( $session['actual_day_type'] ?? $session['planned_day_type'] ?? 'full_body' ),
				'time_tier' => (string) ( $session['time_tier'] ?? 'medium' ),
				'workout_structure' => (string) ( $session['workout_structure'] ?? 'standard' ),
				'rounds' => (int) ( $session['rounds_total'] ?? $session['rounds'] ?? 1 ),
				'exercises' => array_map( static fn( array $exercise ): array => [
					'exercise_id' => (int) ( $exercise['exercise_id'] ?? 0 ),
					'exercise_name' => (string) ( $exercise['exercise_name'] ?? $exercise['name'] ?? '' ),
					'target_type' => (string) ( $exercise['target_type'] ?? $exercise['planned_target_type'] ?? 'reps' ),
					'target_reps' => (int) ( $exercise['target_reps'] ?? $exercise['planned_reps'] ?? $exercise['rep_min'] ?? 0 ),
					'rep_min' => (int) ( $exercise['rep_min'] ?? $exercise['planned_rep_min'] ?? $exercise['target_reps'] ?? 8 ),
					'rep_max' => (int) ( $exercise['rep_max'] ?? $exercise['planned_rep_max'] ?? $exercise['target_reps'] ?? 12 ),
					'sets' => (int) ( $exercise['planned_sets'] ?? $exercise['sets'] ?? 3 ),
					'target_duration_seconds' => (int) ( $exercise['target_duration_seconds'] ?? $exercise['planned_duration_seconds'] ?? $exercise['duration_seconds'] ?? 0 ),
					'reps_per_side' => ! empty( $exercise['reps_per_side'] ),
				], $session_exercises ),
			];
		}
		$name = sanitize_text_field( (string) ( $arguments['name'] ?? '' ) );
		if ( '' !== $name ) $draft['name'] = $name;
		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/saved-library' );
		foreach ( $draft as $key => $value ) $request->set_param( $key, $value );
		$saver = $deps['workout_save_saved'] ?? null;
		$response = is_callable( $saver ) ? $saver( $request ) : WorkoutController::save_saved_workout( $request );
		if ( ! $response instanceof \WP_REST_Response ) return [ 'error' => 'Could not save that workout.' ];
		$data = $response->get_data();
		if ( $response->get_status() >= 400 ) return [ 'error' => (string) ( $data['message'] ?? 'Could not save that workout.' ) ];
		$workout = is_array( $data['workout'] ?? null ) ? $data['workout'] : [];
		return [
			'ok' => true,
			'action' => 'save_workout_to_library',
			'saved_workout_id' => (int) ( $workout['id'] ?? 0 ),
			'name' => (string) ( $workout['name'] ?? $draft['name'] ?? 'Workout' ),
			'summary' => sprintf( 'Saved %s to My Workouts.', (string) ( $workout['name'] ?? $draft['name'] ?? 'that workout' ) ),
		];
	}

	private static function tool_saved_workouts( array $arguments, array $deps ): array {
		$request = new \WP_REST_Request( 'GET', '/fit/v1/workout/saved-library' );
		$loader = $deps['workout_saved_library'] ?? null;
		$response = is_callable( $loader ) ? $loader( $request ) : WorkoutController::get_saved_workout_library( $request );
		if ( ! $response instanceof \WP_REST_Response ) return [ 'error' => 'Could not read My Workouts.' ];
		$data = $response->get_data();
		if ( $response->get_status() >= 400 ) return [ 'error' => (string) ( $data['message'] ?? 'Could not read My Workouts.' ) ];

		$query = strtolower( trim( sanitize_text_field( (string) ( $arguments['query'] ?? '' ) ) ) );
		$limit = max( 1, min( 100, (int) ( $arguments['limit'] ?? 25 ) ) );
		$library = is_array( $data ) ? $data : [];
		if ( '' !== $query ) {
			$library = array_values( array_filter( $library, static function( array $workout ) use ( $query ): bool {
				$exercise_names = array_map( static fn( array $exercise ): string => (string) ( $exercise['exercise_name'] ?? $exercise['name'] ?? '' ), (array) ( $workout['exercises'] ?? [] ) );
				$haystack = strtolower( implode( ' ', array_merge( [ (string) ( $workout['name'] ?? '' ), (string) ( $workout['day_type'] ?? '' ) ], $exercise_names ) ) );
				return str_contains( $haystack, $query );
			} ) );
		}

		$total = count( $library );
		$items = array_map( static function( array $workout ): array {
			return [
				'id'                => (int) ( $workout['id'] ?? 0 ),
				'name'              => sanitize_text_field( (string) ( $workout['name'] ?? 'Workout' ) ),
				'workout_structure' => sanitize_key( (string) ( $workout['workout_structure'] ?? 'standard' ) ),
				'rounds'            => max( 1, (int) ( $workout['rounds'] ?? 1 ) ),
				'day_type'          => sanitize_key( (string) ( $workout['day_type'] ?? '' ) ),
				'time_tier'         => sanitize_key( (string) ( $workout['time_tier'] ?? '' ) ),
				'exercise_count'    => (int) ( $workout['exercise_count'] ?? count( (array) ( $workout['exercises'] ?? [] ) ) ),
				'exercises'         => array_values( array_map( static fn( array $exercise ): array => [
					'name' => sanitize_text_field( (string) ( $exercise['exercise_name'] ?? $exercise['name'] ?? 'Exercise' ) ),
					'target_type' => sanitize_key( (string) ( $exercise['target_type'] ?? '' ) ),
					'reps' => (int) ( $exercise['target_reps'] ?? $exercise['reps'] ?? 0 ),
					'duration_seconds' => (int) ( $exercise['target_duration_seconds'] ?? $exercise['duration_seconds'] ?? 0 ),
				], (array) ( $workout['exercises'] ?? [] ) ) ),
				'updated_at'        => sanitize_text_field( (string) ( $workout['updated_at'] ?? '' ) ),
			];
		}, array_slice( $library, 0, $limit ) );

		return [
			'ok' => true,
			'action' => 'get_saved_workouts',
			'count' => count( $items ),
			'total_matches' => $total,
			'workouts' => $items,
			'summary' => $total ? sprintf( 'Found %d workout%s in My Workouts.', $total, 1 === $total ? '' : 's' ) : 'No matching workouts were found in My Workouts.',
		];
	}

	private static function tool_load_saved_workout( int $user_id, array $arguments = [] ): array {
		$library_response = WorkoutController::get_saved_workout_library( new \WP_REST_Request( 'GET', '/fit/v1/workout/saved-library' ) );
		$library = $library_response->get_data();
		$library = is_array( $library ) ? $library : [];
		$id = max( 0, (int) ( $arguments['id'] ?? 0 ) );
		$name = strtolower( trim( sanitize_text_field( (string) ( $arguments['name'] ?? '' ) ) ) );
		$match = null;
		foreach ( $library as $workout ) {
			if ( $id > 0 && (int) ( $workout['id'] ?? 0 ) === $id ) { $match = $workout; break; }
			if ( '' !== $name && strtolower( (string) ( $workout['name'] ?? '' ) ) === $name ) { $match = $workout; break; }
		}
		if ( ! $match && '' !== $name ) {
			foreach ( $library as $workout ) {
				if ( str_contains( strtolower( (string) ( $workout['name'] ?? '' ) ), $name ) ) { $match = $workout; break; }
			}
		}
		if ( ! $match ) return [ 'error' => 'Could not find that workout in My Workouts.' ];
		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/saved-library/' . (int) $match['id'] . '/queue' );
		$request->set_param( 'id', (int) $match['id'] );
		$response = WorkoutController::queue_saved_workout( $request );
		$data = $response->get_data();
		if ( $response->get_status() >= 400 ) return [ 'error' => (string) ( $data['message'] ?? 'Could not load that workout.' ) ];
		return [
			'ok' => true,
			'action' => 'load_saved_workout',
			'saved_workout_id' => (int) $match['id'],
			'name' => (string) $match['name'],
			'summary' => sprintf( 'Loaded %s from My Workouts. Review it on the Workout screen.', (string) $match['name'] ),
		];
	}

	private static function tool_remove_saved_workout( int $user_id, array $arguments, array $deps ): array {
		$request = new \WP_REST_Request( 'GET', '/fit/v1/workout/saved-library' );
		$loader = $deps['workout_saved_library'] ?? null;
		$library_response = is_callable( $loader ) ? $loader( $request ) : WorkoutController::get_saved_workout_library( $request );
		if ( ! $library_response instanceof \WP_REST_Response ) return [ 'error' => 'Could not read My Workouts.' ];
		$library = $library_response->get_data();
		$library = is_array( $library ) ? $library : [];
		$id = max( 0, (int) ( $arguments['id'] ?? 0 ) );
		$name = strtolower( trim( sanitize_text_field( (string) ( $arguments['name'] ?? '' ) ) ) );
		$matches = array_values( array_filter( $library, static function( array $workout ) use ( $id, $name ): bool {
			if ( $id > 0 ) return (int) ( $workout['id'] ?? 0 ) === $id;
			return '' !== $name && strtolower( (string) ( $workout['name'] ?? '' ) ) === $name;
		} ) );
		if ( 1 !== count( $matches ) ) {
			return [ 'error' => $matches ? 'More than one saved workout has that name. Use its saved workout ID.' : 'Could not find that exact workout in My Workouts.' ];
		}

		$match = $matches[0];
		$delete_request = new \WP_REST_Request( 'DELETE', '/fit/v1/workout/saved-library/' . (int) $match['id'] );
		$delete_request->set_param( 'id', (int) $match['id'] );
		$deleter = $deps['workout_delete_saved'] ?? null;
		$response = is_callable( $deleter ) ? $deleter( $delete_request ) : WorkoutController::delete_saved_workout( $delete_request );
		if ( ! $response instanceof \WP_REST_Response ) return [ 'error' => 'Could not remove that workout.' ];
		$data = $response->get_data();
		if ( $response->get_status() >= 400 ) return [ 'error' => (string) ( $data['message'] ?? 'Could not remove that workout.' ) ];

		return [
			'ok' => true,
			'action' => 'remove_saved_workout',
			'saved_workout_id' => (int) $match['id'],
			'name' => (string) $match['name'],
			'summary' => sprintf( 'Removed %s from My Workouts.', (string) $match['name'] ),
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
	private static function tool_log_cardio( int $user_id, array $arguments, array $deps ): array {
		$duration = (int) ( $arguments['duration_minutes'] ?? 0 );
		if ( $duration <= 0 || $duration > 1440 ) {
			return [ 'error' => 'A cardio duration between 1 and 1440 minutes is required.' ];
		}

		$type = sanitize_text_field( (string) ( $arguments['cardio_type'] ?? 'other' ) ) ?: 'other';
		$intensity = sanitize_key( (string) ( $arguments['intensity'] ?? 'moderate' ) );
		if ( ! in_array( $intensity, [ 'light', 'moderate', 'hard' ], true ) ) {
			$intensity = 'moderate';
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/body/cardio' );
		$request->set_param( 'cardio_type', $type );
		$request->set_param( 'duration_minutes', $duration );
		$request->set_param( 'intensity', $intensity );

		$date = (string) self::dep( $deps, 'normalise_tool_date', $user_id, (string) ( $arguments['date'] ?? '' ) );
		if ( '' !== $date ) {
			$request->set_param( 'date', $date );
		}
		foreach ( [ 'distance', 'estimated_calories', 'notes' ] as $field ) {
			if ( array_key_exists( $field, $arguments ) ) {
				$request->set_param( $field, $arguments[ $field ] );
			}
		}

		$response = self::body_log_cardio( $deps, $request );
		$data     = $response->get_data();
		$status   = (int) $response->get_status();
		if ( $status >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not log cardio.' ) ];
		}

		$date_logged  = $date ?: UserTime::today( $user_id );
		$date_display = (string) self::dep( $deps, 'format_tool_display_date', $user_id, $date_logged );

		return [
			'ok'                 => true,
			'action'             => 'log_cardio',
			'id'                 => (int) ( $data['id'] ?? 0 ),
			'date'               => $date_logged,
			'date_display'       => $date_display,
			'cardio_type'        => $type,
			'duration_minutes'   => $duration,
			'intensity'          => $intensity,
			'distance'           => isset( $arguments['distance'] ) ? (float) $arguments['distance'] : null,
			'estimated_calories' => isset( $arguments['estimated_calories'] ) ? (int) $arguments['estimated_calories'] : null,
			'notes'              => sanitize_text_field( (string) ( $arguments['notes'] ?? '' ) ),
			'summary'            => sprintf( 'Logged %d minutes of %s %s for %s.', $duration, $intensity, $type, $date_display ),
		];
	}

	/**
	 * @param array<string,callable> $deps
	 */
	private static function tool_log_rest_day( int $user_id, array $deps ): array {
		$snapshot        = self::daily_snapshot( $user_id, $deps );
		$training_status = is_array( $snapshot['training_status'] ?? null ) ? $snapshot['training_status'] : [];
		if ( ! empty( $training_status['recorded'] ) ) {
			$recorded_type = sanitize_key( (string) ( $training_status['recorded_type'] ?? '' ) );
			if ( 'rest' === $recorded_type ) {
				return [
					'ok'              => true,
					'action'          => 'log_rest_day',
					'already_recorded'=> true,
					'date'            => UserTime::today( $user_id ),
					'summary'         => 'Today is already recorded as a rest day.',
				];
			}

			return [ 'error' => sprintf( 'Today already has %s training recorded, so Johnny did not replace it with a rest day.', str_replace( '_', ' ', $recorded_type ?: 'completed' ) ) ];
		}

		$start_request = new \WP_REST_Request( 'POST', '/fit/v1/workout/start' );
		$start_request->set_param( 'day_type', 'rest' );
		$start_request->set_param( 'time_tier', 'short' );
		$start_response = self::workout_start( $deps, $start_request );
		$start_data     = $start_response->get_data();
		if ( (int) $start_response->get_status() >= 400 ) {
			return [ 'error' => (string) ( $start_data['message'] ?? 'Could not start the rest-day record.' ) ];
		}

		$session = is_array( $start_data['session'] ?? null ) ? $start_data['session'] : [];
		$session_id = (int) ( $start_data['session_id'] ?? $session['id'] ?? 0 );
		if ( $session_id <= 0 ) {
			return [ 'error' => 'Could not create the rest-day record.' ];
		}

		$complete_request = new \WP_REST_Request( 'POST', '/fit/v1/workout/' . $session_id . '/complete' );
		$complete_request->set_param( 'id', $session_id );
		$complete_request->set_param( 'actual_day_type', 'rest' );
		$complete_response = self::workout_complete( $deps, $complete_request );
		$complete_data     = $complete_response->get_data();
		if ( (int) $complete_response->get_status() >= 400 ) {
			return [ 'error' => (string) ( $complete_data['message'] ?? 'Could not complete the rest-day record.' ) ];
		}

		return [
			'ok'         => true,
			'action'     => 'log_rest_day',
			'session_id' => $session_id,
			'date'       => UserTime::today( $user_id ),
			'summary'    => 'Logged today as a rest day.',
		];
	}

	private static function current_workout_response( array $deps ): \WP_REST_Response {
		$request = new \WP_REST_Request( 'GET', '/fit/v1/workout/current' );
		return self::rest_call( $deps, 'workout_current', [ WorkoutController::class, 'get_current_session' ], $request );
	}

	private static function tool_approve_workout( int $user_id, array $deps ): array {
		$data = self::current_workout_response( $deps )->get_data();
		$session = is_array( $data['session'] ?? null ) ? $data['session'] : [];
		$draft = is_array( $data['custom_workout_draft'] ?? null ) ? $data['custom_workout_draft'] : [];
		$workout_id = (string) ( $draft['id'] ?? $session['id'] ?? '' );
		if ( '' === $workout_id ) return [ 'error' => 'There is no queued workout to approve.' ];
		$approval = [ 'date' => self::today( $user_id, $deps ), 'workout_id' => $workout_id, 'approved_at' => current_time( 'mysql', true ) ];
		$save = $deps['save_workout_approval'] ?? null;
		if ( is_callable( $save ) ) $save( $user_id, $approval ); else update_user_meta( $user_id, 'jf_workout_approval', $approval );
		return [ 'ok' => true, 'action' => 'approve_workout', 'approval' => $approval, 'summary' => 'Approved and locked in today’s workout.' ];
	}

	private static function tool_search_exercises( array $arguments, array $deps ): array {
		$request = new \WP_REST_Request( 'GET', '/fit/v1/training/exercises' );
		foreach ( [ 'query' => 'q', 'muscle' => 'muscle', 'equipment' => 'equipment', 'own_only' => 'own_only', 'limit' => 'limit' ] as $from => $to ) {
			if ( array_key_exists( $from, $arguments ) ) $request->set_param( $to, $arguments[ $from ] );
		}
		$response = self::rest_call( $deps, 'training_get_exercises', [ TrainingController::class, 'get_exercises' ], $request );
		$result = self::rest_result( $response, 'search_exercises', 'Could not search exercises.' );
		if ( ! empty( $result['ok'] ) ) {
			$result['exercises'] = array_slice( is_array( $result['data'] ) ? $result['data'] : [], 0, 50 );
			$result['count'] = count( $result['exercises'] ); unset( $result['data'] );
		}
		return $result;
	}

	private static function exercise_aliases( string $name ): array {
		$key = strtolower( trim( $name ) );
		$groups = [
			[ 'dumbbell bench press', 'dumbbell chest press' ],
			[ 'barbell bench press', 'bench press' ],
			[ 'machine chest fly', 'machine chest flye', 'pec deck', 'pec deck fly' ],
			[ 'cable triceps pushdown', 'cable tricep pushdown', 'triceps pressdown', 'cable pressdown' ],
			[ 'overhead cable triceps extension', 'overhead triceps extension', 'cable overhead triceps extension' ],
		];
		foreach ( $groups as $group ) {
			if ( in_array( $key, $group, true ) ) return array_values( array_unique( array_merge( [ $name ], $group ) ) );
		}
		return [ $name ];
	}

	private static function resolve_workout_exercise( int $user_id, string $name, array $deps ) {
		$resolver = $deps['find_accessible_exercise_by_name'] ?? null;
		foreach ( self::exercise_aliases( $name ) as $candidate ) {
			$exercise = is_callable( $resolver ) ? $resolver( $user_id, $candidate ) : ExerciseLibraryService::find_accessible_exercise_by_name( $user_id, $candidate );
			if ( $exercise ) return $exercise;
		}
		return null;
	}

	private static function resolve_or_create_workout_exercise( int $user_id, string $name, string $day_type, array $deps ) {
		$resolved = self::resolve_workout_exercise( $user_id, $name, $deps );
		if ( $resolved ) return $resolved;
		// Tests and integrations may intentionally provide a closed resolver. Only
		// auto-create through that boundary when they also provide a creator.
		if ( isset( $deps['find_accessible_exercise_by_name'] ) && ! isset( $deps['create_personal_exercise'] ) ) return null;

		$metadata = self::infer_custom_exercise_metadata( $name, $day_type );
		$creator = $deps['create_personal_exercise'] ?? null;
		$created = is_callable( $creator )
			? $creator( $user_id, array_merge( $metadata, [ 'name' => $name ] ) )
			: ExerciseLibraryService::create_personal_exercise( $user_id, array_merge( $metadata, [ 'name' => $name ] ) );
		if ( is_wp_error( $created ) || empty( $created['id'] ) ) return null;

		return (object) array_merge( $metadata, [ 'id' => (int) $created['id'], 'name' => $name ] );
	}

	private static function exercise_name_matches( string $actual, string $requested ): bool {
		$actual = strtolower( trim( $actual ) );
		return in_array( $actual, array_map( static fn( string $name ): string => strtolower( trim( $name ) ), self::exercise_aliases( $requested ) ), true );
	}

	private static function load_pending_workout_replacement( int $user_id, array $deps ): array {
		$loader = $deps['load_pending_workout_replacement'] ?? null;
		$value = is_callable( $loader ) ? $loader( $user_id ) : get_user_meta( $user_id, 'jf_pending_workout_replacement', true );
		return is_array( $value ) ? $value : [];
	}

	private static function save_pending_workout_replacement( int $user_id, array $value, array $deps ): void {
		$saver = $deps['save_pending_workout_replacement'] ?? null;
		if ( is_callable( $saver ) ) $saver( $user_id, $value );
		else update_user_meta( $user_id, 'jf_pending_workout_replacement', $value );
	}

	private static function clear_pending_workout_replacement( int $user_id, array $deps ): void {
		$clearer = $deps['clear_pending_workout_replacement'] ?? null;
		if ( is_callable( $clearer ) ) $clearer( $user_id );
		else delete_user_meta( $user_id, 'jf_pending_workout_replacement' );
	}

	private static function tool_modify_workout( int $user_id, array $arguments, array $deps ): array {
		$current = self::current_workout_response( $deps )->get_data();
		$draft = is_array( $current['custom_workout_draft'] ?? null ) ? $current['custom_workout_draft'] : [];
		if ( empty( $draft['id'] ) ) return [ 'error' => 'A queued workout draft is required before it can be modified.' ];
		$expected_draft_id = sanitize_text_field( (string) ( $arguments['expected_draft_id'] ?? '' ) );
		if ( '' !== $expected_draft_id && $expected_draft_id !== (string) $draft['id'] ) {
			return [ 'error' => 'The queued workout changed after the replacement was requested, so I did not apply the pending edit.' ];
		}
		$exercises = is_array( $draft['exercises'] ?? null ) ? array_values( $draft['exercises'] ) : [];
		$original_exercises = $exercises;
		$action = sanitize_key( (string) ( $arguments['action'] ?? '' ) );
		$requested_name = sanitize_text_field( (string) ( $arguments['exercise_name'] ?? '' ) );
		$name = strtolower( trim( $requested_name ) );
		if ( 'remove' === $action ) {
			$exercises = array_values( array_filter( $exercises, static fn( array $e ): bool => ! self::exercise_name_matches( (string) ( $e['exercise_name'] ?? '' ), $requested_name ) ) );
			if ( count( $exercises ) === count( $original_exercises ) ) return [ 'error' => sprintf( '%s is not in the queued workout, so I left the workout unchanged.', $requested_name ?: 'That exercise' ) ];
			if ( empty( $exercises ) ) return [ 'error' => 'A workout must keep at least one exercise.' ];
		} elseif ( 'add' === $action ) {
			if ( '' === $name ) return [ 'error' => 'An exercise name is required.' ];
			$resolved = self::resolve_or_create_workout_exercise( $user_id, $requested_name, (string) ( $draft['day_type'] ?? '' ), $deps );
			if ( ! $resolved ) return [ 'error' => sprintf( 'I could not create or add %s, so I left the workout unchanged.', $requested_name ) ];
			$exercises[] = [ 'exercise_id' => (int) $resolved->id, 'exercise_name' => (string) $resolved->name, 'target_type' => 'reps' ];
		} elseif ( 'replace' === $action ) {
			$replacement_name = sanitize_text_field( (string) ( $arguments['replacement_exercise_name'] ?? '' ) );
			if ( '' === $requested_name || '' === $replacement_name ) return [ 'error' => 'Both the current and replacement exercise names are required.' ];
			$replace_index = null;
			foreach ( $exercises as $index => $exercise ) {
				if ( self::exercise_name_matches( (string) ( $exercise['exercise_name'] ?? '' ), $requested_name ) ) { $replace_index = $index; break; }
			}
			if ( null === $replace_index ) return [ 'error' => sprintf( '%s is not in the queued workout, so I left the workout unchanged.', $requested_name ) ];
			$resolved = self::resolve_or_create_workout_exercise( $user_id, $replacement_name, (string) ( $draft['day_type'] ?? '' ), $deps );
			if ( ! $resolved ) {
				self::save_pending_workout_replacement( $user_id, [
					'draft_id'                    => (string) $draft['id'],
					'exercise_name'                => $requested_name,
					'replacement_exercise_name'    => $replacement_name,
					'requested_at'                 => current_time( 'mysql', true ),
				], $deps );
				return [ 'error' => sprintf( 'I could not create or add %s, so I left %s in place.', $replacement_name, $requested_name ) ];
			}
			$replacement = $exercises[ $replace_index ];
			$replacement['exercise_id'] = (int) $resolved->id;
			$replacement['exercise_name'] = (string) $resolved->name;
			foreach ( [ 'primary_muscle', 'movement_pattern', 'equipment', 'difficulty' ] as $field ) if ( isset( $resolved->{$field} ) ) $replacement[ $field ] = (string) $resolved->{$field};
			$exercises[ $replace_index ] = $replacement;
		} elseif ( 'reorder' === $action ) {
			$order = array_map( static fn( $v ): string => strtolower( trim( (string) $v ) ), (array) ( $arguments['exercise_order'] ?? [] ) );
			if ( count( $order ) !== count( $exercises ) ) return [ 'error' => 'The complete exercise order is required.' ];
			$indexed = []; foreach ( $exercises as $exercise ) $indexed[ strtolower( (string) ( $exercise['exercise_name'] ?? '' ) ) ] = $exercise;
			$ordered = []; foreach ( $order as $key ) { if ( ! isset( $indexed[ $key ] ) ) return [ 'error' => 'The requested order contains an unknown exercise.' ]; $ordered[] = $indexed[ $key ]; }
			$exercises = $ordered;
		} elseif ( 'structure' === $action ) {
			$draft['workout_structure'] = 'circuit' === sanitize_key( (string) ( $arguments['workout_structure'] ?? '' ) ) ? 'circuit' : 'standard';
			$draft['rounds'] = 'circuit' === $draft['workout_structure'] ? max( 1, min( 20, (int) ( $arguments['rounds'] ?? $draft['rounds'] ?? 3 ) ) ) : 1;
			foreach ( [ 'rest_between_exercises_seconds', 'rest_between_rounds_seconds' ] as $field ) if ( isset( $arguments[ $field ] ) ) $draft[ $field ] = (int) $arguments[ $field ];
		} else return [ 'error' => 'Choose a supported workout modification.' ];
		if ( 'replace' === $action && count( $exercises ) !== count( $original_exercises ) ) return [ 'error' => 'The replacement failed validation, so I left the original workout unchanged.' ];
		foreach ( $exercises as $exercise ) if ( '' === trim( (string) ( $exercise['exercise_name'] ?? '' ) ) ) return [ 'error' => 'The workout failed validation because an exercise name was blank, so I left it unchanged.' ];
		$draft['exercises'] = $exercises;
		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/custom-draft' ); foreach ( $draft as $key => $value ) $request->set_param( $key, $value );
		$result = self::rest_result( self::rest_call( $deps, 'workout_save_custom_draft', [ WorkoutController::class, 'save_custom_draft' ], $request ), 'modify_workout', 'Could not modify the workout.' );
		if ( ! empty( $result['ok'] ) ) {
			$result['summary'] = 'Updated the queued workout card.';
			if ( 'replace' === $action ) $result['summary'] = sprintf( 'Replaced %s with %s in the queued workout and kept the exercise count at %d.', $requested_name, (string) $exercises[ $replace_index ]['exercise_name'], count( $exercises ) );
			if ( 'replace' === $action ) self::clear_pending_workout_replacement( $user_id, $deps );
		}
		return $result;
	}

	private static function tool_start_workout( int $user_id, array $arguments, array $deps ): array {
		$current = self::current_workout_response( $deps )->get_data();
		$draft = is_array( $current['custom_workout_draft'] ?? null ) ? $current['custom_workout_draft'] : [];
		$session = is_array( $current['session'] ?? null ) ? $current['session'] : [];
		$workout_id = (string) ( $draft['id'] ?? $session['id'] ?? '' );
		$load_approval = $deps['load_workout_approval'] ?? null;
		$approval = is_callable( $load_approval ) ? $load_approval( $user_id ) : get_user_meta( $user_id, 'jf_workout_approval', true );
		if ( ! is_array( $approval ) || (string) ( $approval['date'] ?? '' ) !== self::today( $user_id, $deps ) || (string) ( $approval['workout_id'] ?? '' ) !== $workout_id ) {
			return [ 'error' => 'Approve today’s workout before activating it.' ];
		}
		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/start' );
		if ( ! empty( $draft['id'] ) ) $request->set_param( 'custom_workout_draft_id', $draft['id'] );
		if ( isset( $arguments['readiness_score'] ) ) $request->set_param( 'readiness_score', (int) $arguments['readiness_score'] );
		$result = self::rest_result( self::rest_call( $deps, 'workout_start', [ WorkoutController::class, 'start' ], $request ), 'start_workout', 'Could not start the workout.' );
		if ( ! empty( $result['ok'] ) ) $result['summary'] = 'Activated today’s workout.';
		return $result;
	}

	private static function tool_activate_ironquest_mission( int $user_id, array $arguments, array $deps ): array {
		$enable_request = new \WP_REST_Request( 'POST', '/ironquest/enable' );
		$enable_result  = self::rest_result( self::rest_call( $deps, 'ironquest_enable', [ IronQuestController::class, 'enable' ], $enable_request ), 'ironquest_enable', 'Could not turn on IronQuest mode.' );
		if ( empty( $enable_result['ok'] ) ) {
			return $enable_result;
		}

		$current    = self::active_workout_data( $deps );
		$session    = self::array_value( $current['session'] ?? [] );
		$session_id = (int) ( $session['id'] ?? 0 );

		if ( $session_id <= 0 && ! empty( $arguments['start_workout'] ) ) {
			$start_result = self::tool_start_workout( $user_id, [], $deps );
			if ( empty( $start_result['ok'] ) ) {
				return $start_result;
			}
			$current    = self::active_workout_data( $deps );
			$session    = self::array_value( $current['session'] ?? [] );
			$session_id = (int) ( $session['id'] ?? 0 );
		}

		$day_type = sanitize_key( (string) ( $session['actual_day_type'] ?? $session['planned_day_type'] ?? '' ) );
		$run_type = 'cardio' === $day_type ? 'cardio' : 'workout';

		$mission_request = new \WP_REST_Request( 'POST', '/ironquest/missions/start' );
		$mission_request->set_param( 'run_type', $run_type );
		if ( $session_id > 0 ) {
			$mission_request->set_param( 'source_session_id', (string) $session_id );
		}

		$mission_result = self::rest_result( self::rest_call( $deps, 'ironquest_start_mission', [ IronQuestController::class, 'start_mission' ], $mission_request ), 'activate_ironquest_mission', 'Could not start an IronQuest mission.' );
		if ( ! empty( $mission_result['ok'] ) ) {
			$mission_name = sanitize_text_field( (string) ( $mission_result['data']['mission']['name'] ?? 'a new mission' ) );
			$mission_result['summary'] = $session_id > 0
				? "Attached {$mission_name} to today's workout."
				: "Started {$mission_name}. It will attach the next time you start a workout.";
		}

		return $mission_result;
	}

	private static function active_workout_data( array $deps ): array {
		$data = self::current_workout_response( $deps )->get_data();
		return is_array( $data ) ? $data : [];
	}

	private static function array_value( mixed $value ): array {
		return is_array( $value ) ? $value : ( is_object( $value ) ? get_object_vars( $value ) : [] );
	}

	private static function tool_manage_workout_set( array $arguments, array $deps ): array {
		$current = self::active_workout_data( $deps ); $session_id = (int) ( $current['session']['id'] ?? 0 );
		if ( $session_id <= 0 ) return [ 'error' => 'An active workout is required.' ];
		$action = sanitize_key( (string) ( $arguments['action'] ?? '' ) ); $set_id = (int) ( $arguments['set_id'] ?? 0 );
		$method = 'create' === $action ? 'log_set' : ( 'update' === $action ? 'update_set' : ( 'delete' === $action ? 'delete_set' : '' ) );
		if ( '' === $method || ( 'create' !== $action && $set_id <= 0 ) ) return [ 'error' => 'A valid set action and set id are required.' ];
		$session_exercise_id = (int) ( $arguments['session_exercise_id'] ?? 0 );
		if ( $session_exercise_id <= 0 && ! empty( $arguments['exercise_name'] ) ) foreach ( (array) ( $current['exercises'] ?? [] ) as $exercise ) if ( 0 === strcasecmp( (string) ( $exercise['exercise_name'] ?? '' ), (string) $arguments['exercise_name'] ) ) $session_exercise_id = (int) ( $exercise['id'] ?? $exercise['session_exercise_id'] ?? 0 );
		if ( 'create' === $action && $session_exercise_id <= 0 ) return [ 'error' => 'The workout exercise could not be resolved.' ];
		$request = new \WP_REST_Request( 'create' === $action ? 'POST' : ( 'update' === $action ? 'PUT' : 'DELETE' ), '/fit/v1/workout/' . $session_id . '/set' );
		$request->set_param( 'id', $session_id ); if ( $set_id > 0 ) $request->set_param( 'set_id', $set_id ); if ( $session_exercise_id > 0 ) $request->set_param( 'session_exercise_id', $session_exercise_id );
		foreach ( [ 'set_number', 'weight', 'reps', 'duration_seconds', 'circuit_round', 'rir', 'rpe', 'pain_flag', 'notes' ] as $field ) if ( array_key_exists( $field, $arguments ) ) $request->set_param( $field, $arguments[ $field ] );
		$result = self::rest_result( self::rest_call( $deps, 'workout_' . $method, [ WorkoutController::class, $method ], $request ), 'manage_workout_set', 'Could not update the workout set.' );
		if ( ! empty( $result['ok'] ) ) { $result['set_action'] = $action; $result['summary'] = ucfirst( $action ) . 'd the workout set.'; }
		return $result;
	}

	private static function tool_complete_workout( array $deps ): array {
		$current = self::active_workout_data( $deps ); $session = self::array_value( $current['session'] ?? [] ); $session_id = (int) ( $session['id'] ?? 0 );
		if ( $session_id <= 0 ) return [ 'error' => 'There is no active workout to complete.' ];
		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/' . $session_id . '/complete' ); $request->set_param( 'id', $session_id );
		$result = self::rest_result( self::rest_call( $deps, 'workout_complete', [ WorkoutController::class, 'complete_session' ], $request ), 'complete_workout', 'Could not complete the workout.' );
		if ( ! empty( $result['ok'] ) ) $result['summary'] = 'Completed today’s workout.';
		return $result;
	}

	private static function tool_cancel_workout( int $user_id, array $deps ): array {
		$current = self::active_workout_data( $deps );
		$session = self::array_value( $current['session'] ?? [] );
		$session_id = (int) ( $session['id'] ?? 0 );
		if ( $session_id > 0 ) {
			$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/' . $session_id . '/discard' );
			$request->set_param( 'id', $session_id );
			$result = self::rest_result( self::rest_call( $deps, 'workout_discard', [ WorkoutController::class, 'discard_session' ], $request ), 'cancel_workout', 'Could not cancel the active workout.' );
			if ( ! empty( $result['ok'] ) ) $result['summary'] = 'Canceled the active workout. You can start over with a new one.';
			return $result;
		}

		$draft = self::array_value( $current['custom_workout_draft'] ?? [] );
		if ( '' === trim( (string) ( $draft['id'] ?? '' ) ) ) return [ 'error' => 'There is no queued or active workout to cancel.' ];
		$request = new \WP_REST_Request( 'DELETE', '/fit/v1/workout/custom-draft' );
		$result = self::rest_result( self::rest_call( $deps, 'workout_clear_custom_draft', [ WorkoutController::class, 'delete_custom_draft' ], $request ), 'cancel_workout', 'Could not clear the queued workout.' );
		if ( ! empty( $result['ok'] ) ) $result['summary'] = 'Cleared the queued workout. You can build a new one.';
		return $result;
	}

	private static function tool_restart_workout_timer( array $deps ): array {
		$current = self::active_workout_data( $deps ); $session = self::array_value( $current['session'] ?? [] ); $session_id = (int) ( $session['id'] ?? 0 );
		if ( $session_id <= 0 ) return [ 'error' => 'There is no active workout timer to restart.' ];
		$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/' . $session_id . '/reset-timer' ); $request->set_param( 'id', $session_id );
		$result = self::rest_result( self::rest_call( $deps, 'workout_reset_timer', [ WorkoutController::class, 'reset_session_timer' ], $request ), 'restart_workout_timer', 'Could not restart the workout timer.' );
		if ( ! empty( $result['ok'] ) ) $result['summary'] = 'Restarted the active workout timer.';
		return $result;
	}

	private static function tool_log_body_measurement( array $arguments, array $deps ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/body/weight' );
		foreach ( [ 'weight_lb', 'waist_in', 'body_fat_pct', 'resting_hr', 'notes', 'date' ] as $field ) if ( array_key_exists( $field, $arguments ) ) $request->set_param( $field, $arguments[ $field ] );
		$result = self::rest_result( self::rest_call( $deps, 'body_log_weight', [ BodyMetricsController::class, 'log_weight' ], $request ), 'log_body_measurement', 'Could not log the body measurement.' );
		if ( ! empty( $result['ok'] ) ) $result['summary'] = 'Logged the body measurement.';
		return $result;
	}

	private static function tool_manage_health_log( array $arguments, array $deps ): array {
		$type = sanitize_key( (string) ( $arguments['log_type'] ?? '' ) ); $action = sanitize_key( (string) ( $arguments['action'] ?? '' ) ); $id = (int) ( $arguments['id'] ?? 0 );
		$methods = [
			'weight' => [ 'update' => 'update_weight', 'delete' => 'delete_weight' ], 'sleep' => [ 'update' => 'update_sleep', 'delete' => 'delete_sleep' ],
			'steps' => [ 'update' => 'update_steps', 'delete' => 'delete_steps' ], 'cardio' => [ 'update' => 'update_cardio', 'delete' => 'delete_cardio' ],
		];
		$method = $methods[ $type ][ $action ] ?? ''; if ( '' === $method || $id <= 0 ) return [ 'error' => 'A valid health log type, action, and id are required.' ];
		$request = new \WP_REST_Request( 'delete' === $action ? 'DELETE' : 'PUT', '/fit/v1/body/' . $type . '/' . $id ); $request->set_param( 'id', $id );
		foreach ( [ 'date', 'weight_lb', 'waist_in', 'body_fat_pct', 'resting_hr', 'hours_sleep', 'sleep_quality', 'steps', 'cardio_type', 'duration_minutes', 'intensity', 'estimated_calories', 'notes' ] as $field ) if ( array_key_exists( $field, $arguments ) ) $request->set_param( $field, $arguments[ $field ] );
		$result = self::rest_result( self::rest_call( $deps, 'body_' . $method, [ BodyMetricsController::class, $method ], $request ), 'manage_health_log', 'Could not change the health log.' );
		if ( ! empty( $result['ok'] ) ) { $result['log_type'] = $type; $result['log_action'] = $action; $result['summary'] = ucfirst( $action ) . 'd the ' . $type . ' log.'; }
		return $result;
	}

	private static function tool_log_water( array $arguments, array $deps ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/water' ); $request->set_param( 'glasses', (int) ( $arguments['glasses'] ?? 0 ) );
		if ( isset( $arguments['date'] ) ) $request->set_param( 'date', $arguments['date'] );
		$result = self::rest_result( self::rest_call( $deps, 'nutrition_save_water', [ NutritionController::class, 'save_water_intake' ], $request ), 'log_water', 'Could not log water.' );
		if ( ! empty( $result['ok'] ) ) $result['summary'] = sprintf( 'Set water intake to %d glasses.', (int) $arguments['glasses'] );
		return $result;
	}

	private static function tool_manage_meal( array $arguments, array $deps ): array {
		$action = sanitize_key( (string) ( $arguments['action'] ?? '' ) ); $id = (int) ( $arguments['id'] ?? 0 );
		$method = 'update' === $action ? 'update_meal' : ( 'delete' === $action ? 'delete_meal' : '' ); if ( '' === $method || $id <= 0 ) return [ 'error' => 'A valid meal action and id are required.' ];
		$request = new \WP_REST_Request( 'delete' === $action ? 'DELETE' : 'PUT', '/fit/v1/nutrition/meal/' . $id ); $request->set_param( 'id', $id );
		foreach ( [ 'meal_type', 'meal_datetime', 'items' ] as $field ) if ( array_key_exists( $field, $arguments ) ) $request->set_param( $field, $arguments[ $field ] );
		$result = self::rest_result( self::rest_call( $deps, 'nutrition_' . $method, [ NutritionController::class, $method ], $request ), 'manage_meal', 'Could not change the meal.' );
		if ( ! empty( $result['ok'] ) ) { $result['meal_action'] = $action; $result['summary'] = ucfirst( $action ) . 'd the meal.'; }
		return $result;
	}

	private static function tool_manage_saved_meal( array $arguments, array $deps ): array {
		$action = sanitize_key( (string) ( $arguments['action'] ?? '' ) ); $id = (int) ( $arguments['id'] ?? 0 );
		$methods = [ 'create' => 'create_saved_meal', 'update' => 'update_saved_meal', 'delete' => 'delete_saved_meal', 'log' => 'log_saved_meal' ]; $method = $methods[ $action ] ?? '';
		if ( '' === $method || ( 'create' !== $action && $id <= 0 ) ) return [ 'error' => 'A valid saved-meal action and id are required.' ];
		$request = new \WP_REST_Request( 'delete' === $action ? 'DELETE' : ( 'update' === $action ? 'PUT' : 'POST' ), '/fit/v1/nutrition/saved-meals' ); if ( $id > 0 ) $request->set_param( 'id', $id );
		foreach ( [ 'name', 'meal_type', 'meal_datetime', 'items' ] as $field ) if ( array_key_exists( $field, $arguments ) ) $request->set_param( $field, $arguments[ $field ] );
		$result = self::rest_result( self::rest_call( $deps, 'nutrition_' . $method, [ NutritionController::class, $method ], $request ), 'manage_saved_meal', 'Could not change the saved meal.' );
		if ( ! empty( $result['ok'] ) ) { $result['saved_meal_action'] = $action; $result['summary'] = ucfirst( $action ) . 'd the saved meal.'; }
		return $result;
	}

	private static function tool_update_goals( int $user_id, array $arguments, array $deps ): array {
		$allowed = [ 'goal_type', 'goal_rate', 'target_weight_lb', 'target_calories', 'target_protein_g', 'target_carbs_g', 'target_fat_g', 'target_steps', 'target_sleep_hours' ];
		$values = array_intersect_key( $arguments, array_flip( $allowed ) ); if ( empty( $values ) ) return [ 'error' => 'At least one supported goal field is required.' ];
		$callable = $deps['update_goals'] ?? null;
		if ( is_callable( $callable ) ) $ok = (bool) $callable( $user_id, $values ); else {
			global $wpdb; $table = $wpdb->prefix . 'fit_user_goals'; $goal_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE user_id = %d AND active = 1", $user_id ) );
			$ok = $goal_id > 0 && false !== $wpdb->update( $table, $values, [ 'id' => $goal_id, 'user_id' => $user_id ] );
		}
		return $ok ? [ 'ok' => true, 'action' => 'update_goals', 'updated_fields' => array_keys( $values ), 'summary' => 'Updated the requested fitness goals.' ] : [ 'error' => 'Could not update the active goals.' ];
	}

	private static function tool_update_profile( array $arguments, array $deps ): array {
		if ( empty( $arguments ) ) return [ 'error' => 'At least one profile field is required.' ];
		$request = new \WP_REST_Request( 'POST', '/fit/v1/onboarding/profile' ); foreach ( $arguments as $key => $value ) $request->set_param( $key, $value );
		$result = self::rest_result( self::rest_call( $deps, 'onboarding_save_profile', [ OnboardingController::class, 'save_profile' ], $request ), 'update_profile', 'Could not update the profile.' );
		if ( ! empty( $result['ok'] ) ) { $result['updated_fields'] = array_keys( $arguments ); $result['summary'] = 'Updated the requested profile settings.'; }
		return $result;
	}

	/**
	 * Update one or more of the user's saved Johnny personality dials.
	 * exercise_preferences_json is a single JSON blob column that OnboardingController::save_preferences()
	 * fully replaces when present, so this reads the existing blob and merges the requested dial(s) into it
	 * before writing back - otherwise every other saved preference in that blob would be wiped out.
	 */
	private static function tool_update_personality_settings( int $user_id, array $arguments, array $deps ): array {
		$allowed = [ 'personality_age_range', 'personality_aggressiveness', 'personality_humor_level' ];
		$values  = array_intersect_key( $arguments, array_flip( $allowed ) );
		if ( empty( $values ) ) {
			return [ 'error' => 'At least one of personality_age_range, personality_aggressiveness, or personality_humor_level is required.' ];
		}

		$valid_options = [
			'personality_age_range'      => array_keys( AiPromptService::personality_age_range_presets() ),
			'personality_aggressiveness' => array_keys( AiPromptService::personality_aggressiveness_presets() ),
			'personality_humor_level'    => array_keys( AiPromptService::personality_humor_presets() ),
		];

		foreach ( $values as $key => $value ) {
			$value = sanitize_key( (string) $value );
			if ( '' !== $value && ! in_array( $value, $valid_options[ $key ], true ) ) {
				return [ 'error' => "\"{$value}\" is not a supported value for {$key}." ];
			}
			$values[ $key ] = $value;
		}

		global $wpdb;
		$p = $wpdb->prefix;
		$existing_json = $wpdb->get_var( $wpdb->prepare(
			"SELECT exercise_preferences_json FROM {$p}fit_user_preferences WHERE user_id = %d",
			$user_id
		) );
		$merged = $existing_json ? json_decode( (string) $existing_json, true ) : [];
		if ( ! is_array( $merged ) ) {
			$merged = [];
		}
		foreach ( $values as $key => $value ) {
			if ( '' === $value ) {
				unset( $merged[ $key ] );
			} else {
				$merged[ $key ] = $value;
			}
		}

		$request = new \WP_REST_Request( 'POST', '/fit/v1/onboarding/prefs' );
		$request->set_param( 'exercise_preferences_json', $merged );
		$result = self::rest_result(
			self::rest_call( $deps, 'onboarding_save_preferences', [ OnboardingController::class, 'save_preferences' ], $request ),
			'update_personality_settings',
			'Could not update the personality settings.'
		);

		if ( ! empty( $result['ok'] ) ) {
			$result['updated_fields'] = array_keys( $values );
			$result['summary']        = "Updated Johnny's personality settings.";
		}

		return $result;
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

	private static function tool_grocery_gap( int $user_id, array $deps ): array {
		if ( is_callable( $deps['get_grocery_gap'] ?? null ) ) {
			$gap = (array) $deps['get_grocery_gap']( $user_id );
		} else {
			$request  = new \WP_REST_Request( 'GET', '/fit/v1/nutrition/grocery-gap' );
			$response = NutritionRecipeController::get_grocery_gap( $request );
			$gap      = (array) $response->get_data();
		}

		$manual  = is_array( $gap['manual_items'] ?? null ) ? $gap['manual_items'] : [];
		$missing = is_array( $gap['missing_items'] ?? null ) ? $gap['missing_items'] : [];
		$count   = count( $manual ) + count( $missing );

		return [
			'ok'          => true,
			'action'      => 'show_grocery_gap',
			'grocery_gap' => $gap,
			'item_count'  => $count,
			'summary'     => $count
				? sprintf( 'Your grocery gap currently has %d item%s.', $count, 1 === $count ? '' : 's' )
				: 'Your grocery gap is clear right now.',
		];
	}

	private static function tool_remove_pantry_items( int $user_id, array $arguments ): array {
		global $wpdb;
		$names = self::tool_item_names( $arguments );
		if ( empty( $names ) ) {
			return [ 'error' => 'At least one pantry item name is required.' ];
		}

		$table = $wpdb->prefix . 'fit_pantry_items';
		$deleted_names = [];
		foreach ( $names as $name ) {
			$rows = $wpdb->get_results( $wpdb->prepare(
				"SELECT id, item_name FROM {$table} WHERE user_id = %d AND LOWER(item_name) = LOWER(%s)",
				$user_id,
				$name
			), ARRAY_A );
			foreach ( is_array( $rows ) ? $rows : [] as $row ) {
				if ( false !== $wpdb->delete( $table, [ 'id' => (int) $row['id'], 'user_id' => $user_id ] ) ) {
					$deleted_names[] = sanitize_text_field( (string) $row['item_name'] );
				}
			}
		}

		return [
			'ok' => true,
			'action' => 'remove_pantry_items',
			'deleted_count' => count( $deleted_names ),
			'item_names' => array_values( array_unique( $deleted_names ) ),
			'summary' => $deleted_names ? 'Removed the requested items from the pantry.' : 'No matching pantry items were found.',
		];
	}

	private static function tool_add_recipe_ingredients_to_grocery_list( int $user_id, array $arguments, array $deps ): array {
		$cookbook = self::load_recipe_cookbook_items();
		$catalog = self::load_recipe_catalog_items();
		$recipes = array_merge(
			is_array( $cookbook['recipes'] ?? null ) ? $cookbook['recipes'] : [],
			is_array( $catalog['recipes'] ?? null ) ? $catalog['recipes'] : []
		);
		$recipe = self::find_recipe_tool_match( $recipes, $arguments );
		if ( empty( $recipe['recipe_name'] ) ) {
			return [ 'error' => 'Johnny could not match that recipe in the recipe catalog or cookbook.' ];
		}

		$ingredients = is_array( $recipe['missing_ingredients'] ?? null ) && ! empty( $recipe['missing_ingredients'] )
			? $recipe['missing_ingredients']
			: ( is_array( $recipe['ingredients'] ?? null ) ? $recipe['ingredients'] : [] );
		$on_hand = array_map( 'strtolower', is_array( $recipe['on_hand_ingredients'] ?? null ) ? $recipe['on_hand_ingredients'] : [] );
		$ingredients = array_values( array_filter( self::sanitize_string_list( $ingredients ), static function( string $ingredient ) use ( $on_hand ): bool {
			return ! in_array( strtolower( $ingredient ), $on_hand, true );
		} ) );
		if ( empty( $ingredients ) ) {
			return [ 'ok' => true, 'action' => 'add_recipe_ingredients_to_grocery_list', 'recipe_name' => $recipe['recipe_name'], 'item_names' => [], 'summary' => 'All ingredients for that recipe are already in the pantry.' ];
		}

		$result = self::tool_add_grocery_gap_items( $user_id, [
			'items' => array_map( static fn( string $ingredient ): array => [ 'item_name' => $ingredient, 'notes' => 'For ' . $recipe['recipe_name'] ], $ingredients ),
		], $deps );
		if ( empty( $result['error'] ) ) {
			$result['action'] = 'add_recipe_ingredients_to_grocery_list';
			$result['recipe_name'] = $recipe['recipe_name'];
			$result['summary'] = sprintf( 'Added %d missing ingredient%s for %s to the shopping list.', count( $ingredients ), 1 === count( $ingredients ) ? '' : 's', $recipe['recipe_name'] );
		}
		return $result;
	}

	private static function tool_remove_grocery_gap_items( int $user_id, array $arguments ): array {
		$names = self::tool_item_names( $arguments );
		if ( empty( $names ) ) {
			return [ 'error' => 'At least one shopping-list item name is required.' ];
		}

		$request = new \WP_REST_Request( 'DELETE', '/fit/v1/nutrition/grocery-gap/items' );
		$request->set_param( 'items', array_map( static fn( string $name ): array => [ 'item_name' => $name ], $names ) );
		$response = NutritionRecipeController::delete_grocery_gap_items( $request );
		$data = $response->get_data();
		if ( (int) $response->get_status() >= 400 ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not update the shopping list.' ) ];
		}

		return [
			'ok' => true,
			'action' => 'remove_grocery_gap_items',
			'deleted_count' => (int) ( $data['deleted_count'] ?? 0 ),
			'item_names' => $names,
			'summary' => 'Removed the requested items from the shopping list.',
		];
	}

	private static function tool_item_names( array $arguments ): array {
		$items = is_array( $arguments['items'] ?? null ) ? $arguments['items'] : [];
		if ( ! empty( $arguments['item_name'] ) ) {
			$items[] = [ 'item_name' => $arguments['item_name'] ];
		}
		$names = array_map( static function( $item ): string {
			return sanitize_text_field( (string) ( is_array( $item ) ? ( $item['item_name'] ?? '' ) : $item ) );
		}, $items );
		return array_values( array_unique( array_filter( $names ) ) );
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
