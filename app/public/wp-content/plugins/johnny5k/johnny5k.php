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
define( 'JF_PLUGIN_FILE',    __FILE__ );
define( 'JF_PLUGIN_DIR',     plugin_dir_path( __FILE__ ) );
define( 'JF_PLUGIN_URL',     plugin_dir_url( __FILE__ ) );
define( 'JF_REST_NAMESPACE', 'fit/v1' );
define( 'JF_DB_VERSION',     '1.1.13' );

$action_scheduler_bootstrap = JF_PLUGIN_DIR . 'vendor/woocommerce/action-scheduler/action-scheduler.php';
if ( file_exists( $action_scheduler_bootstrap ) ) {
	require_once $action_scheduler_bootstrap;
}

require_once JF_PLUGIN_DIR . 'vendor/autoload.php';

Johnny5k\Bootstrap\Plugin::init();
