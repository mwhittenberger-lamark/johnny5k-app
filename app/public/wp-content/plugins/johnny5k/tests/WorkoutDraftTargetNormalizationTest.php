<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\WorkoutController;
use Johnny5k\Tests\Support\ServiceTestCase;

class WorkoutDraftTargetNormalizationTest extends ServiceTestCase {
	public function test_saved_workout_signature_detects_the_same_plan_despite_display_metadata(): void {
		$workout = [
			'name' => 'Push Day',
			'day_type' => 'push',
			'time_tier' => 'medium',
			'workout_structure' => 'standard',
			'rounds' => 1,
			'exercises' => [
				[ 'exercise_id' => 7, 'slot_type' => 'compound', 'rep_min' => 8, 'rep_max' => 10, 'sets' => 3, 'target_type' => 'reps' ],
			],
		];
		$renamed_copy = array_merge( $workout, [ 'id' => 'another-id', 'name' => 'My Favorite Push Day', 'created_at' => 'tomorrow' ] );

		$signature = $this->invokePrivateStatic( WorkoutController::class, 'saved_workout_signature', [ $workout ] );
		$copy_signature = $this->invokePrivateStatic( WorkoutController::class, 'saved_workout_signature', [ $renamed_copy ] );

		$this->assertSame( $signature, $copy_signature );
	}

	public function test_saved_workout_signature_changes_when_the_prescription_changes(): void {
		$workout = [
			'day_type' => 'push',
			'time_tier' => 'medium',
			'workout_structure' => 'standard',
			'rounds' => 1,
			'exercises' => [
				[ 'exercise_id' => 7, 'slot_type' => 'compound', 'rep_min' => 8, 'rep_max' => 10, 'sets' => 3, 'target_type' => 'reps' ],
			],
		];
		$harder_version = $workout;
		$harder_version['exercises'][0]['sets'] = 4;

		$signature = $this->invokePrivateStatic( WorkoutController::class, 'saved_workout_signature', [ $workout ] );
		$harder_signature = $this->invokePrivateStatic( WorkoutController::class, 'saved_workout_signature', [ $harder_version ] );

		$this->assertNotSame( $signature, $harder_signature );
	}

	public function test_reading_a_saved_mixed_circuit_discards_duration_from_rep_targets(): void {
		$GLOBALS['johnny5k_test_user_meta'][42]['jf_custom_workout_draft'] = [
			'id' => 'mixed-circuit',
			'name' => 'Mixed Circuit',
			'workout_structure' => 'circuit',
			'rounds' => 3,
			'exercises' => [
				[ 'plan_exercise_id' => 1, 'exercise_id' => 1, 'exercise_name' => 'Pushups', 'target_type' => 'reps', 'rep_min' => 10, 'rep_max' => 10, 'sets' => 3, 'duration_seconds' => 60 ],
				[ 'plan_exercise_id' => 2, 'exercise_id' => 2, 'exercise_name' => 'Plank', 'target_type' => 'duration', 'rep_min' => 8, 'rep_max' => 12, 'sets' => 3, 'duration_seconds' => 60 ],
			],
		];

		$draft = $this->invokePrivateStatic( WorkoutController::class, 'get_custom_workout_draft', [ 42 ] );

		$this->assertSame( 'reps', $draft['exercises'][0]['target_type'] ?? '' );
		$this->assertNull( $draft['exercises'][0]['duration_seconds'] ?? null );
		$this->assertSame( 10, $draft['exercises'][0]['rep_min'] ?? 0 );
		$this->assertSame( 'duration', $draft['exercises'][1]['target_type'] ?? '' );
		$this->assertSame( 60, $draft['exercises'][1]['duration_seconds'] ?? 0 );
	}
}
