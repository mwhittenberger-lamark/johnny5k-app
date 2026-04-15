<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AwardEngine;
use Johnny5k\Tests\Support\ServiceTestCase;

class AwardEngineTest extends ServiceTestCase {
	public function test_workouts_week_complete_is_earned_when_completed_sessions_match_plan_days(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(DISTINCT session_date) FROM wp_fit_workout_sessions', 3 );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_user_training_days utd', 3 );

		$result = $this->invokePrivateStatic( AwardEngine::class, 'award_is_earned', [ 7, 'workouts_week_complete' ] );

		$this->assertTrue( $result );
	}

	public function test_workouts_week_complete_is_not_earned_when_plan_requirement_is_missed(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(DISTINCT session_date) FROM wp_fit_workout_sessions', 2 );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_user_training_days utd', 3 );

		$result = $this->invokePrivateStatic( AwardEngine::class, 'award_is_earned', [ 7, 'workouts_week_complete' ] );

		$this->assertFalse( $result );
	}

	public function test_first_pr_is_earned_when_snapshot_exists(): void {
		$db = $this->wpdb();
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_exercise_performance_snapshots WHERE user_id = 7', 1 );

		$result = $this->invokePrivateStatic( AwardEngine::class, 'award_is_earned', [ 7, 'first_pr' ] );

		$this->assertTrue( $result );
	}

	public function test_calorie_target_week_is_earned_when_five_days_land_inside_tolerance(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 7', (object) [
			'user_id' => 7,
			'date_of_birth' => '',
			'starting_weight_lb' => 200,
			'height_cm' => 180,
			'sex' => 'male',
			'activity_level' => 'moderate',
			'current_goal' => 'cut',
			'goal_rate' => 'moderate',
		] );
		$db->expectGetRow( 'SELECT * FROM wp_fit_user_goals WHERE user_id = 7 AND active = 1', (object) [
			'id' => 9,
			'user_id' => 7,
			'goal_type' => 'cut',
			'goal_rate' => 'moderate',
			'target_calories' => 2000,
			'target_protein_g' => 200,
			'target_carbs_g' => 138,
			'target_fat_g' => 92,
		] );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 200.0 );
		$db->expectGetVar( 'SELECT target_calories FROM wp_fit_user_goals WHERE user_id = 7', 2000 );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 1980 );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 1825 );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 2010 );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 2190 );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 1950 );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 2500 );
		$db->expectGetVar( 'SELECT SUM(mi.calories) FROM wp_fit_meal_items mi JOIN wp_fit_meals m ON m.id = mi.meal_id WHERE m.user_id = 7', 2000 );

		$result = $this->invokePrivateStatic( AwardEngine::class, 'award_is_earned', [ 7, 'calorie_target_week' ] );

		$this->assertTrue( $result );
	}

	public function test_grant_returns_false_when_award_is_already_held(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT id FROM wp_fit_awards WHERE code = \'first_workout\'', 12 );
		$db->expectGetVar( 'SELECT id FROM wp_fit_user_awards WHERE user_id = 7 AND award_id = 12', 33 );

		$result = AwardEngine::grant( 7, 'first_workout' );

		$this->assertFalse( $result );
		$this->assertCount( 0, $db->inserted );
	}
}
