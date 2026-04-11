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
		$GLOBALS['johnny5k_test_scheduled_events'] = [];
		$GLOBALS['johnny5k_test_actions'] = [];
		$GLOBALS['johnny5k_test_users'] = [];
		$GLOBALS['johnny5k_test_current_user_id'] = 0;
		$GLOBALS['johnny5k_test_next_user_id'] = 100;
		unset( $GLOBALS['johnny5k_test_auth_cookie'] );
		unset( $GLOBALS['johnny5k_test_now'] );
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
