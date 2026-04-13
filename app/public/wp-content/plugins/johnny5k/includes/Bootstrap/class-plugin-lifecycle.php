<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Database\Schema;

class PluginLifecycle {

	public static function register(): void {
		register_activation_hook( JF_PLUGIN_FILE, [ __CLASS__, 'activate' ] );
		register_deactivation_hook( JF_PLUGIN_FILE, [ __CLASS__, 'deactivate' ] );
	}

	public static function activate(): void {
		Schema::create_tables();
		Schema::seed_defaults();
		update_option( 'jf_db_version', JF_DB_VERSION );

		// Disable WP's default registration so only invite-coded signup works.
		update_option( 'users_can_register', 0 );

		add_filter( 'cron_schedules', [ CronBootstrap::class, 'register_schedules' ] );
		CronBootstrap::ensure_schedules();
	}

	public static function deactivate(): void {
		CronBootstrap::clear_schedules();
	}

	public static function maybe_upgrade_database(): void {
		if ( get_option( 'jf_db_version' ) === JF_DB_VERSION ) {
			return;
		}

		Schema::create_tables();
		update_option( 'jf_db_version', JF_DB_VERSION );
	}
}
