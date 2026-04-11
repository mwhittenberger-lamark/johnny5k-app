<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\DashboardController;
use Johnny5k\Tests\Support\ApiIntegrationTestCase;

class TestDashboardController extends DashboardController {
	public static mixed $review_result = null;
	public static mixed $story_result = null;
	public static array $review_calls = [];
	public static array $story_calls = [];

	protected static function fetch_dashboard_review( int $user_id, bool $force ) {
		self::$review_calls[] = compact( 'user_id', 'force' );
		return self::$review_result;
	}

	protected static function fetch_dashboard_real_success_story( int $user_id, bool $force ) {
		self::$story_calls[] = compact( 'user_id', 'force' );
		return self::$story_result;
	}
}

class DashboardApiIntegrationTest extends ApiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();

		TestDashboardController::$review_result = null;
		TestDashboardController::$story_result = null;
		TestDashboardController::$review_calls = [];
		TestDashboardController::$story_calls = [];
		\wp_set_current_user( 42 );
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