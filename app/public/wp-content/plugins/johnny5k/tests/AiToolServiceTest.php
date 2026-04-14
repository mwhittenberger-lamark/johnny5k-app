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
}
