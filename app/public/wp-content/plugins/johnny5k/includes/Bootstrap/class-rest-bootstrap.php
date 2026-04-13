<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\Router;

class RestBootstrap {

	public static function init(): void {
		add_action( 'rest_api_init', [ Router::class, 'register_routes' ] );
	}
}
