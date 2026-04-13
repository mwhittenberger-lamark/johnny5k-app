<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Bootstrap\AjaxBootstrap;
use Johnny5k\REST\DashboardController;
use Johnny5k\Tests\Support\ServiceTestCase;

class AjaxBootstrapTest extends ServiceTestCase {
	public function test_init_registers_ajax_hooks(): void {
		AjaxBootstrap::init();

		$this->assertSame(
			[ DashboardController::class, 'ajax_progress_photo' ],
			$GLOBALS['johnny5k_test_hooks']['actions']['wp_ajax_jf_progress_photo'][0]['callback'] ?? null
		);
		$this->assertSame(
			[ AjaxBootstrap::class, 'reject_unauthenticated_progress_photo' ],
			$GLOBALS['johnny5k_test_hooks']['actions']['wp_ajax_nopriv_jf_progress_photo'][0]['callback'] ?? null
		);
	}

	public function test_reject_unauthenticated_progress_photo_sets_401_and_dies(): void {
		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'Authentication required.' );

		try {
			AjaxBootstrap::reject_unauthenticated_progress_photo();
		} finally {
			$this->assertSame( [ 401 ], $GLOBALS['johnny5k_test_status_headers'] );
		}
	}
}
