<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiToolService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiToolServiceTest extends ServiceTestCase {
	public function test_create_custom_workout_tool_accepts_time_tier(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool     = $registry['create_custom_workout'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertSame( 'string', $tool['parameters']['properties']['time_tier']['type'] ?? null );
	}

	public function test_set_training_schedule_tool_accepts_weekly_entries(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool     = $registry['set_training_schedule'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertFalse( $tool['read_only'] ?? true );
		$this->assertSame( 'array', $tool['parameters']['properties']['preferred_workout_days_json']['type'] ?? null );
		$this->assertSame( [ 'preferred_workout_days_json' ], $tool['parameters']['required'] ?? [] );
	}

	public function test_schedule_language_exposes_workout_schedule_tool(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tools    = AiToolService::get_chat_function_tools( $registry, 'general', [], 'Set my weekly schedule to Monday Wednesday Friday.' );
		$names    = array_map( static fn( array $tool ): string => (string) ( $tool['name'] ?? '' ), $tools );

		$this->assertContains( 'set_training_schedule', $names );
	}

	public function test_clear_tools_are_registered_for_johnny(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'clear_follow_ups', $registry );
		$this->assertArrayHasKey( 'clear_sms_reminders', $registry );
		$this->assertSame( 'boolean', $registry['clear_follow_ups']['parameters']['properties']['clear_all']['type'] ?? null );
		$this->assertSame( 'boolean', $registry['clear_sms_reminders']['parameters']['properties']['clear_all']['type'] ?? null );
	}

	public function test_recipe_tools_are_registered_for_recipe_review_and_cookbook_save(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'get_recipe_catalog', $registry );
		$this->assertArrayHasKey( 'get_recipe_cookbook', $registry );
		$this->assertArrayHasKey( 'add_recipe_to_cookbook', $registry );
		$this->assertFalse( $registry['add_recipe_to_cookbook']['read_only'] ?? true );
		$this->assertSame( 'string', $registry['add_recipe_to_cookbook']['parameters']['properties']['recipe_key']['type'] ?? null );
	}
}
