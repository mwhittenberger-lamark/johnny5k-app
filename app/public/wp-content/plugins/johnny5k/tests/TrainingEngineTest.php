<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\TrainingEngine;
use Johnny5k\Tests\Support\ServiceTestCase;

class TrainingEngineTest extends ServiceTestCase {
	public function test_preview_session_builds_a_push_day_blueprint(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'FROM wp_fit_user_training_plans', (object) [ 'id' => 11 ] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_workout_sessions', 0 );
		$db->expectGetRow( 'FROM wp_fit_user_training_days', (object) [ 'id' => 21 ] );
		$db->expectGetResults( 'FROM wp_fit_user_training_day_exercises ude', [
			(object) [
				'id' => 1001,
				'exercise_id' => 501,
				'exercise_name' => 'Bench Press',
				'primary_muscle' => 'chest',
				'equipment' => 'barbell',
				'difficulty' => 'intermediate',
				'slot_type' => 'main',
				'sets_target' => 3,
				'rep_min' => 5,
				'rep_max' => 8,
			],
			(object) [
				'id' => 1002,
				'exercise_id' => 502,
				'exercise_name' => 'Cable Fly',
				'primary_muscle' => 'chest',
				'equipment' => 'cable',
				'difficulty' => 'beginner',
				'slot_type' => 'accessory',
				'sets_target' => 3,
				'rep_min' => 10,
				'rep_max' => 15,
			],
		] );
		$db->expectGetVar( 'exercise_avoid_json FROM wp_fit_user_preferences', null );
		$db->expectGetVar( 'equipment_available_json FROM wp_fit_user_preferences', null );
		$db->expectGetRow( 'FROM wp_fit_exercises WHERE id = 501', (object) [
			'id' => 501,
			'name' => 'Bench Press',
			'primary_muscle' => 'chest',
			'equipment' => 'barbell',
			'difficulty' => 'intermediate',
		] );
		$db->expectGetRow( 'FROM wp_fit_exercises WHERE id = 502', (object) [
			'id' => 502,
			'name' => 'Cable Fly',
			'primary_muscle' => 'chest',
			'equipment' => 'cable',
			'difficulty' => 'beginner',
		] );
		$db->expectGetVar( 'SELECT equipment FROM wp_fit_exercises WHERE id = 501', 'barbell' );
		$db->expectGetVar( 'SELECT equipment FROM wp_fit_exercises WHERE id = 502', 'cable' );
		$db->expectGetResults( 'FROM wp_fit_workout_sets ws', [] );
		$db->expectGetResults( 'FROM wp_fit_workout_sets ws', [] );

		$result = TrainingEngine::preview_session( 7, 'short', false, 'push' );

		$this->assertSame( 'push', $result['day_type'] );
		$this->assertSame( 2, $result['plan_exercise_count'] );
		$this->assertCount( 2, $result['exercises'] );
		$this->assertSame( 501, $result['exercises'][0]['exercise_id'] );
		$this->assertSame( 'Start light — first time performing this exercise.', $result['exercises'][0]['suggestion_note'] );
		$this->assertSame( 502, $result['exercises'][1]['exercise_id'] );
	}

	public function test_preview_session_can_apply_light_push_day_variation(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'FROM wp_fit_user_training_plans', (object) [ 'id' => 11 ] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'COUNT(*) FROM wp_fit_workout_sessions', 0 );
		$db->expectGetRow( 'FROM wp_fit_user_training_days', (object) [ 'id' => 21 ] );
		$db->expectGetResults( 'FROM wp_fit_user_training_day_exercises ude', [
			(object) [
				'id' => 1001,
				'exercise_id' => 501,
				'exercise_name' => 'Bench Press',
				'primary_muscle' => 'chest',
				'equipment' => 'barbell',
				'difficulty' => 'intermediate',
				'slot_type' => 'main',
				'sets_target' => 3,
				'rep_min' => 5,
				'rep_max' => 8,
			],
			(object) [
				'id' => 1002,
				'exercise_id' => 502,
				'exercise_name' => 'Cable Fly',
				'primary_muscle' => 'chest',
				'equipment' => 'cable',
				'difficulty' => 'beginner',
				'slot_type' => 'accessory',
				'sets_target' => 3,
				'rep_min' => 10,
				'rep_max' => 15,
			],
		] );
		$db->expectGetVar( 'exercise_avoid_json FROM wp_fit_user_preferences', null );
		$db->expectGetVar( 'equipment_available_json FROM wp_fit_user_preferences', null );
		$db->expectGetRow( 'FROM wp_fit_workout_sessions', [ 'id' => 4 ] );
		$db->expectGetResults( 'FROM wp_fit_workout_session_exercises', [
			[ 'sort_order' => 1, 'exercise_id' => 501, 'original_exercise_id' => 0, 'slot_type' => 'main' ],
			[ 'sort_order' => 2, 'exercise_id' => 502, 'original_exercise_id' => 0, 'slot_type' => 'accessory' ],
		] );
		$db->expectGetVar( 'SELECT e.id', 503 );
		$db->expectGetRow( 'FROM wp_fit_exercises WHERE id = 501', (object) [
			'id' => 501,
			'name' => 'Bench Press',
			'primary_muscle' => 'chest',
			'equipment' => 'barbell',
			'difficulty' => 'intermediate',
		] );
		$db->expectGetVar( 'SELECT equipment FROM wp_fit_exercises WHERE id = 501', 'barbell' );
		$db->expectGetResults( 'FROM wp_fit_workout_sets ws', [] );
		$db->expectGetRow( 'FROM wp_fit_exercises WHERE id = 502', (object) [
			'id' => 502,
			'name' => 'Cable Fly',
			'primary_muscle' => 'chest',
			'equipment' => 'cable',
			'difficulty' => 'beginner',
		] );
		$db->expectGetRow( 'FROM wp_fit_exercises WHERE id = 503', (object) [
			'id' => 503,
			'name' => 'Machine Chest Fly',
			'primary_muscle' => 'chest',
			'equipment' => 'machine',
			'difficulty' => 'beginner',
		] );
		$db->expectGetVar( 'SELECT equipment FROM wp_fit_exercises WHERE id = 503', 'machine' );
		$db->expectGetResults( 'FROM wp_fit_workout_sets ws', [] );

		$result = TrainingEngine::preview_session( 7, 'short', false, 'push' );

		$this->assertSame( 'push', $result['day_type'] );
		$this->assertCount( 2, $result['exercises'] );
		$this->assertSame( 501, $result['exercises'][0]['exercise_id'] );
		$this->assertSame( 503, $result['exercises'][1]['exercise_id'] );
		$this->assertTrue( $result['exercises'][1]['was_swapped'] );
		$this->assertSame( 'Cable Fly', $result['exercises'][1]['original_exercise_name'] );
	}

	public function test_record_snapshots_marks_a_new_pr_and_grants_the_first_pr_award(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'FROM wp_fit_workout_sessions WHERE id = 55', (object) [
			'id' => 55,
			'user_id' => 7,
		] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetResults( 'FROM wp_fit_workout_session_exercises wse', [
			(object) [
				'ses_ex_id' => 101,
				'exercise_id' => 201,
			],
		] );
		$db->expectGetResults( 'FROM wp_fit_workout_sets', [
			(object) [ 'weight' => 200, 'reps' => 5 ],
			(object) [ 'weight' => 150, 'reps' => 5 ],
		] );
		$db->expectGetVar( 'MAX(estimated_1rm) FROM wp_fit_exercise_performance_snapshots', 220.0 );
		$db->expectGetVar( 'SELECT id FROM wp_fit_awards WHERE code = \'first_pr\'', 9 );
		$db->expectGetVar( 'SELECT id FROM wp_fit_user_awards WHERE user_id = 7 AND award_id = 9', 0 );

		$result = TrainingEngine::record_snapshots( 55 );

		$this->assertCount( 1, $result );
		$this->assertSame( 201, $result[0]['exercise_id'] );
		$this->assertTrue( $result[0]['is_pr'] );
		$this->assertSame( 233.33, $result[0]['new_1rm'] );

		$this->assertCount( 1, $db->replaced );
		$this->assertSame( 'wp_fit_exercise_performance_snapshots', $db->replaced[0]['table'] );
		$this->assertSame( 233.33, $db->replaced[0]['data']['estimated_1rm'] );

		$this->assertCount( 1, $db->inserted );
		$this->assertSame( 'wp_fit_user_awards', $db->inserted[0]['table'] );
		$this->assertSame( 7, $db->inserted[0]['data']['user_id'] );
		$this->assertSame( 9, $db->inserted[0]['data']['award_id'] );
	}

	public function test_recommended_progression_adds_weight_when_recent_sets_are_near_failure(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT equipment FROM wp_fit_exercises WHERE id = 501', 'barbell' );
		$db->expectGetResults( 'FROM wp_fit_workout_sets ws', [
			(object) [ 'weight' => 100, 'reps' => 6, 'rir' => 1.0 ],
			(object) [ 'weight' => 100, 'reps' => 5, 'rir' => 0.5 ],
		] );

		$result = TrainingEngine::recommended_progression( 7, 501 );

		$this->assertSame( 105.0, $result['weight'] );
		$this->assertSame( 'Last session was near-failure — time to add weight.', $result['note'] );
	}

	public function test_recommended_progression_holds_weight_when_recent_rir_is_comfortable(): void {
		$db = $this->wpdb();

		$db->expectGetVar( 'SELECT equipment FROM wp_fit_exercises WHERE id = 502', 'barbell' );
		$db->expectGetResults( 'FROM wp_fit_workout_sets ws', [
			(object) [ 'weight' => 95, 'reps' => 8, 'rir' => 2.0 ],
			(object) [ 'weight' => 95, 'reps' => 7, 'rir' => 2.5 ],
		] );

		$result = TrainingEngine::recommended_progression( 7, 502 );

		$this->assertSame( 95.0, $result['weight'] );
		$this->assertSame( 'Match your last session weight and aim for the top of your rep range.', $result['note'] );
	}

	public function test_record_snapshots_does_not_grant_pr_award_when_estimated_1rm_does_not_improve(): void {
		$db = $this->wpdb();

		$db->expectGetRow( 'FROM wp_fit_workout_sessions WHERE id = 56', (object) [
			'id' => 56,
			'user_id' => 7,
		] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetResults( 'FROM wp_fit_workout_session_exercises wse', [
			(object) [
				'ses_ex_id' => 102,
				'exercise_id' => 202,
			],
		] );
		$db->expectGetResults( 'FROM wp_fit_workout_sets', [
			(object) [ 'weight' => 180, 'reps' => 5 ],
		] );
		$db->expectGetVar( 'MAX(estimated_1rm) FROM wp_fit_exercise_performance_snapshots', 220.0 );

		$result = TrainingEngine::record_snapshots( 56 );

		$this->assertCount( 1, $result );
		$this->assertFalse( $result[0]['is_pr'] );
		$this->assertSame( 210.0, $result[0]['new_1rm'] );
		$this->assertCount( 1, $db->replaced );
		$this->assertCount( 0, $db->inserted );
	}
}
