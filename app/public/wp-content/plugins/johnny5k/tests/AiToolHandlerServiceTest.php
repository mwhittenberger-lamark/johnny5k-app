<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiToolHandlerService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiToolHandlerServiceTest extends ServiceTestCase {
	public function test_get_grocery_gap_returns_live_list_for_chat_card(): void {
		$result = AiToolHandlerService::execute( 42, 'get_grocery_gap', [], [
			'get_grocery_gap' => static fn( int $user_id ): array => [
				'missing_items' => [ 'Eggs', 'Spinach' ],
				'manual_items'  => [ [ 'item_name' => 'Greek yogurt', 'quantity' => 2, 'unit' => 'cups' ] ],
				'pantry_count'  => 8,
			],
		] );

		$this->assertTrue( $result['ok'] );
		$this->assertSame( 'show_grocery_gap', $result['action'] );
		$this->assertSame( 3, $result['item_count'] );
		$this->assertSame( 'Eggs', $result['grocery_gap']['missing_items'][0] );
	}
	public function test_save_workout_to_library_can_save_an_active_session(): void {
		$saved_payload = [];
		$result = AiToolHandlerService::execute( 42, 'save_workout_to_library', [ 'name' => 'My Active Circuit' ], [
			'workout_current' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [
				'session' => [ 'id' => 91, 'custom_title' => 'Full Body Circuit', 'actual_day_type' => 'full_body', 'time_tier' => 'full', 'workout_structure' => 'circuit', 'rounds_total' => 3 ],
				'exercises' => [ [ 'exercise_id' => 7, 'exercise_name' => 'Dead Bug', 'target_type' => 'reps', 'target_reps' => 10, 'planned_sets' => 3 ] ],
				'custom_workout_draft' => null,
			], 200 ),
			'workout_save_saved' => static function( \WP_REST_Request $request ) use ( &$saved_payload ): \WP_REST_Response {
				$saved_payload = $request->get_params();
				return new \WP_REST_Response( [ 'saved' => true, 'workout' => [ 'id' => 17, 'name' => $saved_payload['name'] ] ], 201 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 17, $result['saved_workout_id'] ?? 0 );
		$this->assertSame( 'My Active Circuit', $saved_payload['name'] ?? '' );
		$this->assertSame( 'circuit', $saved_payload['workout_structure'] ?? '' );
		$this->assertSame( 3, $saved_payload['rounds'] ?? 0 );
		$this->assertSame( 'Dead Bug', $saved_payload['exercises'][0]['exercise_name'] ?? '' );
	}

	public function test_saved_workouts_returns_a_searchable_bounded_user_library(): void {
		$result = AiToolHandlerService::execute( 42, 'get_saved_workouts', [ 'query' => 'dead bug', 'limit' => 1 ], [
			'workout_saved_library' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [
				[ 'id' => 8, 'name' => 'Monday Circuit', 'workout_structure' => 'circuit', 'rounds' => 3, 'exercise_count' => 2, 'exercises' => [ [ 'exercise_name' => 'Pushup' ] ] ],
				[ 'id' => 9, 'name' => 'Core Reset', 'workout_structure' => 'standard', 'rounds' => 1, 'exercise_count' => 1, 'exercises' => [ [ 'exercise_name' => 'Dead Bug', 'target_type' => 'reps', 'target_reps' => 10 ] ] ],
			], 200 ),
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 1, $result['count'] ?? 0 );
		$this->assertSame( 1, $result['total_matches'] ?? 0 );
		$this->assertSame( 'Core Reset', $result['workouts'][0]['name'] ?? '' );
		$this->assertSame( 'Dead Bug', $result['workouts'][0]['exercises'][0]['name'] ?? '' );
	}

	public function test_remove_saved_workout_deletes_an_exact_library_match(): void {
		$deleted_id = 0;
		$result = AiToolHandlerService::execute( 42, 'remove_saved_workout', [ 'name' => 'Core Reset' ], [
			'workout_saved_library' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [
				[ 'id' => 8, 'name' => 'Monday Circuit' ],
				[ 'id' => 9, 'name' => 'Core Reset' ],
			], 200 ),
			'workout_delete_saved' => static function( \WP_REST_Request $request ) use ( &$deleted_id ): \WP_REST_Response {
				$deleted_id = (int) $request->get_param( 'id' );
				return new \WP_REST_Response( [ 'deleted' => true ], 200 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 9, $deleted_id );
		$this->assertSame( 'Core Reset', $result['name'] ?? '' );
		$this->assertSame( 'remove_saved_workout', $result['action'] ?? '' );
	}

	public function test_remove_saved_workout_refuses_an_ambiguous_name(): void {
		$delete_called = false;
		$result = AiToolHandlerService::execute( 42, 'remove_saved_workout', [ 'name' => 'Push Day' ], [
			'workout_saved_library' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [
				[ 'id' => 8, 'name' => 'Push Day' ],
				[ 'id' => 9, 'name' => 'Push Day' ],
			], 200 ),
			'workout_delete_saved' => static function() use ( &$delete_called ): \WP_REST_Response {
				$delete_called = true;
				return new \WP_REST_Response( [ 'deleted' => true ], 200 );
			},
		] );

		$this->assertFalse( $delete_called );
		$this->assertStringContainsString( 'More than one', (string) ( $result['error'] ?? '' ) );
	}

	public function test_current_workout_exposes_the_queued_draft_and_matching_approval(): void {
		$draft = [
			'id' => 'draft-queued',
			'name' => 'Monday Circuit',
			'workout_structure' => 'circuit',
			'rounds' => 3,
			'exercises' => [[ 'exercise_name' => 'Pushup', 'target_reps' => 10 ]],
		];
		$result = AiToolHandlerService::execute( 42, 'get_current_workout', [], [
			'current_workout_payload' => static fn(): array => [
				'session' => [],
				'exercises' => [],
				'custom_workout_draft' => $draft,
				'workout_approval' => [ 'date' => '2026-08-07', 'workout_id' => 'draft-queued' ],
			],
			'today' => static fn( int $user_id ): string => '2026-08-07',
			'latest_workout_session_for_date' => static fn( int $user_id, string $date ): array => [],
			'latest_completed_workout_session' => static fn( int $user_id ): array => [],
			'normalise_tool_session_summary' => static fn( array $session ): array => $session,
			'normalise_tool_exercise_summary' => static fn( array $exercise ): array => $exercise,
			'daily_snapshot' => static fn( int $user_id ): array => [ 'training_status' => [ 'status' => 'scheduled', 'scheduled_day_type' => 'full_body' ] ],
		] );

		$this->assertTrue( $result['has_queued_workout'] ?? false );
		$this->assertSame( 'draft-queued', $result['queued_workout']['id'] ?? '' );
		$this->assertTrue( $result['queued_workout_is_approved'] ?? false );
		$this->assertFalse( $result['has_active_session'] ?? true );
	}

	public function test_weight_history_returns_every_measurement_and_a_chart(): void {
		$db = $this->wpdb();
		$db->expectGetRow( 'SELECT starting_weight_lb FROM wp_fit_user_profiles', (object) [ 'starting_weight_lb' => 205 ] );
		$db->expectGetRow( 'SELECT goal_type, target_weight_lb FROM wp_fit_user_goals', (object) [
			'goal_type' => 'cut',
			'target_weight_lb' => 185,
		] );
		$db->expectGetResults( 'SELECT id, metric_date, weight_lb, waist_in, body_fat_pct, resting_hr, notes', [
			(object) [ 'id' => 1, 'metric_date' => '2026-03-28', 'weight_lb' => 205, 'waist_in' => 38, 'body_fat_pct' => 24, 'resting_hr' => 70, 'notes' => 'Start' ],
			(object) [ 'id' => 2, 'metric_date' => '2026-04-04', 'weight_lb' => null, 'waist_in' => 37.75, 'body_fat_pct' => 23.5, 'resting_hr' => 69, 'notes' => 'Measurements only' ],
			(object) [ 'id' => 2, 'metric_date' => '2026-04-11', 'weight_lb' => 200, 'waist_in' => 37.5, 'body_fat_pct' => 23, 'resting_hr' => 68, 'notes' => 'Morning' ],
		] );

		$result = AiToolHandlerService::execute( 42, 'get_weight_history' );

		$this->assertSame( 'create_visualization', $result['action'] ?? '' );
		$this->assertSame( 'line', $result['type'] ?? '' );
		$this->assertSame( 3, $result['measurement_count'] ?? 0 );
		$this->assertSame( 2, $result['weight_measurement_count'] ?? 0 );
		$this->assertCount( 3, $result['measurements'] ?? [] );
		$this->assertCount( 2, $result['items'] ?? [] );
		$this->assertSame( -5.0, $result['total_change_lb'] ?? null );
		$this->assertSame( 5.0, $result['weight_lost_lb'] ?? null );
		$this->assertSame( -2.5, $result['average_weekly_change_lb'] ?? null );
		$this->assertSame( 15.0, $result['remaining_to_goal_lb'] ?? null );
		$this->assertSame( 25.0, $result['goal_progress_pct'] ?? null );
		$this->assertSame( 14, $result['days_spanned'] ?? null );
	}

	public function test_present_choices_sanitizes_and_bounds_the_decision_rail(): void {
		$result = AiToolHandlerService::execute( 42, 'present_choices', [
			'prompt' => 'What should we do next?',
			'style' => 'actions',
			'choices' => [
				[ 'label' => 'Start workout', 'type' => 'navigate', 'route' => '/workout', 'emphasis' => 'primary' ],
				[ 'label' => 'Make it shorter', 'type' => 'reply', 'response' => 'Make this workout 20 minutes.' ],
				[ 'label' => 'Unsafe route', 'type' => 'navigate', 'route' => 'https://example.com' ],
			],
		] );

		$this->assertSame( 'present_choices', $result['action'] ?? '' );
		$this->assertSame( 'actions', $result['style'] ?? '' );
		$this->assertCount( 2, $result['choices'] ?? [] );
		$this->assertSame( '/workout', $result['choices'][0]['route'] ?? '' );
		$this->assertSame( 'Make this workout 20 minutes.', $result['choices'][1]['response'] ?? '' );
	}

	public function test_log_cardio_uses_the_existing_cardio_endpoint(): void {
		$captured_request = null;
		$result = AiToolHandlerService::execute( 42, 'log_cardio', [
			'cardio_type' => 'running',
			'duration_minutes' => 35,
			'intensity' => 'hard',
			'distance' => 3.2,
			'notes' => 'Treadmill intervals',
		], [
			'normalise_tool_date' => static fn( int $user_id, string $date ): string => '2026-08-07',
			'format_tool_display_date' => static fn( int $user_id, string $date ): string => 'August 7, 2026',
			'body_log_cardio' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [ 'id' => 81 ], 201 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'log_cardio', $result['action'] ?? '' );
		$this->assertSame( 81, $result['id'] ?? 0 );
		$this->assertInstanceOf( \WP_REST_Request::class, $captured_request );
		$this->assertSame( 'running', $captured_request->get_param( 'cardio_type' ) );
		$this->assertSame( 35, $captured_request->get_param( 'duration_minutes' ) );
		$this->assertSame( '2026-08-07', $captured_request->get_param( 'date' ) );
	}

	public function test_log_rest_day_starts_and_completes_a_rest_session(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$completed_request = null;
		$result = AiToolHandlerService::execute( 42, 'log_rest_day', [], [
			'daily_snapshot' => static fn( int $user_id ): array => [ 'training_status' => [ 'recorded' => false ] ],
			'workout_start' => static function( \WP_REST_Request $request ): \WP_REST_Response {
				return new \WP_REST_Response( [ 'session_id' => 91, 'day_type' => $request->get_param( 'day_type' ) ], 201 );
			},
			'workout_complete' => static function( \WP_REST_Request $request ) use ( &$completed_request ): \WP_REST_Response {
				$completed_request = $request;
				return new \WP_REST_Response( [ 'completed' => true ], 200 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'log_rest_day', $result['action'] ?? '' );
		$this->assertSame( 91, $result['session_id'] ?? 0 );
		$this->assertInstanceOf( \WP_REST_Request::class, $completed_request );
		$this->assertSame( 91, $completed_request->get_param( 'id' ) );
		$this->assertSame( 'rest', $completed_request->get_param( 'actual_day_type' ) );
	}

	public function test_log_rest_day_does_not_replace_completed_training(): void {
		$result = AiToolHandlerService::execute( 42, 'log_rest_day', [], [
			'daily_snapshot' => static fn( int $user_id ): array => [
				'training_status' => [ 'recorded' => true, 'recorded_type' => 'push' ],
			],
		] );

		$this->assertStringContainsString( 'already has push training recorded', $result['error'] ?? '' );
	}

	public function test_get_daily_targets_refreshes_weight_based_goal_targets_before_returning(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 42', (object) [
			'user_id' => 42,
			'date_of_birth' => '',
			'starting_weight_lb' => 200,
			'height_cm' => 180,
			'sex' => 'male',
			'activity_level' => 'moderate',
		] );
		$db->expectGetRow( 'SELECT * FROM wp_fit_user_goals WHERE user_id = 42 AND active = 1', (object) [
			'id' => 9,
			'user_id' => 42,
			'goal_type' => 'cut',
			'goal_rate' => 'moderate',
			'target_calories' => 2175,
			'target_protein_g' => 200,
			'target_carbs_g' => 138,
			'target_fat_g' => 92,
			'target_steps' => 8000,
			'target_sleep_hours' => 8.0,
		] );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 190.0 );
		$db->expectGetRow( 'SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_steps, target_sleep_hours, goal_type', (object) [
			'target_calories' => 2105,
			'target_protein_g' => 190,
			'target_carbs_g' => 135,
			'target_fat_g' => 90,
			'target_steps' => 8000,
			'target_sleep_hours' => 8.0,
			'goal_type' => 'cut',
		] );

		$result = AiToolHandlerService::execute( 42, 'get_daily_targets' );

		$this->assertSame( 2105, $result['target_calories'] );
		$this->assertSame( 190, $result['target_protein_g'] );
		$this->assertSame( 135, $result['target_carbs_g'] );
		$this->assertSame( 90, $result['target_fat_g'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_user_goals', $db->updated[0]['table'] );
	}

	public function test_log_food_from_description_uses_nutrition_controller_path(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$captured_request = null;

		$result = AiToolHandlerService::execute( 7, 'log_food_from_description', [
			'food_text' => 'greek yogurt bowl',
			'meal_type' => 'snack',
			'meal_datetime' => 'today at 1:15pm',
		], [
			'analyse_food_text' => static function( int $user_id, string $food_text ): array {
				return [
					'food_name' => 'Greek Yogurt Bowl',
					'serving_size' => '1 bowl',
					'calories' => 320,
					'protein_g' => 28,
					'carbs_g' => 30,
					'fat_g' => 9,
					'fiber_g' => 4,
					'sugar_g' => 12,
					'sodium_mg' => 140,
					'micros' => [
						[ 'key' => 'calcium', 'label' => 'Calcium', 'amount' => 240, 'unit' => 'mg' ],
					],
					'confidence' => 0.84,
				];
			},
			'normalise_tool_datetime' => static fn( int $user_id, string $input ): string => '2026-04-09 13:15:00',
			'daily_nutrition_totals_for_date' => static fn( int $user_id, string $date ): array => [
				'calories' => 700,
				'protein_g' => 65,
				'meal_count' => 2,
			],
			'active_goal_targets' => static fn( int $user_id ): array => [ 'target_calories' => 2200 ],
			'nutrition_log_meal' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [
					'meal_id' => 44,
					'meal_datetime' => '2026-04-09 13:15:00',
				], 201 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'log_food_from_description', $result['action'] ?? '' );
		$this->assertSame( 44, $result['meal_id'] ?? null );
		$this->assertInstanceOf( \WP_REST_Request::class, $captured_request );
		$this->assertSame( 'snack', $captured_request->get_param( 'meal_type' ) );
		$this->assertSame( 'ai', $captured_request->get_param( 'source' ) );
		$this->assertSame( '2026-04-09 13:15:00', $captured_request->get_param( 'meal_datetime' ) );
		$this->assertSame( 'Greek Yogurt Bowl', $captured_request->get_param( 'items' )[0]['food_name'] ?? null );
	}

	public function test_create_food_tile_analyzes_and_saves_a_reusable_food(): void {
		$captured_request = null;
		$result = AiToolHandlerService::execute( 42, 'create_food_tile', [
			'food_text' => 'one cup nonfat Greek yogurt',
			'calories' => 140,
		], [
			'analyse_food_text' => static fn( int $user_id, string $food_text ): array => [
				'food_name' => 'Nonfat Greek Yogurt', 'serving_size' => '1 cup', 'calories' => 130,
				'protein_g' => 23, 'carbs_g' => 9, 'fat_g' => 0,
			],
			'nutrition_create_saved_food' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [ 'id' => 71 ], 201 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'create_food_tile', $result['action'] ?? '' );
		$this->assertSame( 71, $result['tile_id'] ?? 0 );
		$this->assertSame( 'Nonfat Greek Yogurt', $result['name'] ?? '' );
		$this->assertSame( 140, $result['calories'] ?? 0 );
		$this->assertSame( 23.0, $result['protein_g'] ?? 0 );
		$this->assertSame( 'ai_tile', $captured_request?->get_param( 'source' ) );
	}

	public function test_add_pantry_items_uses_nutrition_controller_path(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$captured_request = null;

		$result = AiToolHandlerService::execute( 7, 'add_pantry_items', [
			'items' => [ [ 'item_name' => 'Bananas' ] ],
		], [
			'build_tool_items_payload' => static fn( array $arguments, array $allowed ): array => [
				[ 'item_name' => 'Bananas', 'quantity' => 6, 'unit' => 'count' ],
			],
			'build_bulk_action_summary' => static fn( string $type, array $names, array $data ): string => 'Added pantry items.',
			'nutrition_add_pantry_items_bulk' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [
					'items' => [
						[ 'item' => [ 'item_name' => 'Bananas' ] ],
					],
					'created_count' => 1,
					'merged_count' => 0,
					'updated_count' => 0,
				], 200 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'add_pantry_items', $result['action'] ?? '' );
		$this->assertSame( [ 'Bananas' ], $result['item_names'] ?? [] );
		$this->assertInstanceOf( \WP_REST_Request::class, $captured_request );
		$this->assertSame( 'Bananas', $captured_request->get_param( 'items' )[0]['item_name'] ?? null );
	}

	public function test_set_training_schedule_uses_onboarding_controller_path(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$captured_request = null;

		$result = AiToolHandlerService::execute( 7, 'set_training_schedule', [
			'preferred_workout_days_json' => [
				[ 'day' => 'Mon', 'day_type' => 'push' ],
				[ 'day' => 'Wed', 'day_type' => 'pull' ],
				[ 'day' => 'Fri', 'day_type' => 'legs' ],
			],
		], [
			'onboarding_update_training_schedule' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [
					'saved' => true,
					'week_split' => [
						[ 'weekday_label' => 'Mon', 'day_type' => 'push', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Tue', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Wed', 'day_type' => 'pull', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Thu', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Fri', 'day_type' => 'legs', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Sat', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Sun', 'day_type' => 'rest', 'time_tier' => 'medium' ],
					],
				], 200 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'set_training_schedule', $result['action'] ?? '' );
		$this->assertSame( 3, $result['active_day_count'] ?? null );
		$this->assertSame( [ 'Mon Push', 'Wed Pull', 'Fri Legs' ], $result['active_day_labels'] ?? [] );
		$this->assertInstanceOf( \WP_REST_Request::class, $captured_request );
		$this->assertSame( 'Mon', $captured_request->get_param( 'preferred_workout_days_json' )[0]['day'] ?? null );
		$this->assertSame( 'push', $captured_request->get_param( 'preferred_workout_days_json' )[0]['day_type'] ?? null );
	}

	public function test_set_training_schedule_accepts_weekday_string_arrays(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$captured_request = null;

		$result = AiToolHandlerService::execute( 7, 'set_training_schedule', [
			'preferred_workout_days_json' => [ 'Mon', 'Wed', 'Fri' ],
		], [
			'onboarding_update_training_schedule' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [
					'saved' => true,
					'week_split' => [
						[ 'weekday_label' => 'Mon', 'day_type' => 'push', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Tue', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Wed', 'day_type' => 'pull', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Thu', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Fri', 'day_type' => 'legs', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Sat', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Sun', 'day_type' => 'rest', 'time_tier' => 'medium' ],
					],
				], 200 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'set_training_schedule', $result['action'] ?? '' );
		$this->assertSame(
			[
				[ 'day' => 'Mon', 'day_type' => 'push' ],
				[ 'day' => 'Wed', 'day_type' => 'pull' ],
				[ 'day' => 'Fri', 'day_type' => 'legs' ],
			],
			$captured_request->get_param( 'preferred_workout_days_json' ) ?? []
		);
	}

	public function test_set_training_schedule_allows_full_body_day_types(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$captured_request = null;

		$result = AiToolHandlerService::execute( 7, 'set_training_schedule', [
			'preferred_workout_days_json' => [
				[ 'day' => 'Wed', 'day_type' => 'full_body' ],
			],
		], [
			'onboarding_update_training_schedule' => static function( \WP_REST_Request $request ) use ( &$captured_request ): \WP_REST_Response {
				$captured_request = $request;
				return new \WP_REST_Response( [
					'saved' => true,
					'week_split' => [
						[ 'weekday_label' => 'Mon', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Tue', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Wed', 'day_type' => 'full_body', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Thu', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Fri', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Sat', 'day_type' => 'rest', 'time_tier' => 'medium' ],
						[ 'weekday_label' => 'Sun', 'day_type' => 'rest', 'time_tier' => 'medium' ],
					],
				], 200 );
			},
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame(
			[
				[ 'day' => 'Wed', 'day_type' => 'full_body' ],
			],
			$captured_request->get_param( 'preferred_workout_days_json' ) ?? []
		);
	}

	public function test_get_recipe_catalog_returns_recipe_library_items_with_cookbook_status(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$this->setOption( 'jf_recipe_library', [
			[
				'recipe_name' => 'Chicken Rice Bowl',
				'meal_type' => 'dinner',
				'ingredients' => [ 'Chicken', 'Rice', 'Broccoli' ],
				'instructions' => [ 'Cook chicken', 'Assemble bowls' ],
				'estimated_calories' => 540,
				'estimated_protein_g' => 99,
				'estimated_carbs_g' => 48,
				'estimated_fat_g' => 14,
				'dietary_tags' => [ 'high_protein' ],
				'why_this_works' => 'Balanced dinner with strong protein.',
			],
			[
				'recipe_name' => 'Greek Yogurt Parfait',
				'meal_type' => 'breakfast',
				'ingredients' => [ 'Greek Yogurt', 'Berries' ],
				'instructions' => [ 'Layer yogurt and berries' ],
				'estimated_calories' => 320,
				'estimated_protein_g' => 24,
				'estimated_carbs_g' => 28,
				'estimated_fat_g' => 8,
				'dietary_tags' => [ 'vegetarian' ],
				'why_this_works' => 'Simple protein-forward breakfast.',
			],
		] );
		\update_user_meta( 7, 'johnny5k_recipe_cookbook', [
			[
				'key' => 'admin-library-dinner-chicken-rice-bowl',
				'recipe_name' => 'Chicken Rice Bowl',
				'meal_type' => 'dinner',
				'ingredients' => [ 'Chicken', 'Rice', 'Broccoli' ],
				'instructions' => [ 'Cook chicken', 'Assemble bowls' ],
				'estimated_calories' => 540,
				'estimated_protein_g' => 99,
				'estimated_carbs_g' => 48,
				'estimated_fat_g' => 14,
			],
		] );

		$db = $this->wpdb();
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_recipe_suggestions WHERE user_id = 7 AND is_cookbook = 1', 0 );
		$db->expectGetResults( 'FROM wp_fit_recipe_suggestions', [
			[
				'recipe_key' => 'admin-library-dinner-chicken-rice-bowl',
				'meal_type' => 'dinner',
				'recipe_name' => 'Chicken Rice Bowl',
				'ingredients_json' => wp_json_encode( [ 'Chicken', 'Rice', 'Broccoli' ] ),
				'instructions_json' => wp_json_encode( [ 'Cook chicken', 'Assemble bowls' ] ),
				'estimated_calories' => 540,
				'estimated_protein_g' => 99,
				'estimated_carbs_g' => 48,
				'estimated_fat_g' => 14,
				'dietary_tags_json' => wp_json_encode( [ 'high_protein' ] ),
				'why_this_works' => '',
				'source' => 'admin_library',
				'image_url' => '',
			],
		] );
		$db->expectGetResults( 'SELECT item_name FROM wp_fit_pantry_items WHERE user_id = 7 ORDER BY updated_at DESC, id DESC LIMIT 12', [
			(object) [ 'item_name' => 'Chicken' ],
			(object) [ 'item_name' => 'Rice' ],
		] );
		$db->expectGetRow( 'SELECT food_preferences_json, food_dislikes_json, common_breakfasts_json', [
			'food_preferences_json' => '[]',
			'food_dislikes_json' => '[]',
			'common_breakfasts_json' => '[]',
		] );

		$result = AiToolHandlerService::execute( 7, 'get_recipe_catalog', [
			'meal_type' => 'dinner',
			'minimum_protein_g' => 30,
			'limit' => 5,
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'show_recipe_catalog', $result['action'] ?? '' );
		$this->assertGreaterThanOrEqual( 1, (int) ( $result['recipe_count'] ?? 0 ) );
		$this->assertNotEmpty( $result['recipes'] ?? [] );
		$matched_recipe = null;
		foreach ( (array) ( $result['recipes'] ?? [] ) as $recipe ) {
			if ( 'Chicken Rice Bowl' === ( $recipe['recipe_name'] ?? null ) ) {
				$matched_recipe = $recipe;
				break;
			}
		}
		$this->assertIsArray( $matched_recipe );
		$this->assertTrue( $matched_recipe['is_in_cookbook'] ?? false );
		$catalog_inserts = array_values( array_filter( $db->inserted, static fn( array $row ): bool => 0 === (int) ( $row['data']['is_cookbook'] ?? -1 ) ) );
		$this->assertNotEmpty( $catalog_inserts );
		$this->assertSame( 'admin_library', $catalog_inserts[0]['data']['source'] ?? null );
	}

	public function test_add_recipe_to_cookbook_persists_selected_recipe_from_library(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;
		$this->setOption( 'jf_recipe_library', [
			[
				'recipe_name' => 'Salmon Couscous Bowl',
				'meal_type' => 'dinner',
				'ingredients' => [ 'Salmon', 'Couscous', 'Cucumber' ],
				'instructions' => [ 'Bake salmon', 'Build bowl' ],
				'estimated_calories' => 610,
				'estimated_protein_g' => 44,
				'estimated_carbs_g' => 46,
				'estimated_fat_g' => 22,
				'dietary_tags' => [ 'mediterranean', 'high_protein' ],
				'why_this_works' => 'High-protein dinner with practical prep.',
			],
		] );

		$db = $this->wpdb();
		$db->expectGetResults( 'FROM wp_fit_recipe_suggestions', [] );
		$db->expectGetVar( "SELECT id FROM wp_fit_recipe_suggestions WHERE user_id = 7 AND recipe_key = 'admin-library-dinner-salmon-couscous-bowl' AND is_cookbook = 1", 0 );
		$db->expectGetResults( 'SELECT item_name FROM wp_fit_pantry_items WHERE user_id = 7 ORDER BY updated_at DESC, id DESC LIMIT 12', [
			(object) [ 'item_name' => 'Salmon' ],
		] );
		$db->expectGetRow( 'SELECT food_preferences_json, food_dislikes_json, common_breakfasts_json', [
			'food_preferences_json' => '[]',
			'food_dislikes_json' => '[]',
			'common_breakfasts_json' => '[]',
		] );
		$db->expectGetResults( 'SELECT item_name FROM wp_fit_pantry_items WHERE user_id = 7 ORDER BY item_name', [
			(object) [ 'item_name' => 'Salmon' ],
		] );

		$result = AiToolHandlerService::execute( 7, 'add_recipe_to_cookbook', [
			'recipe_name' => 'Salmon Couscous Bowl',
			'meal_type' => 'dinner',
		] );
		$cookbook_inserts = array_values( array_filter( $db->inserted, static fn( array $row ): bool => 1 === (int) ( $row['data']['is_cookbook'] ?? 0 ) ) );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'add_recipe_to_cookbook', $result['action'] ?? '' );
		$this->assertTrue( $result['added'] ?? false );
		$this->assertSame( 'Salmon Couscous Bowl', $result['recipe']['recipe_name'] ?? null );
		$this->assertTrue( $result['recipe']['is_in_cookbook'] ?? false );
		$this->assertCount( 1, $cookbook_inserts );
		$this->assertSame( 'Salmon Couscous Bowl', $cookbook_inserts[0]['data']['recipe_name'] ?? null );
		$this->assertSame( 'admin-library-dinner-salmon-couscous-bowl', $cookbook_inserts[0]['data']['recipe_key'] ?? null );
	}

	public function test_clear_follow_ups_can_dismiss_all_pending_items(): void {
		$result = AiToolHandlerService::execute( 7, 'clear_follow_ups', [
			'clear_all' => true,
		], [
			'list_pending_follow_ups' => static fn( int $user_id ): array => [
				[ 'id' => 'fu_1', 'prompt' => 'Log dinner.' ],
				[ 'id' => 'fu_2', 'prompt' => 'Log sleep.' ],
			],
			'dismiss_follow_up' => static fn( int $user_id, string $follow_up_id ): bool => in_array( $follow_up_id, [ 'fu_1', 'fu_2' ], true ),
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'clear_follow_ups', $result['action'] ?? '' );
		$this->assertSame( [ 'fu_1', 'fu_2' ], $result['cleared_ids'] ?? [] );
		$this->assertSame( 2, $result['cleared_count'] ?? null );
		$this->assertSame( 0, $result['failed_count'] ?? null );
	}

	public function test_clear_conversation_returns_thread_clear_action(): void {
		$result = AiToolHandlerService::execute( 7, 'clear_conversation' );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'clear_conversation', $result['action'] ?? '' );
		$this->assertSame( 'Chat cleared.', $result['summary'] ?? '' );
	}

	public function test_clear_sms_reminders_can_cancel_all_scheduled_items(): void {
		$result = AiToolHandlerService::execute( 7, 'clear_sms_reminders', [
			'clear_all' => true,
		], [
			'list_sms_reminders' => static fn( int $user_id ): array => [
				'scheduled' => [
					[ 'id' => 'sms_1', 'message' => 'Lift at 6.' ],
					[ 'id' => 'sms_2', 'message' => 'Sleep by 10.' ],
				],
			],
			'cancel_sms_reminder' => static fn( int $user_id, string $reminder_id ): array => [
				'id' => $reminder_id,
				'status' => 'canceled',
			],
		] );

		$this->assertTrue( $result['ok'] ?? false );
		$this->assertSame( 'clear_sms_reminders', $result['action'] ?? '' );
		$this->assertSame( [ 'sms_1', 'sms_2' ], $result['canceled_ids'] ?? [] );
		$this->assertSame( 2, $result['canceled_count'] ?? null );
		$this->assertSame( 0, $result['failed_count'] ?? null );
	}

	public function test_workout_planning_tools_use_structured_persistence_paths(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$approval = null;
		$current = static fn(): \WP_REST_Response => new \WP_REST_Response( [
			'session' => null,
			'custom_workout_draft' => [ 'id' => 'draft-1', 'name' => 'Circuit', 'workout_structure' => 'circuit', 'rounds' => 3, 'exercises' => [
				[ 'exercise_id' => 1, 'plan_exercise_id' => 1, 'exercise_name' => 'Pushup', 'target_type' => 'reps' ],
				[ 'exercise_id' => 2, 'plan_exercise_id' => 2, 'exercise_name' => 'Squat', 'target_type' => 'reps' ],
			] ],
		], 200 );
		$approved = AiToolHandlerService::execute( 42, 'approve_workout', [], [
			'workout_current' => $current,
			'save_workout_approval' => static function( int $user_id, array $value ) use ( &$approval ): void { $approval = $value; },
		] );
		$this->assertTrue( $approved['ok'] ?? false );
		$this->assertSame( 'draft-1', $approval['workout_id'] ?? '' );

		$search = AiToolHandlerService::execute( 42, 'search_exercises', [ 'query' => 'row', 'limit' => 5 ], [
			'training_get_exercises' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [[ 'id' => 8, 'name' => 'Dumbbell Row', 'query' => $request->get_param( 'q' ) ]], 200 ),
		] );
		$this->assertSame( 1, $search['count'] ?? 0 );
		$this->assertSame( 'row', $search['exercises'][0]['query'] ?? '' );

		$saved_request = null;
		$modified = AiToolHandlerService::execute( 42, 'modify_workout', [ 'action' => 'reorder', 'exercise_order' => [ 'Squat', 'Pushup' ] ], [
			'workout_current' => $current,
			'workout_save_custom_draft' => static function( \WP_REST_Request $request ) use ( &$saved_request ): \WP_REST_Response { $saved_request = $request; return new \WP_REST_Response( [ 'saved' => true ], 200 ); },
		] );
		$this->assertTrue( $modified['ok'] ?? false );
		$this->assertSame( 'Squat', $saved_request?->get_param( 'exercises' )[0]['exercise_name'] ?? '' );
	}

	public function test_queued_workout_replacement_is_atomic_and_supports_aliases(): void {
		$current = static fn(): \WP_REST_Response => new \WP_REST_Response( [
			'custom_workout_draft' => [ 'id' => 'draft-atomic', 'name' => 'Push Day', 'exercises' => [
				[ 'exercise_id' => 10, 'exercise_name' => 'Barbell Bench Press', 'target_type' => 'reps', 'sets' => 3, 'target_reps' => 10 ],
				[ 'exercise_id' => 11, 'exercise_name' => 'Cable Row', 'target_type' => 'reps', 'sets' => 3, 'target_reps' => 12 ],
			] ],
		], 200 );
		$saved_request = null;
		$result = AiToolHandlerService::execute( 42, 'modify_workout', [
			'action' => 'replace',
			'exercise_name' => 'Barbell Bench Press',
			'replacement_exercise_name' => 'Dumbbell Bench Press',
		], [
			'workout_current' => $current,
			'find_accessible_exercise_by_name' => static fn( int $user_id, string $name ) => 'dumbbell chest press' === strtolower( $name ) ? (object) [
				'id' => 25, 'name' => 'Dumbbell Chest Press', 'primary_muscle' => 'chest', 'movement_pattern' => 'horizontal_push', 'equipment' => 'dumbbell',
			] : null,
			'workout_save_custom_draft' => static function( \WP_REST_Request $request ) use ( &$saved_request ): \WP_REST_Response {
				$saved_request = $request;
				return new \WP_REST_Response( [ 'saved' => true ], 200 );
			},
		] );

		$exercises = $saved_request?->get_param( 'exercises' ) ?? [];
		$this->assertTrue( $result['ok'] ?? false );
		$this->assertCount( 2, $exercises );
		$this->assertSame( 'Dumbbell Chest Press', $exercises[0]['exercise_name'] ?? '' );
		$this->assertSame( 3, $exercises[0]['sets'] ?? null );
		$this->assertSame( 10, $exercises[0]['target_reps'] ?? null );
	}

	public function test_failed_queued_workout_replacement_does_not_save_or_remove_original(): void {
		$current = static fn(): \WP_REST_Response => new \WP_REST_Response( [
			'custom_workout_draft' => [ 'id' => 'draft-safe', 'exercises' => [ [ 'exercise_id' => 10, 'exercise_name' => 'Barbell Bench Press' ] ] ],
		], 200 );
		$save_calls = 0;
		$result = AiToolHandlerService::execute( 42, 'modify_workout', [
			'action' => 'replace', 'exercise_name' => 'Barbell Bench Press', 'replacement_exercise_name' => 'Imaginary Press',
		], [
			'workout_current' => $current,
			'find_accessible_exercise_by_name' => static fn( int $user_id, string $name ) => null,
			'workout_save_custom_draft' => static function() use ( &$save_calls ): \WP_REST_Response { $save_calls++; return new \WP_REST_Response( [], 200 ); },
		] );

		$this->assertSame( 0, $save_calls );
		$this->assertStringContainsString( 'left Barbell Bench Press in place', $result['error'] ?? '' );
	}

	public function test_creating_missing_exercise_completes_pending_workout_replacement(): void {
		$current = static fn(): \WP_REST_Response => new \WP_REST_Response( [
			'custom_workout_draft' => [ 'id' => 'draft-recovery', 'name' => 'Push Day', 'exercises' => [
				[ 'exercise_id' => 10, 'exercise_name' => 'Barbell Bench Press', 'sets' => 3, 'target_reps' => 8 ],
				[ 'exercise_id' => 11, 'exercise_name' => 'Cable Row', 'sets' => 3, 'target_reps' => 10 ],
			] ],
		], 200 );
		$pending = [];
		$created = false;
		$saved_request = null;
		$deps = [
			'workout_current' => $current,
			'load_pending_workout_replacement' => static function( int $user_id ) use ( &$pending ): array { return $pending; },
			'save_pending_workout_replacement' => static function( int $user_id, array $value ) use ( &$pending ): void { $pending = $value; },
			'clear_pending_workout_replacement' => static function( int $user_id ) use ( &$pending ): void { $pending = []; },
			'find_accessible_exercise_by_name' => static function( int $user_id, string $name ) use ( &$created ) {
				return $created && 'dumbbell bench press' === strtolower( $name ) ? (object) [ 'id' => 77, 'name' => 'Dumbbell Bench Press', 'equipment' => 'dumbbell' ] : null;
			},
			'training_save_personal_exercise' => static function( \WP_REST_Request $request ) use ( &$created ): \WP_REST_Response {
				$created = true;
				return new \WP_REST_Response( [ 'id' => 77, 'created' => true ], 201 );
			},
			'workout_save_custom_draft' => static function( \WP_REST_Request $request ) use ( &$saved_request ): \WP_REST_Response {
				$saved_request = $request;
				return new \WP_REST_Response( [ 'saved' => true ], 200 );
			},
		];

		$failed = AiToolHandlerService::execute( 42, 'modify_workout', [
			'action' => 'replace', 'exercise_name' => 'Barbell Bench Press', 'replacement_exercise_name' => 'Dumbbell Bench Press',
		], $deps );
		$this->assertArrayHasKey( 'error', $failed );
		$this->assertSame( 'draft-recovery', $pending['draft_id'] ?? '' );

		$result = AiToolHandlerService::execute( 42, 'create_personal_exercise', [
			'name' => 'Dumbbell Bench Press', 'primary_muscle' => 'chest', 'equipment' => 'dumbbell',
		], $deps );
		$exercises = $saved_request?->get_param( 'exercises' ) ?? [];
		$this->assertTrue( $result['completed_pending_replacement'] ?? false );
		$this->assertSame( [], $pending );
		$this->assertCount( 2, $exercises );
		$this->assertSame( 'Dumbbell Bench Press', $exercises[0]['exercise_name'] ?? '' );
		$this->assertSame( 3, $exercises[0]['sets'] ?? null );
	}

	public function test_generated_exercise_metadata_distinguishes_machine_shoulders_chest_and_triceps(): void {
		$method = new \ReflectionMethod( AiToolHandlerService::class, 'infer_custom_exercise_metadata' );
		$shoulder = $method->invoke( null, 'Seated Machine Shoulder Press', 'push' );
		$fly = $method->invoke( null, 'Machine Chest Fly', 'push' );
		$triceps = $method->invoke( null, 'Cable Triceps Pushdown', 'push' );

		$this->assertSame( 'shoulders', $shoulder['primary_muscle'] ?? '' );
		$this->assertSame( 'machine', $shoulder['equipment'] ?? '' );
		$this->assertSame( 'chest', $fly['primary_muscle'] ?? '' );
		$this->assertSame( 'machine', $fly['equipment'] ?? '' );
		$this->assertSame( 'triceps', $triceps['primary_muscle'] ?? '' );
		$this->assertSame( 'cable', $triceps['equipment'] ?? '' );
	}

	public function test_workout_execution_tools_route_start_sets_and_completion(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$draft_current = static fn(): \WP_REST_Response => new \WP_REST_Response( [ 'session' => null, 'custom_workout_draft' => [ 'id' => 'draft-2' ] ], 200 );
		$blocked = AiToolHandlerService::execute( 42, 'start_workout', [], [
			'workout_current' => $draft_current,
			'today' => static fn( int $user_id ): string => '2026-08-07',
			'load_workout_approval' => static fn( int $user_id ): array => [],
		] );
		$this->assertStringContainsString( 'Approve', $blocked['error'] ?? '' );
		$start_request = null;
		$started = AiToolHandlerService::execute( 42, 'start_workout', [ 'readiness_score' => 8 ], [
			'workout_current' => $draft_current,
			'today' => static fn( int $user_id ): string => '2026-08-07',
			'load_workout_approval' => static fn( int $user_id ): array => [ 'date' => '2026-08-07', 'workout_id' => 'draft-2' ],
			'workout_start' => static function( \WP_REST_Request $request ) use ( &$start_request ): \WP_REST_Response { $start_request = $request; return new \WP_REST_Response( [ 'session_id' => 51 ], 201 ); },
		] );
		$this->assertTrue( $started['ok'] ?? false );
		$this->assertSame( 'draft-2', $start_request?->get_param( 'custom_workout_draft_id' ) );

		$active = static fn(): \WP_REST_Response => new \WP_REST_Response( [ 'session' => [ 'id' => 51 ], 'exercises' => [[ 'id' => 71, 'exercise_name' => 'Pushup' ]] ], 200 );
		$created = AiToolHandlerService::execute( 42, 'manage_workout_set', [ 'action' => 'create', 'exercise_name' => 'Pushup', 'set_number' => 1, 'reps' => 12 ], [
			'workout_current' => $active,
			'workout_log_set' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'id' => 99, 'reps' => $request->get_param( 'reps' ) ], 201 ),
		] );
		$this->assertTrue( $created['ok'] ?? false );
		$this->assertSame( 12, $created['data']['reps'] ?? 0 );

		foreach ( [ 'update' => 'workout_update_set', 'delete' => 'workout_delete_set' ] as $action => $key ) {
			$result = AiToolHandlerService::execute( 42, 'manage_workout_set', [ 'action' => $action, 'set_id' => 99, 'reps' => 10 ], [
				'workout_current' => $active, $key => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'set_id' => $request->get_param( 'set_id' ) ], 200 ),
			] );
			$this->assertTrue( $result['ok'] ?? false, $action );
		}

		$completed = AiToolHandlerService::execute( 42, 'complete_workout', [], [
			'workout_current' => $active,
			'workout_complete' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'completed' => true, 'id' => $request->get_param( 'id' ) ], 200 ),
		] );
		$this->assertTrue( $completed['ok'] ?? false );
		$this->assertSame( 51, $completed['data']['id'] ?? 0 );

		$object_active = static fn(): \WP_REST_Response => new \WP_REST_Response( [ 'session' => (object) [ 'id' => 51 ] ], 200 );
		$canceled = AiToolHandlerService::execute( 42, 'cancel_workout', [], [
			'workout_current' => $object_active,
			'workout_discard' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'discarded' => true, 'id' => $request->get_param( 'id' ) ], 200 ),
		] );
		$this->assertTrue( $canceled['ok'] ?? false );
		$this->assertSame( 51, $canceled['data']['id'] ?? 0 );

		$timer = AiToolHandlerService::execute( 42, 'restart_workout_timer', [], [
			'workout_current' => $object_active,
			'workout_reset_timer' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'timer_restarted' => true, 'id' => $request->get_param( 'id' ) ], 200 ),
		] );
		$this->assertTrue( $timer['ok'] ?? false );
		$this->assertSame( 51, $timer['data']['id'] ?? 0 );

		$queued = AiToolHandlerService::execute( 42, 'cancel_workout', [], [
			'workout_current' => static fn(): \WP_REST_Response => new \WP_REST_Response( [ 'custom_workout_draft' => (object) [ 'id' => 'draft-2' ] ], 200 ),
			'workout_clear_custom_draft' => static fn(): \WP_REST_Response => new \WP_REST_Response( [ 'deleted' => true ], 200 ),
		] );
		$this->assertTrue( $queued['ok'] ?? false );
	}

	public function test_health_water_and_correction_tools_route_every_log_type(): void {
		$body = AiToolHandlerService::execute( 42, 'log_body_measurement', [ 'weight_lb' => 198.5, 'waist_in' => 37, 'body_fat_pct' => 22.5, 'resting_hr' => 64 ], [
			'body_log_weight' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [
				'id' => 1,
				'weight_lb' => $request->get_param( 'weight_lb' ),
				'waist_in' => $request->get_param( 'waist_in' ),
				'body_fat_pct' => $request->get_param( 'body_fat_pct' ),
				'resting_hr' => $request->get_param( 'resting_hr' ),
			], 201 ),
		] );
		$this->assertSame( 198.5, $body['data']['weight_lb'] ?? 0 );
		$this->assertSame( 37, $body['data']['waist_in'] ?? 0 );
		$this->assertSame( 22.5, $body['data']['body_fat_pct'] ?? 0 );
		$this->assertSame( 64, $body['data']['resting_hr'] ?? 0 );

		$method_keys = [ 'weight' => 'body_update_weight', 'sleep' => 'body_update_sleep', 'steps' => 'body_update_steps', 'cardio' => 'body_update_cardio' ];
		foreach ( $method_keys as $type => $key ) {
			$args = [ 'log_type' => $type, 'action' => 'update', 'id' => 5, 'date' => '2026-08-07', 'weight_lb' => 190, 'waist_in' => 36.5, 'body_fat_pct' => 21, 'resting_hr' => 62, 'hours_sleep' => 8, 'steps' => 9000, 'cardio_type' => 'walking', 'duration_minutes' => 30, 'intensity' => 'light' ];
			$result = AiToolHandlerService::execute( 42, 'manage_health_log', $args, [ $key => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [
				'updated' => true,
				'id' => $request->get_param( 'id' ),
				'waist_in' => $request->get_param( 'waist_in' ),
				'body_fat_pct' => $request->get_param( 'body_fat_pct' ),
				'resting_hr' => $request->get_param( 'resting_hr' ),
			], 200 ) ] );
			$this->assertTrue( $result['ok'] ?? false, $type );
			$this->assertSame( 36.5, $result['data']['waist_in'] ?? 0, $type );
			$this->assertSame( 21, $result['data']['body_fat_pct'] ?? 0, $type );
			$this->assertSame( 62, $result['data']['resting_hr'] ?? 0, $type );
		}
		$deleted = AiToolHandlerService::execute( 42, 'manage_health_log', [ 'log_type' => 'cardio', 'action' => 'delete', 'id' => 5 ], [
			'body_delete_cardio' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( null, 204 ),
		] );
		$this->assertTrue( $deleted['ok'] ?? false );

		$water = AiToolHandlerService::execute( 42, 'log_water', [ 'glasses' => 6 ], [
			'nutrition_save_water' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'glasses' => $request->get_param( 'glasses' ) ], 200 ),
		] );
		$this->assertSame( 6, $water['data']['glasses'] ?? 0 );
	}

	public function test_meal_saved_meal_goal_and_profile_tools_cover_all_actions(): void {
		foreach ( [ 'update' => 'nutrition_update_meal', 'delete' => 'nutrition_delete_meal' ] as $action => $key ) {
			$result = AiToolHandlerService::execute( 42, 'manage_meal', [ 'action' => $action, 'id' => 9, 'meal_type' => 'dinner', 'items' => [] ], [
				$key => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'ok' => true, 'id' => $request->get_param( 'id' ) ], 200 ),
			] );
			$this->assertTrue( $result['ok'] ?? false, $action );
		}
		foreach ( [ 'create', 'update', 'delete', 'log' ] as $action ) {
			$key = 'nutrition_' . ( 'create' === $action ? 'create_saved_meal' : ( 'update' === $action ? 'update_saved_meal' : ( 'delete' === $action ? 'delete_saved_meal' : 'log_saved_meal' ) ) );
			$result = AiToolHandlerService::execute( 42, 'manage_saved_meal', [ 'action' => $action, 'id' => 7, 'name' => 'Lunch', 'items' => [] ], [
				$key => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'ok' => true ], 200 ),
			] );
			$this->assertTrue( $result['ok'] ?? false, $action );
		}

		$goals = AiToolHandlerService::execute( 42, 'update_goals', [ 'target_steps' => 10000, 'target_sleep_hours' => 8 ], [
			'update_goals' => static fn( int $user_id, array $values ): bool => 42 === $user_id && 10000 === $values['target_steps'],
		] );
		$this->assertSame( [ 'target_steps', 'target_sleep_hours' ], $goals['updated_fields'] ?? [] );

		$profile = AiToolHandlerService::execute( 42, 'update_profile', [ 'timezone' => 'America/New_York', 'units' => 'imperial' ], [
			'onboarding_save_profile' => static fn( \WP_REST_Request $request ): \WP_REST_Response => new \WP_REST_Response( [ 'saved' => true, 'timezone' => $request->get_param( 'timezone' ) ], 200 ),
		] );
		$this->assertTrue( $profile['ok'] ?? false );
		$this->assertSame( 'America/New_York', $profile['data']['timezone'] ?? '' );
	}
}
