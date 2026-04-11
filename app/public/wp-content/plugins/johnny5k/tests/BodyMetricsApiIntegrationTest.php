<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\BodyMetricsController;

class BodyMetricsApiIntegrationTest extends \Johnny5k\Tests\Support\ApiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();
		\wp_set_current_user( 42 );
	}

	public function test_body_metrics_returns_weight_sleep_steps_cardio_and_movement_series(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );
		$this->wpdb()->expectGetResults(
			'FROM wp_fit_body_metrics',
			[
				[ 'date' => '2026-04-08', 'weight_lb' => 201.4 ],
			]
		);
		$this->wpdb()->expectGetResults(
			'FROM wp_fit_sleep_logs',
			[
				[ 'date' => '2026-04-08', 'hours_sleep' => 7.5 ],
			]
		);
		$this->wpdb()->expectGetResults(
			'FROM wp_fit_step_logs',
			[
				[ 'date' => '2026-04-08', 'steps' => 3200 ],
			]
		);
		$this->wpdb()->expectGetResults(
			'SUM(duration_minutes) AS duration_minutes',
			[
				[ 'date' => '2026-04-08', 'duration_minutes' => 10, 'sessions' => 1, 'estimated_calories' => 120 ],
			]
		);
		$this->wpdb()->expectGetResults(
			'SELECT cardio_date AS date, cardio_type, intensity, duration_minutes',
			[
				[ 'date' => '2026-04-08', 'cardio_type' => 'running', 'intensity' => 'moderate', 'duration_minutes' => 10 ],
			]
		);

		$request = new \WP_REST_Request( 'GET', '/body/metrics' );
		$request->set_param( 'days', 7 );

		$response = BodyMetricsController::get_metrics( $request );
		$data = $response->get_data();

		self::assertSame( 200, $response->get_status() );
		self::assertSame( 201.4, $data['weight'][0]->weight_lb );
		self::assertSame( 7.5, $data['sleep'][0]->hours_sleep );
		self::assertSame( 3200, $data['steps'][0]->steps );
		self::assertSame( 10, $data['cardio'][0]->duration_minutes );
		self::assertSame(
			[
				'date' => '2026-04-08',
				'steps' => 4900,
				'actual_steps' => 3200,
				'cardio_equivalent_steps' => 1700,
			],
			$data['movement'][0]
		);
	}

	public function test_log_weight_rejects_non_positive_values(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );
		$request = new \WP_REST_Request( 'POST', '/body/weight' );
		$request->set_param( 'weight_lb', 0 );

		$response = BodyMetricsController::log_weight( $request );

		self::assertSame( 400, $response->get_status() );
		self::assertSame( [ 'message' => 'Invalid weight value.' ], $response->get_data() );
	}

	public function test_get_health_flags_returns_active_rows(): void {
		$this->wpdb()->expectGetResults(
			'FROM wp_fit_user_health_flags',
			[
				[ 'id' => 5, 'flag_type' => 'pain', 'body_area' => 'knee', 'active' => 1 ],
			]
		);

		$response = BodyMetricsController::get_health_flags( new \WP_REST_Request( 'GET', '/body/health-flags' ) );
		$data = $response->get_data();

		self::assertSame( 200, $response->get_status() );
		self::assertCount( 1, $data );
		self::assertSame( 'knee', $data[0]->body_area );
	}
}