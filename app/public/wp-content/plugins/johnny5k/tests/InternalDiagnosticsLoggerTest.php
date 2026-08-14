<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\InternalDiagnosticsLogger;
use Johnny5k\Tests\Support\ServiceTestCase;

class InternalDiagnosticsLoggerTest extends ServiceTestCase {
	public function test_johnny_chat_result_is_available_in_private_diagnostics(): void {
		$user_id = 51;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'coach-test@example.test', 'coach-test', [ 'manage_options' => true ] );

		InternalDiagnosticsLogger::record_johnny_chat_result(
			$user_id,
			'u51_main',
			'Generate a sunflower image.',
			[
				'reply' => 'I could not generate that image.',
				'used_tools' => [ 'generate_image' ],
				'action_results' => [],
				'tool_errors' => [[
					'tool_name' => 'generate_image',
					'error' => 'Image quota reached.',
				]],
				'model' => 'gpt-4o-mini',
			]
		);

		$entries = InternalDiagnosticsLogger::list_entries( 1 );
		$this->assertCount( 1, $entries );
		$this->assertSame( 'johnny_chat', $entries[0]['source'] ?? '' );
		$this->assertSame( 'Generate a sunflower image.', $entries[0]['message'] ?? '' );
		$this->assertSame( 'Image quota reached.', $entries[0]['error_message'] ?? '' );
		$this->assertSame( 500, $entries[0]['status_code'] ?? 0 );
		$this->assertStringContainsString( 'generate_image', (string) ( $entries[0]['context']['used_tools'] ?? '' ) );
	}
}
