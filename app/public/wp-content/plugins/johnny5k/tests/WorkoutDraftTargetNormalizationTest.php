<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\WorkoutController;
use Johnny5k\Tests\Support\ServiceTestCase;

class WorkoutDraftTargetNormalizationTest extends ServiceTestCase {
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
