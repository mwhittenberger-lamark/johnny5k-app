<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Tests\Support\ApiIntegrationTestCase;
use Johnny5k\Tests\Support\TestAiMealController;

class NutritionApiIntegrationTest extends ApiIntegrationTestCase {
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
}
