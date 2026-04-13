<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Auth\PasswordResetEmailCustomizer;
use Johnny5k\Tests\Support\ServiceTestCase;

class PasswordResetEmailCustomizerTest extends ServiceTestCase {
	public function test_register_adds_password_reset_filter(): void {
		PasswordResetEmailCustomizer::register();

		$this->assertCount( 1, $GLOBALS['johnny5k_test_hooks']['filters']['retrieve_password_notification_email'] ?? [] );
		$this->assertSame(
			[ PasswordResetEmailCustomizer::class, 'filter_notification_email' ],
			$GLOBALS['johnny5k_test_hooks']['filters']['retrieve_password_notification_email'][0]['callback'] ?? null
		);
	}

	public function test_filter_notification_email_customizes_subject_and_reset_url(): void {
		$this->setOption( 'blogname', 'Johnny HQ' );
		PasswordResetEmailCustomizer::register();

		$user = new \WP_User( 7, 'mike@example.com', 'mike' );
		$email = apply_filters(
			'retrieve_password_notification_email',
			[
				'subject' => 'Default subject',
				'message' => 'Default message',
			],
			'ab c+123',
			'mike@example.com',
			$user
		);

		$this->assertSame( '[Johnny HQ] Reset your Johnny5k password', $email['subject'] );
		$this->assertStringContainsString( 'https://example.test/reset-password?key=ab%20c%2B123&login=mike%40example.com', $email['message'] );
		$this->assertStringContainsString( 'If you did not request this, you can ignore this email.', $email['message'] );
	}
}
