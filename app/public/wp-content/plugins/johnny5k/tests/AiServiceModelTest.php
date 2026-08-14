<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Services\CostTracker;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceModelTest extends ServiceTestCase {
	public function test_johnny_uses_the_current_flagship_model(): void {
		$reflection = new \ReflectionClass( AiService::class );

		$this->assertSame( 'gpt-5.6-sol', $reflection->getConstant( 'DEFAULT_MODEL' ) );
	}

	public function test_cost_tracker_knows_the_flagship_model_pricing(): void {
		$cost = $this->invokePrivateStatic(
			CostTracker::class,
			'estimate_openai_cost',
			[ 'gpt-5.6-sol', 1000, 1000 ]
		);

		$this->assertSame( 0.035, $cost );
	}
}
