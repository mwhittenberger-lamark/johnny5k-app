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
			[ __CLASS__, 'render_dashboard' ],
			'dashicons-heart',
			30
		);

		add_submenu_page( 'johnny5k', 'Overview',          'Overview',          'manage_options', 'johnny5k',              [ __CLASS__,  'render_dashboard' ] );
		add_submenu_page( 'johnny5k', 'Invite Codes',      'Invite Codes',      'manage_options', 'jf-invite-codes',       [ InviteAdmin::class,        'render' ] );
		add_submenu_page( 'johnny5k', 'API Cost Dashboard','API Cost Dashboard','manage_options', 'jf-cost-dashboard',     [ CostDashboard::class,      'render' ] );
		add_submenu_page( 'johnny5k', 'Johnny 5000 Persona','Personality Editor','manage_options','jf-personality-editor', [ PersonalityEditor::class,  'render' ] );
		add_submenu_page( 'johnny5k', 'Exercise Library',  'Exercise Library',  'manage_options', 'jf-exercise-library',   [ ExerciseLibrary::class,    'render' ] );
		add_submenu_page( 'johnny5k', 'Recipe Library',    'Recipe Library',    'manage_options', 'jf-recipe-library',     [ RecipeLibrary::class,      'render' ] );
		add_submenu_page( 'johnny5k', 'Settings',          'Settings',          'manage_options', 'jf-settings',           [ Settings::class,           'render' ] );
	}

	public static function enqueue_assets( string $hook ): void {
		// Only load our styles on our own pages
		if ( strpos( $hook, 'johnny5k' ) === false && strpos( $hook, 'jf-' ) === false ) {
			return;
		}
		wp_enqueue_style( 'jf-admin', plugins_url( 'assets/admin.css', JF_PLUGIN_DIR . 'johnny5k.php' ), [], JF_VERSION );
	}

	public static function render_dashboard(): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_user_profiles" );
		$completed  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_user_profiles WHERE onboarding_complete = 1" );
		$sessions   = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_workout_sessions WHERE completed = 1" );
		$meals      = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_meals WHERE confirmed = 1" );

		echo '<div class="wrap">';
		echo '<h1>Johnny5k Overview</h1>';
		echo '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px">';
		self::stat_card( 'Registered Users',   $user_count );
		self::stat_card( 'Onboarding Complete', $completed );
		self::stat_card( 'Workout Sessions',   $sessions );
		self::stat_card( 'Meals Logged',       $meals );
		echo '</div>';
		echo '</div>';
	}

	private static function stat_card( string $label, int $value ): void {
		printf(
			'<div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;text-align:center">
				<div style="font-size:2em;font-weight:700;color:#1d2327">%s</div>
				<div style="color:#666;margin-top:4px">%s</div>
			</div>',
			esc_html( number_format( $value ) ),
			esc_html( $label )
		);
	}
}
