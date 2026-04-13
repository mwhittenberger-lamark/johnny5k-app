<?php

declare(strict_types=1);

namespace Johnny5k\Tests\Support;

use PHPUnit\Framework\TestCase;
use ReflectionMethod;

abstract class ServiceTestCase extends TestCase {
	protected FakeWpdb $wpdb;

	protected function setUp(): void {
		parent::setUp();

		$this->wpdb = new FakeWpdb();
		$GLOBALS['wpdb'] = $this->wpdb;
		$GLOBALS['johnny5k_test_user_meta'] = [];
		$GLOBALS['johnny5k_test_options'] = [];
		$GLOBALS['johnny5k_test_transients'] = [];
		$GLOBALS['johnny5k_test_http'] = [
			'post' => [],
			'request' => [],
		];
		$GLOBALS['johnny5k_test_http_log'] = [
			'post' => [],
			'request' => [],
		];
		$GLOBALS['johnny5k_test_hooks'] = [
			'actions' => [],
			'filters' => [],
		];
		$GLOBALS['johnny5k_test_activation_hooks'] = [];
		$GLOBALS['johnny5k_test_deactivation_hooks'] = [];
		$GLOBALS['johnny5k_test_did_actions'] = [ 'action_scheduler_init' => 1 ];
		$GLOBALS['johnny5k_test_registered_routes'] = [];
		$GLOBALS['johnny5k_test_scheduled_events'] = [];
		$GLOBALS['johnny5k_test_action_scheduler_actions'] = [];
		$GLOBALS['johnny5k_test_next_action_scheduler_id'] = 1;
		$GLOBALS['johnny5k_test_dbdelta'] = [];
		$GLOBALS['johnny5k_test_actions'] = [];
		$GLOBALS['johnny5k_test_users'] = [];
		$GLOBALS['johnny5k_test_posts'] = [];
		$GLOBALS['johnny5k_test_post_meta'] = [];
		$GLOBALS['johnny5k_test_attached_files'] = [];
		$GLOBALS['johnny5k_test_attachment_metadata'] = [];
		$GLOBALS['johnny5k_test_next_attachment_id'] = 500;
		$GLOBALS['johnny5k_test_current_user_id'] = 0;
		$GLOBALS['johnny5k_test_next_user_id'] = 100;
		$GLOBALS['johnny5k_test_now'] = '2026-04-09 12:00:00';
		$GLOBALS['johnny5k_test_is_admin'] = false;
		$GLOBALS['johnny5k_test_status_headers'] = [];
		$GLOBALS['johnny5k_test_admin_pages'] = [
			'menu' => [],
			'submenu' => [],
		];
		$GLOBALS['johnny5k_test_enqueued_styles'] = [];
		unset( $GLOBALS['johnny5k_test_auth_cookie'] );
	}

	protected function wpdb(): FakeWpdb {
		return $this->wpdb;
	}

	protected function setOption( string $key, mixed $value ): void {
		$GLOBALS['johnny5k_test_options'][ $key ] = $value;
	}

	protected function queueHttpPostResponse( mixed $response ): void {
		$GLOBALS['johnny5k_test_http']['post'][] = $response;
	}

	protected function queueHttpRequestResponse( mixed $response ): void {
		$GLOBALS['johnny5k_test_http']['request'][] = $response;
	}

	protected function invokePrivateStatic( string $class, string $method, array $args = [] ): mixed {
		$reflection = new ReflectionMethod( $class, $method );
		$reflection->setAccessible( true );

		return $reflection->invokeArgs( null, $args );
	}
}
