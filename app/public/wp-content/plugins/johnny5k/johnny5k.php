<?php
/**
 * Plugin Name:       Johnny5k
 * Plugin URI:        https://johnny5k.app
 * Description:       The Johnny5k fitness, nutrition, and AI coaching platform backend.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            Johnny5k
 * License:           GPL-2.0+
 */

defined( 'ABSPATH' ) || exit;

define( 'JF_VERSION',        '1.0.0' );
define( 'JF_PLUGIN_DIR',     plugin_dir_path( __FILE__ ) );
define( 'JF_PLUGIN_URL',     plugin_dir_url( __FILE__ ) );
define( 'JF_REST_NAMESPACE', 'fit/v1' );
define( 'JF_DB_VERSION',     '1.0.1' );

// ── Autoloader ──────────────────────────────────────────────────────────────
spl_autoload_register( function ( string $class ): void {
    $prefix   = 'Johnny5k\\';
    $base_dir = JF_PLUGIN_DIR . 'includes/';

    if ( strncmp( $prefix, $class, strlen( $prefix ) ) !== 0 ) {
        return;
    }

    $relative   = substr( $class, strlen( $prefix ) );
    $parts      = explode( '\\', $relative );
    $class_name = array_pop( $parts );

    // PascalCase → kebab-case:  AdminMenu → admin-menu,  SmsService → sms-service
    $file_name = 'class-' . strtolower( preg_replace( '/([a-z])([A-Z])/', '$1-$2', $class_name ) ) . '.php';
    $dir       = implode( '/', $parts );
    $file      = $base_dir . ( $dir ? $dir . '/' : '' ) . $file_name;

    if ( file_exists( $file ) ) {
        require $file;
    }
} );

// ── Activation ───────────────────────────────────────────────────────────────
register_activation_hook( __FILE__, function (): void {
    Johnny5k\Database\Schema::create_tables();
    Johnny5k\Database\Schema::seed_defaults();
    update_option( 'jf_db_version', JF_DB_VERSION );

    // Disable WP's default registration so only invite-coded signup works.
    update_option( 'users_can_register', 0 );

    if ( ! wp_next_scheduled( 'jf_daily_sms_reminders' ) ) {
        wp_schedule_event( time() + 300, 'hourly', 'jf_daily_sms_reminders' );
    }
} );

// ── Deactivation ─────────────────────────────────────────────────────────────
register_deactivation_hook( __FILE__, function (): void {
    wp_clear_scheduled_hook( 'jf_daily_sms_reminders' );
    wp_clear_scheduled_hook( 'jf_weekly_calorie_adjust' );
    wp_clear_scheduled_hook( 'jf_evaluate_awards' );
} );

// ── Bootstrap ────────────────────────────────────────────────────────────────
add_action( 'plugins_loaded', function (): void {
    // Run DB migrations when version changes.
    if ( get_option( 'jf_db_version' ) !== JF_DB_VERSION ) {
        Johnny5k\Database\Schema::create_tables();
        update_option( 'jf_db_version', JF_DB_VERSION );
    }

    // REST API routes registered on rest_api_init.
    add_action( 'rest_api_init', [ Johnny5k\REST\Router::class, 'register_routes' ] );

    // Admin pages.
    if ( is_admin() ) {
        Johnny5k\Admin\AdminMenu::init();
    }

    // Schedule cron jobs if not already scheduled.
    $daily_sms_event = wp_get_scheduled_event( 'jf_daily_sms_reminders' );
    if ( ! $daily_sms_event ) {
        wp_schedule_event( time() + 300, 'hourly', 'jf_daily_sms_reminders' );
    } elseif ( 'hourly' !== ( $daily_sms_event->schedule ?? '' ) ) {
        wp_unschedule_event( $daily_sms_event->timestamp, 'jf_daily_sms_reminders' );
        wp_schedule_event( time() + 300, 'hourly', 'jf_daily_sms_reminders' );
    }
    if ( ! wp_next_scheduled( 'jf_weekly_calorie_adjust' ) ) {
        wp_schedule_event( strtotime( 'next monday 06:00:00' ), 'weekly', 'jf_weekly_calorie_adjust' );
    }
    if ( ! wp_next_scheduled( 'jf_evaluate_awards' ) ) {
        wp_schedule_event( time(), 'twicedaily', 'jf_evaluate_awards' );
    }
} );

// ── Cron handlers ─────────────────────────────────────────────────────────────
add_action( 'jf_daily_sms_reminders', function (): void {
    Johnny5k\Services\SmsService::run_daily_reminders();
} );

add_action( 'jf_weekly_calorie_adjust', function (): void {
    Johnny5k\Services\CalorieEngine::run_weekly_adjustments_all_users();
} );

add_action( 'jf_evaluate_awards', function (): void {
    Johnny5k\Services\AwardEngine::evaluate_all_users();
} );
