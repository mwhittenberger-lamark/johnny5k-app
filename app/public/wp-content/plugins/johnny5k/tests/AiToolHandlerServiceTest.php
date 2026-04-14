<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiToolHandlerService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiToolHandlerServiceTest extends ServiceTestCase {
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
}
