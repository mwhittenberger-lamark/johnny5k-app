<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\DashboardController;
use Johnny5k\Tests\Support\ApiIntegrationTestCase;

class TestDashboardController extends DashboardController {
	public static mixed $review_result = null;
	public static mixed $story_result = null;
	public static ?array $coaching_context_result = null;
	public static array $review_calls = [];
	public static array $story_calls = [];
	public static array $coaching_context_calls = [];

	protected static function fetch_dashboard_review( int $user_id, bool $force ) {
		self::$review_calls[] = compact( 'user_id', 'force' );
		return self::$review_result;
	}

	protected static function fetch_dashboard_real_success_story( int $user_id, bool $force ) {
		self::$story_calls[] = compact( 'user_id', 'force' );
		return self::$story_result;
	}

	protected static function get_coaching_context_data( int $user_id ): array {
		self::$coaching_context_calls[] = [ 'user_id' => $user_id ];
		return self::$coaching_context_result ?? [];
	}
}

class DashboardApiIntegrationTest extends ApiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();

		TestDashboardController::$review_result = null;
		TestDashboardController::$story_result = null;
		TestDashboardController::$coaching_context_result = null;
		TestDashboardController::$review_calls = [];
		TestDashboardController::$story_calls = [];
		TestDashboardController::$coaching_context_calls = [];
		\wp_set_current_user( 42 );
	}

	public function test_dashboard_coaching_context_returns_payload(): void {
		$request = new \WP_REST_Request( 'GET', '/dashboard/coaching-context' );
		TestDashboardController::$coaching_context_result = [
			'loaded_at' => '2026-04-14 16:40:00',
			'data_availability' => [
				'coaching_context_loaded' => true,
				'weights_loaded' => true,
			],
			'weights' => [ [ 'metric_date' => '2026-04-14', 'weight_lb' => 197.2 ] ],
			'sleep_logs' => [],
			'step_logs' => [],
			'cardio_logs' => [],
			'workout_history' => [],
			'meals' => [],
			'weekly_calories_review' => [
				'isLoaded' => true,
				'totalCalories' => 10800,
				'targetCalories' => 14000,
				'loggedDays' => 5,
				'periodLabel' => 'Last 7 days',
			],
		];

		$response = TestDashboardController::get_coaching_context( $request );
		$data = $response->get_data();

		self::assertSame( 200, $response->get_status() );
		self::assertTrue( $data['data_availability']['coaching_context_loaded'] );
		self::assertSame( 197.2, $data['weights'][0]['weight_lb'] );
		self::assertSame( 5, $data['weekly_calories_review']['loggedDays'] );
		self::assertSame( [ [ 'user_id' => 42 ] ], TestDashboardController::$coaching_context_calls );
	}

	public function test_dashboard_weekly_calorie_rollup_counts_only_logged_days(): void {
		$result = $this->invokePrivateStatic( DashboardController::class, 'build_dashboard_weekly_calories_review', [
			[
				[
					'totals' => [ 'calories' => 2100 ],
					'targets' => [ 'target_calories' => 2300 ],
				],
				[
					'totals' => (object) [ 'calories' => 0 ],
					'targets' => (object) [ 'target_calories' => 2300 ],
				],
				[
					'totals' => [ 'calories' => 1800 ],
					'targets' => [ 'target_calories' => 2300 ],
				],
			],
		] );

		self::assertTrue( $result['isLoaded'] );
		self::assertSame( 3900, $result['totalCalories'] );
		self::assertSame( 6900, $result['targetCalories'] );
		self::assertSame( 2, $result['loggedDays'] );
		self::assertSame( 'Last 7 days', $result['periodLabel'] );
	}

	public function test_dashboard_review_returns_ai_payload_and_sanitized_force_flag(): void {
		$request = new \WP_REST_Request( 'GET', '/dashboard/johnny-review' );
		$request->set_param( 'force', 'yes' );
		TestDashboardController::$review_result = [
			'review' => 'Strong week so far.',
			'cached' => false,
		];

		$response = TestDashboardController::get_johnny_review( $request );

		self::assertSame( 200, $response->get_status() );
		self::assertSame( [ 'review' => 'Strong week so far.', 'cached' => false ], $response->get_data() );
		self::assertSame( [ [ 'user_id' => 42, 'force' => true ] ], TestDashboardController::$review_calls );
	}

	public function test_dashboard_review_surfaces_ai_errors_as_500(): void {
		$request = new \WP_REST_Request( 'GET', '/dashboard/johnny-review' );
		TestDashboardController::$review_result = new \WP_Error( 'ai_failed', 'Review unavailable.' );

		$response = TestDashboardController::get_johnny_review( $request );

		self::assertSame( 500, $response->get_status() );
		self::assertSame( [ 'message' => 'Review unavailable.' ], $response->get_data() );
	}

	public function test_real_success_story_returns_payload(): void {
		$request = new \WP_REST_Request( 'GET', '/dashboard/real-success-story' );
		$request->set_param( 'force', '1' );
		TestDashboardController::$story_result = [
			'title' => 'Lost 40 pounds',
			'cached' => true,
		];

		$response = TestDashboardController::get_real_success_story( $request );

		self::assertSame( 200, $response->get_status() );
		self::assertSame( [ 'title' => 'Lost 40 pounds', 'cached' => true ], $response->get_data() );
		self::assertSame( [ [ 'user_id' => 42, 'force' => true ] ], TestDashboardController::$story_calls );
	}
}