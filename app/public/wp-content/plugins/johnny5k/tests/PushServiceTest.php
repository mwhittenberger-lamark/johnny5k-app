<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\PushService;
use Johnny5k\Tests\Support\ServiceTestCase;

class PushServiceTest extends ServiceTestCase {
	public function test_upsert_subscription_rejects_cross_user_endpoint_rebinding(): void {
		$db = $this->wpdb();
		$db->expectGetVar( "SELECT user_id FROM wp_fit_push_subscriptions WHERE endpoint_hash = '", 99 );

		$result = PushService::upsert_subscription( 7, [
			'endpoint' => 'https://push.example.test/subscriptions/abc',
			'contentEncoding' => 'aes128gcm',
			'keys' => [
				'p256dh' => 'key-123',
				'auth' => 'auth-123',
			],
		] );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'push_subscription_conflict', $result->get_error_code() );
		$this->assertSame( [], $db->inserted );
		$this->assertSame( [], $db->updated );
	}

	public function test_upsert_subscription_updates_existing_record_for_same_user_only(): void {
		$db = $this->wpdb();
		$db->expectGetVar( "SELECT user_id FROM wp_fit_push_subscriptions WHERE endpoint_hash = '", 0 );
		$db->expectGetVar( "SELECT id FROM wp_fit_push_subscriptions WHERE user_id = 7 AND endpoint_hash = '", 15 );
		$db->expectGetRow( "FROM wp_fit_push_subscriptions\n\t\t\t WHERE user_id = 7 AND endpoint_hash = '", [
			'id' => 15,
			'endpoint_hash' => 'hash',
			'endpoint' => 'https://push.example.test/subscriptions/abc',
			'content_encoding' => 'aes128gcm',
			'user_agent' => '',
			'created_at' => '2026-04-09 12:00:00',
			'updated_at' => '2026-04-09 12:00:00',
			'last_seen_at' => '2026-04-09 12:00:00',
			'disabled_at' => '',
		] );

		$result = PushService::upsert_subscription( 7, [
			'endpoint' => 'https://push.example.test/subscriptions/abc',
			'contentEncoding' => 'aes128gcm',
			'keys' => [
				'p256dh' => 'key-123',
				'auth' => 'auth-123',
			],
		] );

		$this->assertSame( 15, $result['id'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 15, $db->updated[0]['where']['id'] );
		$this->assertSame( 7, $db->updated[0]['data']['user_id'] );
	}
}
