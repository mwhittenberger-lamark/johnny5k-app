<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiToolHandlerService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiToolHandlerServiceTest extends ServiceTestCase {
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
}
