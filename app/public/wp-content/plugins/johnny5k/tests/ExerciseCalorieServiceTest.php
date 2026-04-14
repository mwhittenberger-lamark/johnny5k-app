<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\ExerciseCalorieService;
use Johnny5k\Tests\Support\ServiceTestCase;

class ExerciseCalorieServiceTest extends ServiceTestCase {
	public function test_daily_exercise_calories_falls_back_to_strength_estimate_when_workout_row_has_no_stored_calories(): void {
		$db = $this->wpdb();
		$db->expectGetResults( 'FROM wp_fit_workout_sessions', [
			[
				'actual_day_type' => 'push',
				'planned_day_type' => 'push',
				'time_tier' => 'medium',
				'duration_minutes' => 45,
				'estimated_calories' => 0,
			],
		] );
		$db->expectGetVar( 'FROM wp_fit_cardio_logs', 120 );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 200 );

		$result = ExerciseCalorieService::get_daily_exercise_calories( 7, '2026-04-11' );

		$this->assertSame( 220, $result['workout_calories'] );
		$this->assertSame( 120, $result['cardio_calories'] );
		$this->assertSame( $result['workout_calories'] + 120, $result['total_calories'] );
	}
}
