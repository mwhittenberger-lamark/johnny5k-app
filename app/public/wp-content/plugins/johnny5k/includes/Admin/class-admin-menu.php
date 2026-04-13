<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the "Johnny5k" WP admin menu and delegates rendering to sub-pages.
 */
class AdminMenu {

	public static function init(): void {
		add_action( 'admin_menu', [ __CLASS__, 'register_menus' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
	}

	public static function register_menus(): void {
		add_menu_page(
			'Johnny5k',
			'Johnny5k',
			'manage_options',
			'johnny5k',
			[ OverviewPage::class, 'render' ],
			'dashicons-heart',
			30
		);

		add_submenu_page( 'johnny5k', 'Overview',          'Overview',          'manage_options', 'johnny5k',              [ OverviewPage::class,       'render' ] );
		add_submenu_page( 'johnny5k', 'Invite Codes',      'Invite Codes',      'manage_options', 'jf-invite-codes',       [ InviteAdmin::class,        'render' ] );
		add_submenu_page( 'johnny5k', 'API Cost Dashboard','API Cost Dashboard','manage_options', 'jf-cost-dashboard',     [ CostDashboard::class,      'render' ] );
		add_submenu_page( 'johnny5k', 'Johnny5k Persona','Personality Editor','manage_options','jf-personality-editor', [ PersonalityEditor::class,  'render' ] );
		add_submenu_page( 'johnny5k', 'User Analytics','User Analytics','manage_options','jf-retention-dashboard', [ RetentionDashboard::class, 'render' ] );
		add_submenu_page( 'johnny5k', 'Exercise Library',  'Exercise Library',  'manage_options', 'jf-exercise-library',   [ ExerciseLibrary::class,    'render' ] );
		add_submenu_page( 'johnny5k', 'Recipe Library',    'Recipe Library',    'manage_options', 'jf-recipe-library',     [ RecipeLibrary::class,      'render' ] );
		add_submenu_page( 'johnny5k', 'Job Monitor',       'Job Monitor',       'manage_options', 'jf-job-monitor',        [ JobMonitorPage::class,     'render' ] );
		add_submenu_page( 'johnny5k', 'Support Guides',    'Support Guides',    'manage_options', 'jf-support-guides',     [ SupportGuides::class,      'render' ] );
		add_submenu_page( 'johnny5k', 'Settings',          'Settings',          'manage_options', 'jf-settings',           [ Settings::class,           'render' ] );
	}

	public static function enqueue_assets( string $hook ): void {
		// Only load our styles on our own pages
		if ( strpos( $hook, 'johnny5k' ) === false && strpos( $hook, 'jf-' ) === false ) {
			return;
		}
		wp_enqueue_style( 'jf-admin', plugins_url( 'assets/admin.css', JF_PLUGIN_FILE ), [], JF_VERSION );
	}
}
