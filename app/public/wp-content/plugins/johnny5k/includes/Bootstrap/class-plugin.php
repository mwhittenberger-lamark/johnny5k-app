<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Auth\PasswordResetEmailCustomizer;

class Plugin {

	private static bool $initialized = false;

	public static function init(): void {
		if ( self::$initialized ) {
			return;
		}

		self::$initialized = true;

		PluginLifecycle::register();

		add_action( 'plugins_loaded', [ __CLASS__, 'boot' ] );
	}

	public static function boot(): void {
		PluginLifecycle::maybe_upgrade_database();
		RestBootstrap::init();
		FrontendBootstrap::init();
		AdminBootstrap::init();
		AjaxBootstrap::init();
		CronBootstrap::init();
		PasswordResetEmailCustomizer::register();
	}
}
