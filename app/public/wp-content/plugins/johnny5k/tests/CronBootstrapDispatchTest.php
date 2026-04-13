<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Bootstrap\CronBootstrap;
use Johnny5k\Tests\Support\ServiceTestCase;

class CronBootstrapDispatchTest extends ServiceTestCase {
	public function test_run_coach_deliveries_processes_follow_ups_and_push_cleanup(): void {
		$db = $this->wpdb();
		$db->expectGetCol( 'SELECT DISTINCT user_id FROM wp_fit_user_profiles WHERE user_id > 0', [] );
		$db->expectGetCol( 'SELECT DISTINCT user_id FROM wp_usermeta WHERE meta_key = \'jf_johnny_follow_ups\'', [] );
		$db->expectGetCol( 'SELECT DISTINCT user_id FROM wp_fit_user_profiles WHERE user_id > 0', [] );
		$db->expectGetCol( 'SELECT DISTINCT user_id FROM wp_usermeta WHERE meta_key = \'jf_johnny_follow_ups\'', [] );

		CronBootstrap::run_coach_deliveries();

		$this->assertFalse( get_transient( 'jf_process_coach_deliveries_lock' ) );
		$this->assertCount( 2, $db->queries );
		$this->assertStringContainsString( 'DELETE FROM wp_fit_push_subscriptions', $db->queries[0] );
		$this->assertStringContainsString( 'UPDATE wp_fit_push_subscriptions', $db->queries[1] );
	}
}
