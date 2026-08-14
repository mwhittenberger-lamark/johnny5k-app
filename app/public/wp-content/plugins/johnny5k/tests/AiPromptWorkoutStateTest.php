<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiPromptService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiPromptWorkoutStateTest extends ServiceTestCase {
	public function test_workout_mutation_contract_distinguishes_active_sessions_from_drafts(): void {
		$prompt = AiPromptService::build_system_prompt( [], '', '', 'general' );

		$this->assertStringContainsString( 'If has_active_session is true, that session is the active workout', $prompt );
		$this->assertStringContainsString( 'For an exercise replacement in the active session, call swap_workout_exercise.', $prompt );
		$this->assertStringContainsString( 'Use modify_workout only when there is no active session and has_queued_workout is true', $prompt );
		$this->assertStringContainsString( 'Never tell the user to approve or activate a workout that get_current_workout reports as active.', $prompt );
	}

	public function test_workout_library_questions_require_a_live_library_read(): void {
		$prompt = AiPromptService::build_system_prompt( [], '', '', 'general' );

		$this->assertStringContainsString( 'call get_saved_workouts and answer from its live result', $prompt );
		$this->assertStringContainsString( 'Do not infer the library from conversation memory.', $prompt );
	}

	public function test_explicit_workout_save_requests_use_the_library_tool(): void {
		$prompt = AiPromptService::build_system_prompt( [], '', '', 'general' );

		$this->assertStringContainsString( 'queued or active workout in My Workouts, call save_workout_to_library', $prompt );
		$this->assertStringContainsString( 'Never claim it was saved unless that tool succeeds.', $prompt );
	}
}
