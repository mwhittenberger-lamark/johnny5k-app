<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\CalorieEngine;
use Johnny5k\Tests\Support\ServiceTestCase;

class CalorieEngineTest extends ServiceTestCase {
	public function test_calculate_initial_returns_expected_targets_for_moderate_cut(): void {
		$profile = (object) [
			'date_of_birth' => '',
			'starting_weight_lb' => 200,
			'height_cm' => 180,
			'sex' => 'male',
			'activity_level' => 'moderate',
		];
		$goal = (object) [
			'goal_type' => 'cut',
			'goal_rate' => 'moderate',
		];

		$result = CalorieEngine::calculate_initial( $profile, $goal );

		$this->assertSame( 2175, $result['calories'] );
		$this->assertSame( 200, $result['protein_g'] );
		$this->assertSame( 138, $result['carbs_g'] );
		$this->assertSame( 92, $result['fat_g'] );
		$this->assertSame( 1887, $result['bmr'] );
		$this->assertSame( 2925, $result['tdee'] );
	}

	public function test_calculate_initial_uses_weight_override_for_weight_based_targets(): void {
		$profile = (object) [
			'date_of_birth' => '',
			'starting_weight_lb' => 200,
			'height_cm' => 180,
			'sex' => 'male',
			'activity_level' => 'moderate',
		];
		$goal = (object) [
			'goal_type' => 'cut',
			'goal_rate' => 'moderate',
		];

		$result = CalorieEngine::calculate_initial( $profile, $goal, 190.0 );

		$this->assertSame( 2105, $result['calories'] );
		$this->assertSame( 190, $result['protein_g'] );
		$this->assertSame( 135, $result['carbs_g'] );
		$this->assertSame( 90, $result['fat_g'] );
		$this->assertSame( 1842, $result['bmr'] );
		$this->assertSame( 2855, $result['tdee'] );
	}

	public function test_refresh_active_goal_targets_updates_active_goal_from_latest_logged_weight(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles', (object) [
			'user_id' => 42,
			'date_of_birth' => '',
			'starting_weight_lb' => 200,
			'height_cm' => 180,
			'sex' => 'male',
			'activity_level' => 'moderate',
		] );
		$db->expectGetRow( 'SELECT * FROM wp_fit_user_goals', (object) [
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

		$result = CalorieEngine::refresh_active_goal_targets( 42 );

		$this->assertIsArray( $result );
		$this->assertSame( 190.0, $result['weight_lb'] );
		$this->assertSame( 2105, $result['targets']['calories'] );
		$this->assertSame( 190, $result['targets']['protein_g'] );
		$this->assertSame( 135, $result['targets']['carbs_g'] );
		$this->assertSame( 90, $result['targets']['fat_g'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_user_goals', $db->updated[0]['table'] );
		$this->assertSame(
			[
				'target_calories' => 2105,
				'target_protein_g' => 190,
				'target_carbs_g' => 135,
				'target_fat_g' => 90,
			],
			$db->updated[0]['data']
		);
		$this->assertSame(
			[
				'id' => 9,
				'user_id' => 42,
			],
			$db->updated[0]['where']
		);
	}

	public function test_calculate_weekly_adjustment_uses_conservative_decrease_when_cut_is_stalled_and_recovery_is_poor(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_body_metrics', 8 );
		$db->expectGetVar( 'COUNT(DISTINCT DATE(meal_datetime)) FROM wp_fit_meals', 6 );
		$db->expectGetVar( 'AND metric_date <', 200.1 );
		$db->expectGetVar( 'SELECT AVG(weight_lb) FROM wp_fit_body_metrics', 200.0 );
		$db->expectGetRow( 'FROM wp_fit_user_goals g', (object) [
			'target_calories' => 2200,
			'goal_type' => 'cut',
			'target_sleep_hours' => 8,
			'target_steps' => 8000,
		] );
		$db->expectGetVar( 'AVG(hours_sleep) FROM wp_fit_sleep_logs', 6.0 );
		$db->expectGetVar( 'AVG(steps) FROM wp_fit_step_logs', 7600 );
		$db->expectGetVar( 'SUM(duration_minutes), 0) FROM wp_fit_cardio_logs', 30 );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_user_health_flags', 0 );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 200.0 );
		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 7', (object) [
			'starting_weight_lb' => 200,
		] );

		$result = CalorieEngine::calculate_weekly_adjustment( 7 );

		$this->assertIsArray( $result );
		$this->assertSame( 'decrease', $result['action'] );
		$this->assertSame( -100, $result['delta_calories'] );
		$this->assertSame( 2100, $result['new_target_calories'] );
		$this->assertSame( 200, $result['macro_targets']['protein_g'] );
		$this->assertSame( 130, $result['macro_targets']['carbs_g'] );
		$this->assertSame( 87, $result['macro_targets']['fat_g'] );
		$this->assertStringContainsString( 'Recovery data suggests caution', $result['reason'] );
	}

	public function test_calculate_weekly_adjustment_returns_null_when_data_is_insufficient(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_body_metrics', 4 );
		$db->expectGetVar( 'COUNT(DISTINCT DATE(meal_datetime)) FROM wp_fit_meals', 3 );

		$this->assertNull( CalorieEngine::calculate_weekly_adjustment( 7 ) );
	}

	public function test_calculate_weekly_adjustment_increases_calories_when_gain_progress_is_too_slow(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_body_metrics', 10 );
		$db->expectGetVar( 'COUNT(DISTINCT DATE(meal_datetime)) FROM wp_fit_meals', 7 );
		$db->expectGetVar( 'SELECT AVG(weight_lb) FROM wp_fit_body_metrics', 180.0 );
		$db->expectGetVar( 'AND metric_date <', 179.9 );
		$db->expectGetRow( 'FROM wp_fit_user_goals g', (object) [
			'target_calories' => 2800,
			'goal_type' => 'gain',
			'target_sleep_hours' => 8,
			'target_steps' => 8000,
		] );
		$db->expectGetVar( 'AVG(hours_sleep) FROM wp_fit_sleep_logs', 8.1 );
		$db->expectGetVar( 'AVG(steps) FROM wp_fit_step_logs', 7400 );
		$db->expectGetVar( 'SUM(duration_minutes), 0) FROM wp_fit_cardio_logs', 45 );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_user_health_flags', 0 );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 180.0 );
		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 8', (object) [
			'starting_weight_lb' => 180,
		] );

		$result = CalorieEngine::calculate_weekly_adjustment( 8 );

		$this->assertIsArray( $result );
		$this->assertSame( 'increase', $result['action'] );
		$this->assertSame( 150, $result['delta_calories'] );
		$this->assertSame( 2950, $result['new_target_calories'] );
		$this->assertSame( 180, $result['macro_targets']['protein_g'] );
		$this->assertStringContainsString( 'Weight gain is slower than target', $result['reason'] );
	}
}
