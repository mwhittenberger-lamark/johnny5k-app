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
define( 'JF_DB_VERSION',     '1.1.8' );

if ( file_exists( JF_PLUGIN_DIR . 'vendor/autoload.php' ) ) {
	require_once JF_PLUGIN_DIR . 'vendor/autoload.php';
}

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
    wp_clear_scheduled_hook( 'jf_send_scheduled_sms_reminder' );
    wp_clear_scheduled_hook( 'jf_weekly_calorie_adjust' );
    wp_clear_scheduled_hook( 'jf_evaluate_awards' );
    wp_clear_scheduled_hook( 'jf_process_coach_deliveries' );
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
    if ( ! wp_next_scheduled( 'jf_process_coach_deliveries' ) ) {
        wp_schedule_event( time() + 300, 'hourly', 'jf_process_coach_deliveries' );
    }
} );

add_filter( 'cron_schedules', function ( array $schedules ): array {
	if ( ! isset( $schedules['weekly'] ) ) {
		$schedules['weekly'] = [
			'interval' => WEEK_IN_SECONDS,
			'display'  => 'Once Weekly',
		];
	}

	return $schedules;
} );

add_filter( 'retrieve_password_notification_email', function ( array $defaults, string $key, string $user_login, \WP_User $user_data ): array {
	$reset_url = home_url( '/reset-password?key=' . rawurlencode( $key ) . '&login=' . rawurlencode( $user_login ) );

	$defaults['subject'] = sprintf( '[%s] Reset your Johnny5k password', wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES ) );
	$defaults['message'] = "Hi,\n\nWe received a request to reset your Johnny5k password.\n\nReset it here:\n{$reset_url}\n\nIf you did not request this, you can ignore this email.\n";

	return $defaults;
}, 10, 4 );

add_action( 'wp_ajax_jf_progress_photo', [ Johnny5k\REST\DashboardController::class, 'ajax_progress_photo' ] );
add_action( 'wp_ajax_nopriv_jf_progress_photo', function (): void {
	status_header( 401 );
	wp_die( 'Authentication required.' );
} );

// ── Cron handlers ─────────────────────────────────────────────────────────────
add_action( 'jf_daily_sms_reminders', function (): void {
    Johnny5k\Services\SmsService::run_daily_reminders();
} );

add_action( 'jf_send_scheduled_sms_reminder', function ( int $user_id, string $reminder_id ): void {
	Johnny5k\Services\SmsService::send_scheduled_reminder( $user_id, $reminder_id );
}, 10, 2 );

add_action( 'jf_weekly_calorie_adjust', function (): void {
    Johnny5k\Services\CalorieEngine::run_weekly_adjustments_all_users();
} );

add_action( 'jf_evaluate_awards', function (): void {
    Johnny5k\Services\AwardEngine::run_all();
} );

add_action( 'jf_process_coach_deliveries', function (): void {
    Johnny5k\Services\CoachDeliveryService::process_due_follow_ups_all_users();
    Johnny5k\Services\PushService::cleanup_disabled_subscriptions();
    Johnny5k\Services\PushService::cleanup_stale_active_subscriptions();
} );
