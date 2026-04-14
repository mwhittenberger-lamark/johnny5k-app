<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\AiChatController;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiChatControllerContextSanitizerTest extends ServiceTestCase {
	public function test_sanitize_ai_context_overrides_preserves_nested_live_workout_structure(): void {
		$input = [
			'session_id' => 42,
			'active_exercise' => 'Bench <b>Press</b>',
			'current_set_values' => [
				'weight' => 185.5,
				'reps' => 8,
				'rir' => null,
			],
			'active_recent_history' => [
				[
					'snapshot_date' => '2026-04-10',
					'best_weight' => 185,
					'best_reps' => 8,
				],
				[
					'snapshot_date' => '2026-04-03',
					'best_weight' => 180,
					'best_reps' => 9,
				],
			],
			'event_exercise_context' => [
				'exercise_name' => 'Bench <script>alert(1)</script>Press',
				'equipment' => 'barbell',
			],
			'session_overview' => [
				[
					'position' => 1,
					'name' => 'Bench Press',
					'planned_sets' => 3,
					'completed_sets' => 1,
				],
				[
					'position' => 2,
					'name' => 'Row',
					'planned_sets' => 3,
					'completed_sets' => 0,
				],
			],
		];

		$result = $this->invokePrivateStatic( AiChatController::class, 'sanitize_ai_context_overrides', [ $input ] );

		$this->assertSame( 42, $result['session_id'] );
		$this->assertSame( 'Bench Press', $result['active_exercise'] );
		$this->assertSame(
			[
				'weight' => 185.5,
				'reps' => 8,
			],
			$result['current_set_values']
		);
		$this->assertSame(
			[
				[
					'snapshot_date' => '2026-04-10',
					'best_weight' => 185,
					'best_reps' => 8,
				],
				[
					'snapshot_date' => '2026-04-03',
					'best_weight' => 180,
					'best_reps' => 9,
				],
			],
			$result['active_recent_history']
		);
		$this->assertSame(
			[
				'exercise_name' => 'Bench alert(1)Press',
				'equipment' => 'barbell',
			],
			$result['event_exercise_context']
		);
		$this->assertCount( 2, $result['session_overview'] );
		$this->assertSame( 'Bench Press', $result['session_overview'][0]['name'] );
		$this->assertSame( 3, $result['session_overview'][0]['planned_sets'] );
	}

	public function test_sanitize_ai_chat_options_allows_lightweight_history_modes(): void {
		$input = [
			'thread_history' => 'short',
			'history_limit' => 99,
			'include_thread_summary' => 'false',
			'refresh_thread_summary' => 0,
			'ignored' => 'value',
		];

		$result = $this->invokePrivateStatic( AiChatController::class, 'sanitize_ai_chat_options', [ $input ] );

		$this->assertSame(
			[
				'thread_history' => 'short',
				'history_limit' => 18,
				'include_thread_summary' => false,
				'refresh_thread_summary' => false,
			],
			$result
		);
	}
}
