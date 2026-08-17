<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AnnouncementTickerService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AnnouncementTickerServiceTest extends ServiceTestCase {
	public function test_provides_an_active_default_message_until_the_admin_saves_the_wire(): void {
		$active = AnnouncementTickerService::get_active();

		$this->assertCount( 1, $active );
		$this->assertSame( 'johnny_welcome', $active[0]['id'] );
		$this->assertSame( 'Johnny says', $active[0]['label'] );
		$this->assertSame( 'Small choices stack up. Pick the next one you’ll be proud of.', $active[0]['message'] );
	}

	public function test_sanitizes_orders_and_limits_admin_messages(): void {
		$messages = AnnouncementTickerService::sanitize_messages( [
			[ 'id' => 'Second!', 'label' => 'Update', 'message' => '<b>Second message</b>', 'url' => 'javascript:alert(1)', 'active' => 1, 'priority' => 20 ],
			[ 'id' => 'First', 'label' => 'Johnny', 'message' => 'First message', 'url' => '/nutrition', 'active' => 1, 'priority' => 90 ],
		] );

		$this->assertSame( 'first', $messages[0]['id'] );
		$this->assertSame( '/nutrition', $messages[0]['url'] );
		$this->assertSame( 'Second message', $messages[1]['message'] );
		$this->assertSame( '', $messages[1]['url'] );
	}

	public function test_returns_only_active_messages(): void {
		$this->setOption( AnnouncementTickerService::OPTION_KEY, [
			[ 'id' => 'live', 'label' => 'Coach note', 'message' => 'Keep moving.', 'url' => '', 'active' => true, 'starts_at' => '', 'ends_at' => '', 'priority' => 70 ],
			[ 'id' => 'off', 'label' => 'Hidden', 'message' => 'Do not show.', 'url' => '', 'active' => false, 'starts_at' => '', 'ends_at' => '', 'priority' => 100 ],
		] );

		$active = AnnouncementTickerService::get_active();
		$this->assertCount( 1, $active );
		$this->assertSame( 'live', $active[0]['id'] );
	}
}
