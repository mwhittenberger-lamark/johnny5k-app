<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Bootstrap\AdminBootstrap;
use Johnny5k\Tests\Support\ServiceTestCase;

class AdminBootstrapTest extends ServiceTestCase {
	public function test_init_does_not_register_admin_hooks_outside_admin(): void {
		$GLOBALS['johnny5k_test_is_admin'] = false;

		AdminBootstrap::init();

		$this->assertArrayNotHasKey( 'admin_menu', $GLOBALS['johnny5k_test_hooks']['actions'] );
		$this->assertArrayNotHasKey( 'admin_enqueue_scripts', $GLOBALS['johnny5k_test_hooks']['actions'] );
	}

	public function test_init_registers_admin_hooks_inside_admin(): void {
		$GLOBALS['johnny5k_test_is_admin'] = true;

		AdminBootstrap::init();

		$this->assertCount( 1, $GLOBALS['johnny5k_test_hooks']['actions']['admin_menu'] ?? [] );
		$this->assertCount( 1, $GLOBALS['johnny5k_test_hooks']['actions']['admin_enqueue_scripts'] ?? [] );
	}
}
