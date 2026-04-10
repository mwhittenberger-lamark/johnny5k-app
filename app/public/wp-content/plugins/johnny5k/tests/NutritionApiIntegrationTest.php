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
}
