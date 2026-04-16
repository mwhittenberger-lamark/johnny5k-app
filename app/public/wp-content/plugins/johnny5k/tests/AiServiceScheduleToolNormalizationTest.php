<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceScheduleToolNormalizationTest extends ServiceTestCase {
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
