<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceChatHistorySettingsTest extends ServiceTestCase {
	public function test_resolve_chat_history_settings_defaults_to_full_thread_context(): void {
		$result = $this->invokePrivateStatic( AiService::class, 'resolve_chat_history_settings', [ [] ] );

		$this->assertSame(
			[
				'history_limit' => 18,
				'include_thread_summary' => true,
				'refresh_thread_summary' => true,
			],
			$result
		);
	}

	public function test_resolve_chat_history_settings_uses_lightweight_defaults_for_short_mode(): void {
		$result = $this->invokePrivateStatic(
			AiService::class,
			'resolve_chat_history_settings',
			[
				[
					'thread_history' => 'short',
				],
			]
		);

		$this->assertSame(
			[
				'history_limit' => 2,
				'include_thread_summary' => false,
				'refresh_thread_summary' => false,
			],
			$result
		);
	}

	public function test_resolve_chat_history_settings_allows_explicit_overrides(): void {
		$result = $this->invokePrivateStatic(
			AiService::class,
			'resolve_chat_history_settings',
			[
				[
					'thread_history' => 'short',
					'history_limit' => 4,
					'include_thread_summary' => true,
					'refresh_thread_summary' => true,
				],
			]
		);

		$this->assertSame(
			[
				'history_limit' => 4,
				'include_thread_summary' => true,
				'refresh_thread_summary' => true,
			],
			$result
		);
	}
}
