<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceScheduleToolNormalizationTest extends ServiceTestCase {
	public function test_custom_workout_tool_detects_circuit_rounds_from_message(): void {
		$result = $this->invokePrivateStatic(
			AiService::class,
			'normalise_tool_arguments_from_user_message',
			[
				7,
				'create_custom_workout',
				[
					'name' => 'Upper Body Circuit',
					'exercise_names' => [ 'Push-up', 'Bent-over row' ],
				],
				'Build a circuit with push-ups and rows. Repeat 3 times.',
			]
		);

		$this->assertSame( 'circuit', $result['workout_structure'] ?? null );
		$this->assertSame( 3, $result['rounds'] ?? null );
	}

	public function test_custom_workout_tool_parses_named_mixed_circuit_prescriptions(): void {
		$prompt = 'This is a custom workout called Monday Circuit. It is 10 pushups followed by 20 incline dumbbell press. Next station is a superset of 10 bent over row and then 20 single arm rows for each arm. Next station is a minute of squats, final station is a 1 minute plank. Do 3 rounds of the circuit';
		$result = $this->invokePrivateStatic(
			AiService::class,
			'normalise_tool_arguments_from_user_message',
			[ 7, 'create_custom_workout', [], $prompt ]
		);

		$this->assertSame( 'Monday Circuit', $result['name'] ?? null );
		$this->assertSame( 'circuit', $result['workout_structure'] ?? null );
		$this->assertSame( 3, $result['rounds'] ?? null );
		$this->assertSame(
			[
				[ 'exercise_name' => 'Push-up', 'target_type' => 'reps', 'target_reps' => 10, 'reps_per_side' => false ],
				[ 'exercise_name' => 'Incline Dumbbell Press', 'target_type' => 'reps', 'target_reps' => 20, 'reps_per_side' => false ],
				[ 'exercise_name' => 'Bent-over Row', 'target_type' => 'reps', 'target_reps' => 10, 'reps_per_side' => false ],
				[ 'exercise_name' => 'Single-arm Dumbbell Row', 'target_type' => 'reps', 'target_reps' => 20, 'reps_per_side' => true ],
				[ 'exercise_name' => 'Bodyweight Squat', 'target_type' => 'duration', 'target_duration_seconds' => 60 ],
				[ 'exercise_name' => 'Plank', 'target_type' => 'duration', 'target_duration_seconds' => 60 ],
			],
			$result['exercises'] ?? []
		);
	}

	public function test_personal_exercise_normalization_does_not_reference_workout_message_state(): void {
		$result = $this->invokePrivateStatic(
			AiService::class,
			'normalise_tool_arguments_from_user_message',
			[ 7, 'create_personal_exercise', [ 'name' => 'Cable press' ], 'Save Cable press to my exercise library.' ]
		);

		$this->assertSame( 'Cable press', $result['name'] ?? null );
		$this->assertArrayNotHasKey( 'workout_structure', $result );
	}

	public function test_schedule_tool_defaults_plain_weekday_lists_to_default_cycle(): void {
		$result = $this->invokePrivateStatic(
			AiService::class,
			'normalise_tool_arguments_from_user_message',
			[
				7,
				'set_training_schedule',
				[
					'preferred_workout_days_json' => [
						[ 'day' => 'Mon', 'day_type' => '' ],
						[ 'day' => 'Wed', 'day_type' => '' ],
						[ 'day' => 'Fri', 'day_type' => '' ],
					],
				],
				'Set my weekly schedule to Monday, Wednesday, Friday.',
			]
		);

		$this->assertSame(
			[
				[ 'day' => 'Mon', 'day_type' => 'push' ],
				[ 'day' => 'Wed', 'day_type' => 'pull' ],
				[ 'day' => 'Fri', 'day_type' => 'legs' ],
			],
			$result['preferred_workout_days_json'] ?? []
		);
	}

	public function test_schedule_tool_preserves_explicit_day_types_from_message(): void {
		$result = $this->invokePrivateStatic(
			AiService::class,
			'normalise_tool_arguments_from_user_message',
			[
				7,
				'set_training_schedule',
				[
					'preferred_workout_days_json' => [
						[ 'day' => 'Mon', 'day_type' => '' ],
						[ 'day' => 'Wed', 'day_type' => '' ],
						[ 'day' => 'Fri', 'day_type' => '' ],
					],
				],
				'Set my weekly schedule to Monday push, Wednesday pull, Friday legs.',
			]
		);

		$this->assertSame(
			[
				[ 'day' => 'Mon', 'day_type' => 'push' ],
				[ 'day' => 'Wed', 'day_type' => 'pull' ],
				[ 'day' => 'Fri', 'day_type' => 'legs' ],
			],
			$result['preferred_workout_days_json'] ?? []
		);
	}
}
