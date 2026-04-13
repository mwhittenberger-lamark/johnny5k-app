<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Admin\AdminMenu;

class AdminBootstrap {

	public static function init(): void {
		if ( is_admin() ) {
			AdminMenu::init();
		}
	}
}
