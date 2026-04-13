<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\DashboardController;

class AjaxBootstrap {

	public static function init(): void {
		add_action( 'wp_ajax_jf_progress_photo', [ DashboardController::class, 'ajax_progress_photo' ] );
		add_action( 'wp_ajax_nopriv_jf_progress_photo', [ __CLASS__, 'reject_unauthenticated_progress_photo' ] );
	}

	public static function reject_unauthenticated_progress_photo(): void {
		status_header( 401 );
		wp_die( 'Authentication required.' );
	}
}
