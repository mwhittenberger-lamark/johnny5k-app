<?php

declare(strict_types=1);

namespace Johnny5k\Database;

if ( ! class_exists( Schema::class, false ) ) {
	class Schema {
		public static array $calls = [];

		public static function create_tables(): void {
			self::$calls[] = 'create_tables';
		}

		public static function seed_defaults(): void {
			self::$calls[] = 'seed_defaults';
		}
	}
}

namespace Johnny5k\Tests;

use Johnny5k\Auth\PasswordResetEmailCustomizer;
use Johnny5k\Bootstrap\Plugin;
use Johnny5k\Bootstrap\PluginLifecycle;
use Johnny5k\Bootstrap\CronBootstrap;
use Johnny5k\REST\DashboardController;
use Johnny5k\REST\Router;
use Johnny5k\Tests\Support\ServiceTestCase;

class PluginBootstrapTest extends ServiceTestCase {
	protected function setUp(): void {
		parent::setUp();

		\Johnny5k\Database\Schema::$calls = [];
		$this->resetPluginInitialized();
	}

	public function test_plugin_init_registers_lifecycle_hooks_and_plugins_loaded_callback_once(): void {
		Plugin::init();
		Plugin::init();

		$this->assertCount( 1, $GLOBALS['johnny5k_test_activation_hooks'] );
		$this->assertCount( 1, $GLOBALS['johnny5k_test_deactivation_hooks'] );
		$this->assertHookCount( 'actions', 'plugins_loaded', 1 );
		$this->assertSame( JF_PLUGIN_FILE, $GLOBALS['johnny5k_test_activation_hooks'][0]['file'] );
		$this->assertSame( [ Plugin::class, 'boot' ], $this->hookCallbacks( 'actions', 'plugins_loaded' )[0] );
	}

	public function test_plugin_boot_via_plugins_loaded_registers_runtime_hooks_once(): void {
		$GLOBALS['johnny5k_test_is_admin'] = true;
		$GLOBALS['johnny5k_test_options']['jf_db_version'] = JF_DB_VERSION;

		Plugin::init();
		Plugin::init();
		\do_action( 'plugins_loaded' );

		$this->assertHookCount( 'actions', 'rest_api_init', 1 );
		$this->assertSame( [ Router::class, 'register_routes' ], $this->hookCallbacks( 'actions', 'rest_api_init' )[0] );
		$this->assertHookCount( 'actions', 'admin_menu', 1 );
		$this->assertHookCount( 'actions', 'admin_enqueue_scripts', 1 );
		$this->assertHookCount( 'actions', 'wp_ajax_jf_progress_photo', 1 );
		$this->assertSame( [ DashboardController::class, 'ajax_progress_photo' ], $this->hookCallbacks( 'actions', 'wp_ajax_jf_progress_photo' )[0] );
		$this->assertHookCount( 'actions', 'wp_ajax_nopriv_jf_progress_photo', 1 );
		$this->assertHookCount( 'filters', 'cron_schedules', 1 );
		$this->assertHookCount( 'filters', 'retrieve_password_notification_email', 1 );
		$this->assertSame( [ PasswordResetEmailCustomizer::class, 'filter_notification_email' ], $this->hookCallbacks( 'filters', 'retrieve_password_notification_email' )[0] );
		$this->assertHookCount( 'actions', 'jf_daily_sms_reminders', 1 );
		$this->assertHookCount( 'actions', 'jf_send_scheduled_sms_reminder', 1 );
		$this->assertHookCount( 'actions', 'jf_weekly_calorie_adjust', 1 );
		$this->assertHookCount( 'actions', 'jf_evaluate_awards', 1 );
		$this->assertHookCount( 'actions', 'jf_process_coach_deliveries', 1 );
		$this->assertSame( 4, count( $GLOBALS['johnny5k_test_action_scheduler_actions'] ) );
	}

	public function test_plugin_lifecycle_activate_updates_options_invokes_schema_and_schedules_events(): void {
		PluginLifecycle::activate();

		$this->assertSame( [ 'create_tables', 'seed_defaults' ], \Johnny5k\Database\Schema::$calls );
		$this->assertSame( JF_DB_VERSION, \get_option( 'jf_db_version' ) );
		$this->assertSame( 0, \get_option( 'users_can_register' ) );
		$this->assertHookCount( 'filters', 'cron_schedules', 1 );
		$this->assertActionScheduled( 'jf_daily_sms_reminders' );
		$this->assertActionScheduled( 'jf_weekly_calorie_adjust' );
		$this->assertActionScheduled( 'jf_evaluate_awards' );
		$this->assertActionScheduled( 'jf_process_coach_deliveries' );
	}

	public function test_plugin_lifecycle_deactivate_clears_plugin_cron_hooks(): void {
		\wp_schedule_event( 1000, 'hourly', 'jf_daily_sms_reminders' );
		\wp_schedule_event( 1000, 'hourly', 'jf_send_scheduled_sms_reminder', [ 7, 'abc' ] );
		\wp_schedule_event( 1000, 'weekly', 'jf_weekly_calorie_adjust' );
		\wp_schedule_event( 1000, 'twicedaily', 'jf_evaluate_awards' );
		\wp_schedule_event( 1000, 'hourly', 'jf_process_coach_deliveries' );
		\wp_schedule_event( 1000, 'hourly', 'other_hook' );

		PluginLifecycle::deactivate();

		$hooks = array_column( $GLOBALS['johnny5k_test_scheduled_events'], 'hook' );
		$this->assertSame( [ 'other_hook' ], $hooks );
		$this->assertSame( [], $GLOBALS['johnny5k_test_action_scheduler_actions'] );
	}

	private function resetPluginInitialized(): void {
		$reflection = new \ReflectionProperty( Plugin::class, 'initialized' );
		$reflection->setValue( null, false );
	}

	private function assertHookCount( string $type, string $hook, int $expected ): void {
		$this->assertCount( $expected, $this->hookCallbacks( $type, $hook ) );
	}

	private function hookCallbacks( string $type, string $hook ): array {
		return array_map(
			static fn( array $entry ): mixed => $entry['callback'],
			$GLOBALS['johnny5k_test_hooks'][ $type ][ $hook ] ?? []
		);
	}

	private function assertActionScheduled( string $hook ): void {
		$hooks = array_column( $GLOBALS['johnny5k_test_action_scheduler_actions'], 'hook' );
		$this->assertContains( $hook, $hooks );
	}
}
