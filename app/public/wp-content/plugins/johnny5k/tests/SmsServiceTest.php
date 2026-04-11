<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\SmsService;
use Johnny5k\Tests\Support\ServiceTestCase;

class SmsServiceTest extends ServiceTestCase {
	public function test_schedule_user_reminder_persists_signed_reminder(): void {
		$this->wpdb()->expectGetRow(
			'fit_user_profiles WHERE user_id = 55',
			(object) [
				'user_id' => 55,
				'phone' => '+1 (555) 111-2222',
			]
		);
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );
		$this->setOption( 'jf_clicksend_username', 'demo-user' );
		$this->setOption( 'jf_clicksend_api_key', 'demo-key' );
		$this->setOption( 'jf_clicksend_sender_id', 'Johnny5k' );
		$this->queueHttpPostResponse([
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode([
				'data' => [
					'messages' => [
						[
							'status' => 'QUEUED',
							'message_id' => 'cs_123',
							'message_price' => '0',
						],
					],
				],
			]),
		]);

		$result = SmsService::schedule_user_reminder( 55, '2099-04-07 18:30', 'Remember your workout' );

		self::assertIsArray( $result );
		self::assertSame( '00000000-0000-4000-8000-000000000000', $result['id'] );
		self::assertSame( 'Remember your workout - Johnny5k', $result['message'] );
		self::assertSame( '2099-04-07 18:30:00', $result['send_at_local'] );
		self::assertSame( 'America/New_York', $result['timezone'] );
		self::assertSame( 'scheduled', $result['status'] );
		self::assertSame( 'cs_123', $result['clicksend_message_id'] );

		$stored = \get_user_meta( 55, 'jf_scheduled_sms_reminders', true );
		self::assertCount( 1, $stored );
		self::assertSame( 'Remember your workout - Johnny5k', $stored[0]['message'] );
		self::assertSame( 'scheduled', $stored[0]['status'] );
	}

	public function test_cancel_user_reminder_updates_status_and_returns_formatted_payload(): void {
		$this->setOption( 'jf_clicksend_username', 'demo-user' );
		$this->setOption( 'jf_clicksend_api_key', 'demo-key' );
		$this->queueHttpRequestResponse([
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode([ 'response_msg' => 'OK' ]),
		]);

		\update_user_meta( 55, 'jf_scheduled_sms_reminders', [
			[
				'id' => 'rem-1',
				'message' => 'Stay on it - Johnny5k',
				'send_at_local' => '2099-04-07 18:30:00',
				'send_at_utc' => '2099-04-07 22:30:00',
				'timezone' => 'America/New_York',
				'status' => 'scheduled',
				'created_at' => '2026-04-09 12:00:00',
				'sent_at' => '',
				'canceled_at' => '',
				'clicksend_message_id' => 'cs_123',
			],
		] );

		$result = SmsService::cancel_user_reminder( 55, 'rem-1' );

		self::assertIsArray( $result );
		self::assertSame( 'rem-1', $result['id'] );
		self::assertSame( 'canceled', $result['status'] );
		self::assertSame( '2026-04-09 12:00:00', $result['canceled_at'] );
		self::assertArrayNotHasKey( 'clicksend_message_id', $result );

		$stored = \get_user_meta( 55, 'jf_scheduled_sms_reminders', true );
		self::assertSame( 'canceled', $stored[0]['status'] );
		self::assertSame( '2026-04-09 12:00:00', $stored[0]['canceled_at'] );
	}

	public function test_list_user_reminders_reconciles_overdue_items_into_history(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM', 'America/New_York' );

		\update_user_meta( 55, 'jf_scheduled_sms_reminders', [
			[
				'id' => 'future-reminder',
				'message' => 'Future reminder - Johnny5k',
				'send_at_local' => '2099-04-07 18:30:00',
				'send_at_utc' => '2099-04-07 22:30:00',
				'timezone' => 'America/New_York',
				'status' => 'scheduled',
				'created_at' => '2026-04-09 12:00:00',
				'sent_at' => '',
				'canceled_at' => '',
				'clicksend_message_id' => 'cs_future',
			],
			[
				'id' => 'past-reminder',
				'message' => 'Past reminder - Johnny5k',
				'send_at_local' => '2000-01-01 08:00:00',
				'send_at_utc' => '2000-01-01 13:00:00',
				'timezone' => 'America/New_York',
				'status' => 'scheduled',
				'created_at' => '2026-04-09 12:00:00',
				'sent_at' => '',
				'canceled_at' => '',
				'clicksend_message_id' => 'cs_past',
			],
			[
				'id' => 'sent-reminder',
				'message' => 'Sent reminder - Johnny5k',
				'send_at_local' => '2098-12-01 07:00:00',
				'send_at_utc' => '2098-12-01 12:00:00',
				'timezone' => 'America/New_York',
				'status' => 'sent',
				'created_at' => '2026-04-09 12:00:00',
				'sent_at' => '2098-12-01 12:00:00',
				'canceled_at' => '',
				'clicksend_message_id' => 'cs_sent',
			],
		] );

		$result = SmsService::list_user_reminders( 55 );

		self::assertSame( 'America/New_York', $result['timezone'] );
		self::assertSame( 1, $result['scheduled_count'] );
		self::assertSame( 2, $result['history_count'] );
		self::assertSame( 'future-reminder', $result['scheduled'][0]['id'] );
		self::assertSame( 'sent-reminder', $result['history'][0]['id'] );
		self::assertSame( 'queued', $result['history'][1]['status'] );

		$stored = \get_user_meta( 55, 'jf_scheduled_sms_reminders', true );
		self::assertSame( 'queued', $stored[1]['status'] );
	}
}