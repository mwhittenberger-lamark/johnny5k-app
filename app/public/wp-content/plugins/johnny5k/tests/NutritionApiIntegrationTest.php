<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Tests\Support\ApiIntegrationTestCase;
use Johnny5k\Tests\Support\TestAiMealController;

class NutritionApiIntegrationTest extends ApiIntegrationTestCase {
	public function test_nutrition_summary_refreshes_weight_based_targets_before_returning_summary(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 42;

		$db->expectGetResults( "AND DATE(m.meal_datetime) = '2026-04-12'", [] );
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
		] );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 190.0 );
		$db->expectGetRow( 'SELECT SUM(mi.calories)  AS calories', (object) [
			'calories' => 1800,
			'protein_g' => 150,
			'carbs_g' => 170,
			'fat_g' => 55,
			'fiber_g' => 22,
			'sodium_mg' => 1800,
		] );
		$db->expectGetRow( 'SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g', (object) [
			'target_calories' => 2105,
			'target_protein_g' => 190,
			'target_carbs_g' => 135,
			'target_fat_g' => 90,
		] );
		$db->expectGetResults( 'FROM wp_fit_workout_sessions', [] );
		$db->expectGetVar( 'FROM wp_fit_cardio_logs', 0 );
		$db->expectGetRow( 'SELECT exercise_preferences_json FROM wp_fit_user_preferences', null );
		$db->expectGetResults( 'FROM wp_fit_workout_sessions', [] );
		$db->expectGetVar( 'FROM wp_fit_cardio_logs', 0 );
		$db->expectGetResults( 'FROM wp_fit_meal_items mi', [] );

		$req = new \WP_REST_Request( 'GET', '/fit/v1/nutrition/summary' );
		$req->set_param( 'date', '2026-04-12' );

		$response = TestAiMealController::get_nutrition_summary( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 190, (int) $data['targets']->target_protein_g );
		$this->assertSame( 2105, (int) $data['targets']->target_calories );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_user_goals', $db->updated[0]['table'] );
		$this->assertSame( 190, $db->updated[0]['data']['target_protein_g'] );
	}

	public function test_meal_logging_creates_meal_and_items(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow(
			"WHERE user_id = 7 AND meal_type = 'lunch' AND DATE(meal_datetime) = '2026-04-09' AND confirmed = 1",
			null
		);

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/meal' );
		$req->set_param( 'meal_datetime', '2026-04-09 12:00:00' );
		$req->set_param( 'meal_type', 'lunch' );
		$req->set_param( 'source', 'manual' );
		$req->set_param( 'items', [
			[
				'food_name' => 'Chicken Rice Bowl',
				'serving_amount' => 1,
				'serving_unit' => 'bowl',
				'calories' => 550,
				'protein_g' => 45,
				'carbs_g' => 50,
				'fat_g' => 12,
				'micros' => [
					[
						'key' => 'iron',
						'label' => 'Iron',
						'amount' => 2.4,
						'unit' => 'mg',
					],
				],
			],
		] );

		$response = TestAiMealController::log_meal( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 1, $data['meal_id'] );
		$this->assertSame( [ 7 ], TestAiMealController::$synced_awards );
		$this->assertCount( 3, $db->inserted );
		$this->assertSame( 'wp_fit_meals', $db->inserted[0]['table'] );
		$this->assertSame( 'wp_fit_meal_items', $db->inserted[1]['table'] );
		$this->assertSame( 'Chicken Rice Bowl', $db->inserted[1]['data']['food_name'] );
		$this->assertSame( 'wp_fit_behavior_events', $db->inserted[2]['table'] );
	}

	public function test_beverage_logging_marks_beverage_items_and_type(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow(
			"WHERE user_id = 7 AND meal_type = 'beverage' AND DATE(meal_datetime) = '2026-04-09' AND confirmed = 1",
			null
		);

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/meal' );
		$req->set_param( 'meal_datetime', '2026-04-09 15:30:00' );
		$req->set_param( 'meal_type', 'beverage' );
		$req->set_param( 'source', 'manual' );
		$req->set_param( 'items', [
			[
				'food_name' => 'Iced Latte',
				'serving_amount' => 1,
				'serving_unit' => '16 fl oz',
				'calories' => 190,
				'protein_g' => 9,
				'carbs_g' => 24,
				'fat_g' => 6,
				'is_beverage' => true,
				'micros' => [
					[
						'key' => 'calcium',
						'label' => 'Calcium',
						'amount' => 150,
						'unit' => 'mg',
					],
				],
			],
		] );

		$response = TestAiMealController::log_meal( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 1, $data['meal_id'] );
		$this->assertSame( 'beverage', $db->inserted[0]['data']['meal_type'] );
		$this->assertSame( 1, $db->inserted[1]['data']['is_beverage'] );
	}

	public function test_meal_logging_with_malformed_items_returns_400(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/meal' );
		$req->set_param( 'meal_datetime', '2026-04-09 12:00:00' );
		$req->set_param( 'meal_type', 'lunch' );
		$req->set_param( 'items', 'not-an-array' );

		$response = TestAiMealController::log_meal( $req );
		$data = $response->get_data();

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'At least one meal item is required.', $data['message'] );
		$this->assertSame( [], TestAiMealController::$synced_awards );
	}

	public function test_log_saved_meal_creates_meal_from_library_template(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow(
			"SELECT * FROM wp_fit_saved_meals WHERE id = 12 AND user_id = 7",
			(object) [
				'id' => 12,
				'user_id' => 7,
				'meal_type' => 'breakfast',
				'items_json' => wp_json_encode( [
					[
						'food_name' => 'Overnight oats',
						'serving_amount' => 1,
						'serving_unit' => 'jar',
						'calories' => 420,
						'protein_g' => 24,
						'carbs_g' => 52,
						'fat_g' => 11,
						'micros' => [
							[
								'key' => 'calcium',
								'label' => 'Calcium',
								'amount' => 180,
								'unit' => 'mg',
							],
						],
					],
				] ),
			]
		);
		$db->expectGetRow(
			"WHERE user_id = 7 AND meal_type = 'breakfast' AND DATE(meal_datetime) = '2026-04-09' AND confirmed = 1",
			null
		);

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/saved-meals/12/log' );
		$req->set_param( 'id', 12 );
		$req->set_param( 'serving_multiplier', 1.5 );

		$response = TestAiMealController::log_saved_meal( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 1, $data['meal_id'] );
		$this->assertSame( [ 7 ], TestAiMealController::$synced_awards );
		$this->assertCount( 3, $db->inserted );
		$this->assertSame( 'wp_fit_meals', $db->inserted[0]['table'] );
		$this->assertSame( 'breakfast', $db->inserted[0]['data']['meal_type'] );
		$this->assertSame( 'saved_meal', $db->inserted[0]['data']['source'] );
		$this->assertSame( '2026-04-09 12:00:00', $db->inserted[0]['data']['meal_datetime'] );
		$this->assertSame( 'wp_fit_meal_items', $db->inserted[1]['table'] );
		$this->assertSame( 'Overnight oats', $db->inserted[1]['data']['food_name'] );
		$this->assertSame( 1.5, $db->inserted[1]['data']['serving_amount'] );
		$this->assertSame( 630, $db->inserted[1]['data']['calories'] );
		$this->assertStringContainsString( '"saved_meal_id":12', (string) $db->inserted[1]['data']['source_json'] );
	}

	public function test_log_saved_meal_with_empty_library_template_returns_400(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow(
			"SELECT * FROM wp_fit_saved_meals WHERE id = 12 AND user_id = 7",
			(object) [
				'id' => 12,
				'user_id' => 7,
				'meal_type' => 'lunch',
				'items_json' => '[]',
			]
		);

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/saved-meals/12/log' );
		$req->set_param( 'id', 12 );

		$response = TestAiMealController::log_saved_meal( $req );
		$data = $response->get_data();

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'Saved meal has no items. Edit or delete it first.', $data['message'] );
		$this->assertSame( [], $db->inserted );
		$this->assertSame( [], TestAiMealController::$synced_awards );
	}

	public function test_save_water_intake_creates_daily_hydration_row(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( "FROM wp_fit_hydration_logs WHERE user_id = 7 AND log_date = '2026-04-12'", 0 );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'America/New_York' );
		$db->expectGetResults( 'FROM wp_fit_meal_items mi', [] );
		$db->expectGetResults( 'FROM wp_fit_hydration_logs', [
			[
				'log_date' => '2026-04-12',
				'glasses' => 4,
				'target_glasses' => 6,
			],
		] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/water' );
		$req->set_param( 'date', '2026-04-12' );
		$req->set_param( 'glasses', 4 );

		$response = TestAiMealController::save_water_intake( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'wp_fit_hydration_logs', $db->inserted[0]['table'] );
		$this->assertSame( 4, $db->inserted[0]['data']['glasses'] );
		$this->assertSame( 4, $data['water']['glasses'] );
	}

	public function test_save_water_intake_returns_error_when_hydration_write_fails(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( "FROM wp_fit_hydration_logs WHERE user_id = 7 AND log_date = '2026-04-12'", 0 );
		$db->queueInsertResult( false, 'Table \'wp_fit_hydration_logs\' doesn\'t exist' );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/water' );
		$req->set_param( 'date', '2026-04-12' );
		$req->set_param( 'glasses', 4 );

		$response = TestAiMealController::save_water_intake( $req );
		$data = $response->get_data();

		$this->assertSame( 500, $response->get_status() );
		$this->assertSame( 'hydration_save_failed', $data['code'] );
		$this->assertSame( 'Could not save water intake right now.', $data['message'] );
	}
}
