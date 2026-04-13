<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Admin\AdminMenu;
use Johnny5k\Admin\OverviewPage;
use Johnny5k\Admin\OverviewStats;
use Johnny5k\Tests\Support\ServiceTestCase;

class AdminMenuTest extends ServiceTestCase {
	public function test_register_menus_uses_overview_page_for_top_level_dashboard(): void {
		AdminMenu::register_menus();

		$this->assertSame( [ OverviewPage::class, 'render' ], $GLOBALS['johnny5k_test_admin_pages']['menu'][0]['callback'] ?? null );
		$this->assertSame( [ OverviewPage::class, 'render' ], $GLOBALS['johnny5k_test_admin_pages']['submenu'][0]['callback'] ?? null );
		$this->assertSame( 'johnny5k', $GLOBALS['johnny5k_test_admin_pages']['menu'][0]['menu_slug'] ?? null );
		$this->assertSame( 'manage_options', $GLOBALS['johnny5k_test_admin_pages']['menu'][0]['capability'] ?? null );
		foreach ( $GLOBALS['johnny5k_test_admin_pages']['submenu'] as $submenu ) {
			$this->assertSame( 'manage_options', $submenu['capability'] ?? null );
		}
	}

	public function test_enqueue_assets_only_loads_on_plugin_pages(): void {
		AdminMenu::enqueue_assets( 'johnny5k_page_jf-settings' );
		AdminMenu::enqueue_assets( 'plugins.php' );

		$this->assertCount( 1, $GLOBALS['johnny5k_test_enqueued_styles'] );
		$this->assertSame( 'jf-admin', $GLOBALS['johnny5k_test_enqueued_styles'][0]['handle'] );
	}

	public function test_overview_stats_queries_expected_tables(): void {
		$db = $this->wpdb();
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_user_profiles', 18 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_user_profiles WHERE onboarding_complete = 1', 11 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_workout_sessions WHERE completed = 1', 92 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_meals WHERE confirmed = 1', 245 );

		$stats = OverviewStats::get();

		$this->assertSame( [
			'registered_users' => 18,
			'onboarding_complete' => 11,
			'workout_sessions' => 92,
			'meals_logged' => 245,
		], $stats );
	}

	public function test_overview_page_renders_stat_cards_from_stats_provider(): void {
		$db = $this->wpdb();
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_user_profiles', 18 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_user_profiles WHERE onboarding_complete = 1', 11 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_workout_sessions WHERE completed = 1', 92 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_meals WHERE confirmed = 1', 245 );

		$buffer_level = ob_get_level();
		ob_start();
		try {
			OverviewPage::render();
			$html = (string) ob_get_clean();
		} finally {
			while ( ob_get_level() > $buffer_level ) {
				ob_end_clean();
			}
		}

		$this->assertStringContainsString( 'Johnny5k Overview', $html );
		$this->assertStringContainsString( 'Registered Users', $html );
		$this->assertStringContainsString( 'Onboarding Complete', $html );
		$this->assertStringContainsString( 'Workout Sessions', $html );
		$this->assertStringContainsString( 'Meals Logged', $html );
		$this->assertStringContainsString( '>18<', $html );
		$this->assertStringContainsString( '>245<', $html );
	}
}
