<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Auth\InviteCodes;
use Johnny5k\Services\AiService;
use Johnny5k\Services\CostTracker;
use Johnny5k\Services\GeminiImageService;
use Johnny5k\Services\InternalDiagnosticsLogger;
use Johnny5k\Services\IronQuestEntitlementService;
use Johnny5k\Services\IronQuestAiNarrativeService;
use Johnny5k\Services\IronQuestProfileService;
use Johnny5k\Services\IronQuestRegistryService;
use Johnny5k\Services\IronQuestStoryEngineService;
use Johnny5k\Services\PushService;
use Johnny5k\Services\SupportGuideService;
use Johnny5k\Services\UserTime;

/**
 * REST Controller: Admin API
 *
 * All routes require is_admin (current user is WP administrator).
 *
 * GET  /fit/v1/admin/users            — list all fit users
 * GET  /fit/v1/admin/invite-codes     — list invite codes
 * POST /fit/v1/admin/invite-codes     — generate new invite code
 * DELETE /fit/v1/admin/invite-codes/{id} — delete unused code
 * GET  /fit/v1/admin/costs            — cost summary (monthly total, per-user, daily)
 * GET  /fit/v1/admin/persona          — get Johnny5k persona settings
 * POST /fit/v1/admin/persona          — save Johnny5k persona settings
 * GET  /fit/v1/admin/support-guides   — read support guides and support analytics
 * POST /fit/v1/admin/persona/test     — test persona with a message
 * POST /fit/v1/admin/sms/test         — send a test SMS reminder to a user
 */
class AdminApiController {
	private const RECIPE_DIETARY_TAG_OPTIONS = [
		'vegan',
		'vegetarian',
		'high_protein',
		'mediterranean',
		'keto',
		'paleo',
		'dash',
		'whole30',
	];
	private const IRONQUEST_STORY_WORKBENCH_SESSIONS_OPTION = 'jf_ironquest_story_workbench_sessions';
	private const IRONQUEST_STORY_WORKBENCH_APPROVALS_OPTION = 'jf_ironquest_story_workbench_approvals';
	private const IRONQUEST_STORY_WORKBENCH_SESSION_LIMIT = 24;

	public static function default_color_schemes(): array {
		return [
			[
				'id' => 'classic',
				'label' => 'Modern Skyscraper',
				'description' => 'Steel-blue glass at dusk with amber window light, coral warnings, and mint success states.',
				'colors' => [
					'bg' => '#0A0E14',
					'bg2' => '#111922',
					'bg3' => '#16212B',
					'text' => '#EAF1F6',
					'textMuted' => '#7C8E9C',
					'text2' => '#EAF1F6',
					'textMuted2' => '#7C8E9C',
					'text3' => '#EAF1F6',
					'textMuted3' => '#7C8E9C',
					'border' => '#253244',
					'accent' => '#E8B84A',
					'accent2' => '#4FC3E0',
					'accent3' => '#4FC3E0',
					'danger' => '#D9724A',
					'success' => '#5FD9A0',
					'yellow' => '#E8B84A',
				],
			],
			[
				'id' => 'batman',
				'label' => 'Batman',
				'description' => 'Black, steel grey, Gotham blue, and signal yellow.',
				'colors' => [
					'bg' => '#0A0B0F',
					'bg2' => '#171A21',
					'bg3' => '#242933',
					'text' => '#E8EDF6',
					'textMuted' => '#97A4BA',
					'text2' => '#E8EDF6',
					'textMuted2' => '#97A4BA',
					'text3' => '#E8EDF6',
					'textMuted3' => '#97A4BA',
					'border' => '#445064',
					'accent' => '#F5C400',
					'accent2' => '#2D6CDF',
					'accent3' => '#5A6475',
					'danger' => '#FF5B6E',
					'success' => '#35C57A',
					'yellow' => '#FFD54A',
				],
			],
			[
				'id' => 'mint-drive',
				'label' => 'Mint Drive',
				'description' => 'Cool mint surfaces with navy and lime highlights.',
				'colors' => [
					'bg' => '#EAFBF4',
					'bg2' => '#FFFFFF',
					'bg3' => '#D0F3E5',
					'text' => '#123B3A',
					'textMuted' => '#507A73',
					'text2' => '#123B3A',
					'textMuted2' => '#507A73',
					'text3' => '#123B3A',
					'textMuted3' => '#507A73',
					'border' => '#9EDBBC',
					'accent' => '#0E7C66',
					'accent2' => '#3BC9A3',
					'accent3' => '#89E219',
					'danger' => '#D1495B',
					'success' => '#1E9E63',
					'yellow' => '#E7D04A',
				],
			],
			[
				'id' => 'midnight-track',
				'label' => 'Midnight Track',
				'description' => 'Deep slate base with electric cyan and hot orange.',
				'colors' => [
					'bg' => '#0D1B2A',
					'bg2' => '#132238',
					'bg3' => '#1C3350',
					'text' => '#EAF4FF',
					'textMuted' => '#98B6D8',
					'text2' => '#EAF4FF',
					'textMuted2' => '#98B6D8',
					'text3' => '#EAF4FF',
					'textMuted3' => '#98B6D8',
					'border' => '#315074',
					'accent' => '#FF7A21',
					'accent2' => '#4FD1FF',
					'accent3' => '#FF4FA3',
					'danger' => '#FF5C7A',
					'success' => '#36D48C',
					'yellow' => '#FFD95A',
				],
			],
			[
				'id' => 'gold-rush',
				'label' => 'Gold Rush',
				'description' => 'Cream, brass, and forest accents with a punchy red.',
				'colors' => [
					'bg' => '#F8F2E3',
					'bg2' => '#FFF9ED',
					'bg3' => '#E8D8B1',
					'text' => '#3B2A19',
					'textMuted' => '#7A6243',
					'text2' => '#3B2A19',
					'textMuted2' => '#7A6243',
					'text3' => '#3B2A19',
					'textMuted3' => '#7A6243',
					'border' => '#CFB37A',
					'accent' => '#B8572D',
					'accent2' => '#5B8C5A',
					'accent3' => '#C08B14',
					'danger' => '#C64845',
					'success' => '#478C4A',
					'yellow' => '#E2B93B',
				],
			],
		];
	}

	public static function get_color_schemes_config(): array {
		return self::sanitize_color_schemes( get_option( 'jf_color_schemes', self::default_color_schemes() ) );
	}

	public static function default_live_workout_frames(): array {
		return [];
	}

	public static function default_app_images(): array {
		return [
			'brandmark' => JF_PLUGIN_URL . 'pwa/src/assets/F9159E4E-E475-4BE5-8674-456B7BEFDBEE.webp',
			'login_welcome' => JF_PLUGIN_URL . 'pwa/src/assets/welcome.webp',
			'johnny_drawer' => JF_PLUGIN_URL . 'pwa/src/assets/8CD0AD13-4C88-49C7-A455-4B180A3F732B.webp',
			'live_workout_frame_1' => JF_PLUGIN_URL . 'pwa/src/assets/8CD0AD13-4C88-49C7-A455-4B180A3F732B.webp',
			'live_workout_frame_2' => JF_PLUGIN_URL . 'pwa/src/assets/F9159E4E-E475-4BE5-8674-456B7BEFDBEE.webp',
			'live_workout_frame_3' => JF_PLUGIN_URL . 'pwa/src/assets/hero.png',
		];
	}

	public static function get_app_images_config(): array {
		return self::sanitize_app_images( get_option( 'jf_app_images', self::default_app_images() ) );
	}

	public static function get_live_workout_frames_config(): array {
		return self::sanitize_live_workout_frames( get_option( 'jf_live_workout_frames', self::default_live_workout_frames() ) );
	}

	public static function sanitize_color_schemes( $schemes ): array {
		$defaults = self::default_color_schemes();
		$allowed_color_keys = [ 'bg', 'bg2', 'bg3', 'text', 'textMuted', 'text2', 'textMuted2', 'text3', 'textMuted3', 'border', 'accent', 'accent2', 'accent3', 'danger', 'success', 'yellow' ];
		$clean = [];

		if ( ! is_array( $schemes ) ) {
			$schemes = [];
		}

		foreach ( $schemes as $index => $scheme ) {
			if ( ! is_array( $scheme ) ) {
				continue;
			}

			$fallback = $defaults[ $index ] ?? $defaults[0];
			$id = sanitize_key( (string) ( $scheme['id'] ?? '' ) );
			if ( '' === $id ) {
				$id = sanitize_key( (string) $fallback['id'] );
			}

			$colors = [];
			$raw_colors = is_array( $scheme['colors'] ?? null ) ? $scheme['colors'] : [];
			foreach ( $allowed_color_keys as $color_key ) {
				$fallback_key = $color_key;

				if ( 'text2' === $color_key || 'text3' === $color_key ) {
					$fallback_key = 'text';
				}

				if ( 'textMuted2' === $color_key || 'textMuted3' === $color_key ) {
					$fallback_key = 'textMuted';
				}

				$color_value = sanitize_hex_color( (string) ( $raw_colors[ $color_key ] ?? '' ) );
				if ( ! $color_value && isset( $raw_colors[ $fallback_key ] ) ) {
					$color_value = sanitize_hex_color( (string) $raw_colors[ $fallback_key ] );
				}

				$colors[ $color_key ] = $color_value ?: ( $fallback['colors'][ $color_key ] ?? $fallback['colors'][ $fallback_key ] );
			}

			$clean[] = [
				'id' => $id,
				'label' => sanitize_text_field( (string) ( $scheme['label'] ?? $fallback['label'] ) ),
				'description' => sanitize_text_field( (string) ( $scheme['description'] ?? $fallback['description'] ) ),
				'colors' => $colors,
			];
		}

		if ( empty( $clean ) ) {
			return $defaults;
		}

		return array_values( $clean );
	}

	public static function sanitize_live_workout_frames( $frames ): array {
		if ( ! is_array( $frames ) ) {
			return self::default_live_workout_frames();
		}

		$clean = [];

		foreach ( $frames as $index => $frame ) {
			if ( ! is_array( $frame ) ) {
				continue;
			}

			$image_url = esc_url_raw( (string) ( $frame['image_url'] ?? '' ) );
			if ( '' === $image_url ) {
				continue;
			}

			$label = sanitize_text_field( (string) ( $frame['label'] ?? '' ) );
			$note  = sanitize_text_field( (string) ( $frame['note'] ?? '' ) );

			$clean[] = [
				'image_url' => $image_url,
				'label'     => '' !== $label ? $label : sprintf( 'Live frame %d', (int) $index + 1 ),
				'note'      => $note,
			];

			if ( count( $clean ) >= 8 ) {
				break;
			}
		}

		return array_values( $clean );
	}

	public static function sanitize_app_images( $images ): array {
		$defaults = self::default_app_images();
		$clean = [];

		if ( ! is_array( $images ) ) {
			$images = [];
		}

		foreach ( $defaults as $key => $default_url ) {
			$image_url = esc_url_raw( (string) ( $images[ $key ] ?? '' ) );
			$clean[ $key ] = '' !== $image_url ? $image_url : $default_url;
		}

		return $clean;
	}

	public static function register_routes(): void {
		$ns    = JF_REST_NAMESPACE;
		$admin = [ 'Johnny5k\REST\AuthController', 'require_admin' ];

		register_rest_route( $ns, '/admin/users', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'list_users' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/invite-codes', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_invite_codes' ],   'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'generate_invite_code' ],'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/invite-codes/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_invite_code' ],
			'permission_callback' => $admin,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/admin/costs', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_costs' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/exercises', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_exercises' ], 'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_exercise' ],  'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/exercises/(?P<id>\d+)', [
			'methods'             => 'PUT',
			'callback'            => [ __CLASS__, 'save_exercise' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/substitutions', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_substitutions' ], 'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_substitution' ],  'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/substitutions/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_substitution' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/awards', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_awards' ], 'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_award' ],  'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/awards/(?P<id>\d+)', [
			'methods'             => 'PUT',
			'callback'            => [ __CLASS__, 'save_award' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/recipes', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_recipe_library' ], 'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_recipe_library_item' ], 'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/recipes/discover', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'discover_recipes' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/recipes/retag', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'retag_recipe_library_items' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/recipes/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_recipe_library_item' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/recipes/(?P<id>\d+)/generate-image', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'generate_recipe_library_item_image' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/settings', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_settings' ], 'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_settings' ], 'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/persona', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_persona' ],  'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_persona' ], 'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/support-guides', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_support_guides' ],  'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/persona/test', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'test_persona' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/persona/time-preview', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'preview_persona_time' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/persona/action-preview', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'preview_persona_actions' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/persona/follow-ups', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_persona_follow_ups' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/sms/test', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'test_sms' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/push/test', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'test_push' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/diagnostics', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_diagnostics' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/state', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_ironquest_state' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/action', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'run_ironquest_action' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-preview', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'preview_ironquest_story_workbench' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-review', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'review_ironquest_story_workbench_candidate' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-export', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'export_ironquest_story_workbench' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-apply', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'apply_ironquest_story_workbench_export' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-scene', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_ironquest_story_workbench_scene' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-scene-suggest', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'suggest_ironquest_story_workbench_scene' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-location', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_ironquest_story_workbench_location' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-location-suggest', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'suggest_ironquest_story_workbench_location' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-mission', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_ironquest_story_workbench_mission' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-mission-suggest', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'suggest_ironquest_story_workbench_mission' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/ironquest/story-workbench-bootstrap', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'bootstrap_ironquest_story_workbench_mission' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/client-diagnostics', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'log_client_diagnostic' ],
			'permission_callback' => [ 'Johnny5k\REST\AuthController', 'require_auth' ],
		] );

		register_rest_route( $ns, '/admin/analytics/retention', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_retention_analytics' ],
			'permission_callback' => $admin,
		] );
	}

	// ── GET /admin/users ──────────────────────────────────────────────────────

	public static function list_users( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT u.ID AS user_id, u.user_email, u.user_registered,
			        p.first_name, p.last_name, p.current_goal AS goal_type, p.onboarding_complete
			 FROM {$wpdb->prefix}users u
			 LEFT JOIN {$wpdb->prefix}fit_user_profiles p ON p.user_id = u.ID
			 ORDER BY u.user_registered DESC"
		);

		return new \WP_REST_Response( $rows );
	}

	// ── GET /admin/invite-codes ───────────────────────────────────────────────

	public static function list_invite_codes( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( InviteCodes::get_all() );
	}

	// ── POST /admin/invite-codes ──────────────────────────────────────────────

	public static function generate_invite_code( \WP_REST_Request $req ): \WP_REST_Response {
		$admin_id = get_current_user_id();
		$code     = InviteCodes::generate( $admin_id );

		if ( is_wp_error( $code ) ) {
			return new \WP_REST_Response( [ 'message' => $code->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [ 'code' => $code ], 201 );
	}

	// ── DELETE /admin/invite-codes/{id} ───────────────────────────────────────

	public static function delete_invite_code( \WP_REST_Request $req ): \WP_REST_Response {
		$id     = (int) $req->get_param( 'id' );
		$result = InviteCodes::delete_unused( $id );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	// ── GET /admin/costs ──────────────────────────────────────────────────────

	public static function get_costs( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'monthly_total'    => CostTracker::monthly_total(),
			'monthly_by_user'  => CostTracker::monthly_by_user(),
			'daily_last_30'    => CostTracker::daily_totals_last_30(),
		] );
	}

	public static function get_ironquest_state( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = (int) ( $req->get_param( 'user_id' ) ?: 0 );
		if ( $user_id <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'A valid user id is required.' ], 400 );
		}

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new \WP_REST_Response( [ 'message' => 'User not found.' ], 404 );
		}

		return new \WP_REST_Response(
			[
				'user'  => [
					'user_id'    => $user_id,
					'user_email' => (string) $user->user_email,
					'display_name' => (string) $user->display_name,
				],
				'state' => IronQuestController::admin_build_profile_payload( $user_id ),
				'config' => [
					'locations' => array_values( IronQuestRegistryService::get_locations_config()['locations'] ?? [] ),
					'graph'     => IronQuestRegistryService::get_launch_graph_config(),
					'seed'      => IronQuestRegistryService::get_seed_bundle(),
				],
			]
		);
	}

	public static function run_ironquest_action( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = (int) ( $req->get_param( 'user_id' ) ?: 0 );
		$action  = sanitize_key( (string) ( $req->get_param( 'action' ) ?: '' ) );

		if ( $user_id <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'A valid user id is required.' ], 400 );
		}

		if ( ! get_userdata( $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'User not found.' ], 404 );
		}

		$result  = [];
		$message = '';

		switch ( $action ) {
			case 'enable':
				$result  = [ 'profile' => IronQuestProfileService::enable_for_user( $user_id ) ];
				$message = 'IronQuest enabled for this user.';
				break;

			case 'disable':
				$result  = [ 'profile' => IronQuestProfileService::disable_for_user( $user_id ) ];
				$message = 'IronQuest disabled for this user.';
				break;

			case 'start_mission':
				$result = IronQuestController::admin_start_mission(
					$user_id,
					(string) ( $req->get_param( 'location_slug' ) ?: '' ),
					(string) ( $req->get_param( 'mission_slug' ) ?: '' ),
					(string) ( $req->get_param( 'run_type' ) ?: 'workout' ),
					(string) ( $req->get_param( 'source_session_id' ) ?: '' )
				);
				$message = 'Started an IronQuest mission run.';
				break;

			case 'grant_travel':
				$result = IronQuestController::admin_grant_travel_points(
					$user_id,
					(int) ( $req->get_param( 'travel_points' ) ?: 0 ),
					(string) ( $req->get_param( 'travel_source' ) ?: '' ),
					(string) ( $req->get_param( 'state_date' ) ?: '' )
				);
				$message = 'Granted travel points.';
				break;

			case 'mark_daily_quest':
				$quest_key = sanitize_key( (string) ( $req->get_param( 'quest_key' ) ?: '' ) );
				if ( ! in_array( $quest_key, [ 'meal', 'sleep', 'cardio', 'steps', 'workout' ], true ) ) {
					return new \WP_REST_Response( [ 'message' => 'A valid daily quest key is required.' ], 400 );
				}
				$result  = IronQuestController::admin_mark_daily_quest( $user_id, $quest_key, (string) ( $req->get_param( 'state_date' ) ?: '' ) );
				$message = sprintf( 'Marked the %s quest complete.', $quest_key );
				break;

			case 'resolve_active_mission':
				$result = IronQuestController::admin_resolve_active_mission(
					$user_id,
					(string) ( $req->get_param( 'result_band' ) ?: 'victory' ),
					(int) ( $req->get_param( 'xp_awarded' ) ?: 0 ),
					(int) ( $req->get_param( 'gold_awarded' ) ?: 0 )
				);
				$message = 'Resolved the active IronQuest mission.';
				break;

			case 'clear_location_arc':
				$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: '' ) );
				if ( '' === $location_slug ) {
					return new \WP_REST_Response( [ 'message' => 'A location slug is required.' ], 400 );
				}
				$result  = IronQuestController::admin_clear_location_arc( $user_id, $location_slug, (int) ( $req->get_param( 'source_run_id' ) ?: 0 ) );
				$message = sprintf( 'Cleared the %s location arc.', $location_slug );
				break;

			case 'unlock_location':
				$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: '' ) );
				if ( '' === $location_slug ) {
					return new \WP_REST_Response( [ 'message' => 'A location slug is required.' ], 400 );
				}
				$result  = IronQuestController::admin_unlock_location( $user_id, $location_slug, (int) ( $req->get_param( 'source_run_id' ) ?: 0 ) );
				$message = sprintf( 'Unlocked the %s location.', $location_slug );
				break;

			case 'jump_location':
				$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: '' ) );
				if ( '' === $location_slug ) {
					return new \WP_REST_Response( [ 'message' => 'A location slug is required.' ], 400 );
				}
				$result  = IronQuestController::admin_jump_location( $user_id, $location_slug );
				$message = sprintf( 'Moved the user to %s.', $location_slug );
				break;

			default:
				return new \WP_REST_Response( [ 'message' => 'Unsupported IronQuest admin action.' ], 400 );
		}

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response(
			[
				'success' => true,
				'action'  => $action,
				'message' => $message,
				'result'  => $result,
				'state'   => IronQuestController::admin_build_profile_payload( $user_id ),
				'access'  => [
					'entitled' => IronQuestEntitlementService::user_has_access( $user_id ),
					'profile_enabled' => ! empty( ( IronQuestProfileService::get_profile( $user_id ) ?? [] )['enabled'] ),
				],
			]
		);
	}

	public static function preview_ironquest_story_workbench( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$slot = sanitize_key( (string) ( $req->get_param( 'slot' ) ?: '' ) );
		$encounter_seed_slug = sanitize_key( (string) ( $req->get_param( 'encounter_seed_slug' ) ?: '' ) );
		$count = max( 1, min( 24, (int) ( $req->get_param( 'count' ) ?: 12 ) ) );

		if ( '' === $mission_slug || '' === $slot ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug and slot are required.' ], 400 );
		}

		$mission = self::find_ironquest_mission( $mission_slug );
		if ( [] === $mission ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found.' ], 404 );
		}

		$location = IronQuestRegistryService::get_location( (string) ( $mission['location_slug'] ?? '' ) ) ?? [];
		$encounter_seed = self::find_encounter_seed( $mission, $encounter_seed_slug );
		if ( [] === $encounter_seed ) {
			return new \WP_REST_Response( [ 'message' => 'Encounter seed not found.' ], 404 );
		}

		$filters = [
			'slot' => $slot,
			'encounter_seed_slug' => (string) ( $encounter_seed['slug'] ?? '' ),
			'stage' => sanitize_key( (string) ( $req->get_param( 'stage' ) ?: 'mid' ) ),
			'tension' => sanitize_key( (string) ( $req->get_param( 'tension' ) ?: 'rising' ) ),
			'stance' => sanitize_key( (string) ( $req->get_param( 'stance' ) ?: 'steady' ) ),
			'set_result' => sanitize_key( (string) ( $req->get_param( 'set_result' ) ?: 'target_met' ) ),
			'result_band' => sanitize_key( (string) ( $req->get_param( 'result_band' ) ?: 'victory' ) ),
			'progress_phase' => sanitize_key( (string) ( $req->get_param( 'progress_phase' ) ?: 'encounter' ) ),
		];

		$working_state = [
			'run_id' => 0,
			'story_profile' => is_array( $mission['story_profile'] ?? null ) ? $mission['story_profile'] : [],
			'story_engine' => [
				'recent_template_ids' => [],
				'recent_tags' => [],
				'recent_phrases' => [],
				'slot_counts' => [],
				'last_selected' => [],
				'variation_seed' => sanitize_text_field( sprintf( 'workbench-%s-%s', $mission_slug, $slot ) ),
			],
			'encounter_seed' => $encounter_seed,
			'scene_state' => [],
		];
		$approved_lookup = [];
		foreach ( self::get_story_workbench_approved_candidates( $mission_slug, $slot ) as $approved_candidate ) {
			$approved_lookup[ self::story_workbench_candidate_key( (array) ( $approved_candidate['candidate'] ?? [] ) ) ] = true;
		}
		$selection_diagnostics = self::build_story_workbench_selection_diagnostics( $mission, $filters, $working_state );
		$coverage_report = self::build_story_workbench_coverage_report( $mission, $filters, $working_state );

		$candidates = [];
		$current_user_id = max( 0, (int) get_current_user_id() );
		for ( $index = 0; $index < $count; $index++ ) {
			$request = IronQuestStoryEngineService::build_beat_request(
				[ 'mission_slug' => $mission_slug ],
				$working_state,
				$filters,
				$slot
			);
			$candidate = IronQuestStoryEngineService::select_candidate( $mission, $request, $working_state );
			if ( ! is_array( $candidate ) ) {
				break;
			}

			$rendered = IronQuestStoryEngineService::render_candidate( $candidate, $encounter_seed, [], $request );
			$ai_preview = IronQuestAiNarrativeService::build_story_workbench_branch_preview(
				$current_user_id,
				$mission,
				$encounter_seed,
				$request,
				(array) ( $rendered['draft'] ?? [] ),
				$candidate
			);
			if ( is_array( $ai_preview ) ) {
				$rendered['draft'] = [
					'summary' => sanitize_textarea_field( (string) ( $ai_preview['summary'] ?? $rendered['draft']['summary'] ?? '' ) ),
					'follow_up' => sanitize_textarea_field( (string) ( $ai_preview['follow_up'] ?? $rendered['draft']['follow_up'] ?? '' ) ),
					'decision_prompt' => sanitize_text_field( (string) ( $ai_preview['decision_prompt'] ?? $rendered['draft']['decision_prompt'] ?? '' ) ),
				];
				$rendered['debug_prompt'] = sanitize_textarea_field( (string) ( $ai_preview['debug_prompt'] ?? '' ) );
				$rendered['source'] = 'ai_scene_brief';
			}
			$working_state = IronQuestStoryEngineService::record_selection( $working_state, $candidate, $rendered );
			$candidate_payload = [
				'candidate_id' => sanitize_key( sprintf( 'draft_%d', $index + 1 ) ),
				'template_id' => sanitize_key( (string) ( $candidate['id'] ?? '' ) ),
				'tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $candidate['tags'] ?? [] ) ) ) ),
				'draft' => [
					'summary' => sanitize_textarea_field( (string) ( $rendered['draft']['summary'] ?? '' ) ),
					'follow_up' => sanitize_textarea_field( (string) ( $rendered['draft']['follow_up'] ?? '' ) ),
					'decision_prompt' => sanitize_text_field( (string) ( $rendered['draft']['decision_prompt'] ?? '' ) ),
				],
				'source' => sanitize_key( (string) ( $rendered['source'] ?? 'authored_template' ) ),
				'status' => 'unreviewed',
			];
			$candidate_payload['status'] = isset( $approved_lookup[ self::story_workbench_candidate_key( $candidate_payload ) ] ) ? 'approved' : 'unreviewed';
			$candidates[] = $candidate_payload;
		}

		$session_id = sanitize_key( sprintf( 'story_session_%s_%s_%s', $mission_slug, $slot, gmdate( 'YmdHis' ) ) );
		$session = [
			'session_id' => $session_id,
			'mission' => [
				'slug' => (string) ( $mission['slug'] ?? '' ),
				'name' => (string) ( $mission['name'] ?? '' ),
				'goal' => (string) ( $mission['goal'] ?? '' ),
				'location_slug' => (string) ( $mission['location_slug'] ?? '' ),
				'location_name' => (string) ( $location['name'] ?? '' ),
			],
			'filters' => $filters,
			'promptContext' => [
				'storyProfile' => (array) ( $mission['story_profile'] ?? [] ),
				'encounterSeed' => $encounter_seed,
				'recentTemplates' => (array) ( $working_state['story_engine']['recent_template_ids'] ?? [] ),
				'recentPhrases' => (array) ( $working_state['story_engine']['recent_phrases'] ?? [] ),
			],
			'candidateSession' => [
				'session_id' => $session_id,
				'status' => 'ready',
				'generated_at' => gmdate( 'c' ),
				'approved_count' => count( $approved_lookup ),
				'candidates' => $candidates,
			],
		];
		self::store_story_workbench_session( $session );

		return new \WP_REST_Response(
			[
				'mission' => $session['mission'],
				'filters' => $session['filters'],
				'promptContext' => $session['promptContext'],
				'candidateSession' => $session['candidateSession'],
				'selectionDiagnostics' => $selection_diagnostics,
				'coverageReport' => $coverage_report,
				'approvedCandidates' => self::get_story_workbench_approved_candidates( $mission_slug, $slot ),
			]
		);
	}

	public static function review_ironquest_story_workbench_candidate( \WP_REST_Request $req ): \WP_REST_Response {
		$session_id = sanitize_key( (string) ( $req->get_param( 'session_id' ) ?: '' ) );
		$candidate_id = sanitize_key( (string) ( $req->get_param( 'candidate_id' ) ?: '' ) );
		$approved = filter_var( $req->get_param( 'approved' ), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );

		if ( '' === $session_id || '' === $candidate_id ) {
			return new \WP_REST_Response( [ 'message' => 'session_id and candidate_id are required.' ], 400 );
		}

		$session = self::get_story_workbench_session( $session_id );
		if ( [] === $session ) {
			return new \WP_REST_Response( [ 'message' => 'Story workbench session not found.' ], 404 );
		}

		$candidate = self::find_story_workbench_candidate( $session, $candidate_id );
		if ( [] === $candidate ) {
			return new \WP_REST_Response( [ 'message' => 'Candidate not found in this session.' ], 404 );
		}

		$mission_slug = sanitize_key( (string) ( $session['mission']['slug'] ?? '' ) );
		$slot = sanitize_key( (string) ( $session['filters']['slot'] ?? '' ) );
		$approval_key = self::story_workbench_candidate_key( $candidate );
		$approvals = self::get_story_workbench_approval_store();

		if ( false === $approved ) {
			unset( $approvals[ $mission_slug ][ $slot ][ $approval_key ] );
			$message = 'Candidate approval removed.';
		} else {
			$approvals[ $mission_slug ][ $slot ][ $approval_key ] = self::sanitize_story_workbench_approval( [
				'mission_slug' => $mission_slug,
				'slot' => $slot,
				'encounter_seed_slug' => (string) ( $session['promptContext']['encounterSeed']['slug'] ?? '' ),
				'filters' => (array) ( $session['filters'] ?? [] ),
				'candidate' => $candidate,
				'approved_at' => gmdate( 'c' ),
				'session_id' => $session_id,
			] );
			$message = 'Candidate approved for export.';
		}

		self::store_story_workbench_approval_store( $approvals );

		$approved_candidates = self::get_story_workbench_approved_candidates( $mission_slug, $slot );
		$approved_candidate_lookup = [];
		foreach ( $approved_candidates as $approved_candidate ) {
			$approved_candidate_lookup[ self::story_workbench_candidate_key( (array) ( $approved_candidate['candidate'] ?? [] ) ) ] = true;
		}

		$session['candidateSession']['approved_count'] = count( $approved_candidates );
		$session['candidateSession']['candidates'] = array_values(
			array_map(
				static function ( array $session_candidate ) use ( $approved_candidate_lookup ): array {
					$session_candidate['status'] = isset( $approved_candidate_lookup[ self::story_workbench_candidate_key( $session_candidate ) ] ) ? 'approved' : 'unreviewed';
					return $session_candidate;
				},
				(array) ( $session['candidateSession']['candidates'] ?? [] )
			)
		);
		self::store_story_workbench_session( $session );

		return new \WP_REST_Response(
			[
				'message' => $message,
				'candidateSession' => $session['candidateSession'],
				'approvedCandidates' => $approved_candidates,
			]
		);
	}

	public static function export_ironquest_story_workbench( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$slot = sanitize_key( (string) ( $req->get_param( 'slot' ) ?: '' ) );

		if ( '' === $mission_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug is required.' ], 400 );
		}
		$export_payload = self::build_story_workbench_export_payload( $mission_slug, $slot );

		return new \WP_REST_Response(
			[
				'mission_slug' => $mission_slug,
				'slot' => $slot,
				'approved_count' => count( (array) ( $export_payload['beat_templates'] ?? [] ) ),
				'file_name' => sanitize_file_name( $mission_slug . ( '' !== $slot ? '-' . $slot : '' ) . '-story-workbench-export.json' ),
				'export' => $export_payload,
				'export_json' => wp_json_encode( $export_payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
			]
		);
	}

	public static function apply_ironquest_story_workbench_export( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$slot = sanitize_key( (string) ( $req->get_param( 'slot' ) ?: '' ) );

		if ( '' === $mission_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug is required.' ], 400 );
		}

		$export_payload = self::build_story_workbench_export_payload( $mission_slug, $slot );
		$beat_templates = array_values( array_filter( (array) ( $export_payload['beat_templates'] ?? [] ), 'is_array' ) );
		if ( [] === $beat_templates ) {
			return new \WP_REST_Response( [ 'message' => 'No approved story workbench candidates are ready to apply.' ], 400 );
		}

		$mission_config_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		if ( '' === $mission_config_path || ! file_exists( $mission_config_path ) || ! is_readable( $mission_config_path ) || ! is_writable( $mission_config_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json is not writable.' ], 500 );
		}

		$raw = file_get_contents( $mission_config_path );
		$decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! is_array( $decoded ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json could not be parsed.' ], 500 );
		}

		$missions = array_values( array_filter( (array) ( $decoded['missions'] ?? [] ), 'is_array' ) );
		$mission_index = null;
		foreach ( $missions as $index => $mission ) {
			if ( $mission_slug === sanitize_key( (string) ( $mission['slug'] ?? '' ) ) ) {
				$mission_index = $index;
				break;
			}
		}

		if ( null === $mission_index ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found in missions.json.' ], 404 );
		}

		$slots_to_replace = [];
		foreach ( $beat_templates as $template ) {
			$template_slot = sanitize_key( (string) ( $template['slot'] ?? '' ) );
			if ( '' !== $template_slot ) {
				$slots_to_replace[ $template_slot ] = true;
			}
		}

		$existing_templates = array_values( array_filter( (array) ( $missions[ $mission_index ]['beat_templates'] ?? [] ), 'is_array' ) );
		$preserved_templates = array_values(
			array_filter(
				$existing_templates,
				static function ( array $template ) use ( $slots_to_replace ): bool {
					$template_slot = sanitize_key( (string) ( $template['slot'] ?? '' ) );
					return '' === $template_slot || ! isset( $slots_to_replace[ $template_slot ] );
				}
			)
		);

		$missions[ $mission_index ]['beat_templates'] = array_values( array_merge( $preserved_templates, $beat_templates ) );
		$decoded['missions'] = $missions;

		$encoded = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $encoded ) || false === file_put_contents( $mission_config_path, $encoded . PHP_EOL ) ) {
			return new \WP_REST_Response( [ 'message' => 'Failed to write missions.json.' ], 500 );
		}

		IronQuestRegistryService::reset_cache();

		return new \WP_REST_Response(
			[
				'message' => sprintf( 'Applied %d story workbench %s to missions.json.', count( $beat_templates ), 1 === count( $beat_templates ) ? 'template' : 'templates' ),
				'mission_slug' => $mission_slug,
				'slot' => $slot,
				'applied_count' => count( $beat_templates ),
				'config_path' => $mission_config_path,
				'export' => $export_payload,
			]
		);
	}

	public static function save_ironquest_story_workbench_scene( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$encounter_seed_slug = sanitize_key( (string) ( $req->get_param( 'encounter_seed_slug' ) ?: '' ) );

		if ( '' === $mission_slug || '' === $encounter_seed_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug and encounter_seed_slug are required.' ], 400 );
		}

		$mission_config_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		if ( '' === $mission_config_path || ! file_exists( $mission_config_path ) || ! is_readable( $mission_config_path ) || ! is_writable( $mission_config_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json is not writable.' ], 500 );
		}

		$raw = file_get_contents( $mission_config_path );
		$decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! is_array( $decoded ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json could not be parsed.' ], 500 );
		}

		$missions = array_values( array_filter( (array) ( $decoded['missions'] ?? [] ), 'is_array' ) );
		$mission_index = null;
		foreach ( $missions as $index => $mission ) {
			if ( $mission_slug === sanitize_key( (string) ( $mission['slug'] ?? '' ) ) ) {
				$mission_index = $index;
				break;
			}
		}

		if ( null === $mission_index ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found in missions.json.' ], 404 );
		}

		$encounter_seeds = array_values( array_filter( (array) ( $missions[ $mission_index ]['encounter_seeds'] ?? [] ), 'is_array' ) );
		$seed_index = null;
		foreach ( $encounter_seeds as $index => $seed ) {
			if ( $encounter_seed_slug === sanitize_key( (string) ( $seed['slug'] ?? '' ) ) ) {
				$seed_index = $index;
				break;
			}
		}

		if ( null === $seed_index ) {
			return new \WP_REST_Response( [ 'message' => 'Encounter seed not found in missions.json.' ], 404 );
		}

		$scene_fields = self::sanitize_story_workbench_scene_fields( (array) ( $req->get_param( 'scene' ) ?? [] ) );
		foreach ( $scene_fields as $key => $value ) {
			$encounter_seeds[ $seed_index ][ $key ] = $value;
		}
		$missions[ $mission_index ]['encounter_seeds'] = $encounter_seeds;
		$decoded['missions'] = $missions;

		$encoded = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $encoded ) || false === file_put_contents( $mission_config_path, $encoded . PHP_EOL ) ) {
			return new \WP_REST_Response( [ 'message' => 'Failed to write missions.json.' ], 500 );
		}

		IronQuestRegistryService::reset_cache();

		return new \WP_REST_Response(
			[
				'message' => 'Scene brief saved to missions.json.',
				'mission_slug' => $mission_slug,
				'encounter_seed_slug' => $encounter_seed_slug,
				'scene' => $scene_fields,
			]
		);
	}

	public static function suggest_ironquest_story_workbench_scene( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$encounter_seed_slug = sanitize_key( (string) ( $req->get_param( 'encounter_seed_slug' ) ?: '' ) );

		if ( '' === $mission_slug || '' === $encounter_seed_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug and encounter_seed_slug are required.' ], 400 );
		}

		$mission = self::find_ironquest_mission( $mission_slug );
		if ( [] === $mission ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found.' ], 404 );
		}

		$encounter_seed = self::find_encounter_seed( $mission, $encounter_seed_slug );
		if ( [] === $encounter_seed ) {
			return new \WP_REST_Response( [ 'message' => 'Encounter seed not found.' ], 404 );
		}

		$suggested = IronQuestAiNarrativeService::build_story_workbench_scene_fields(
			max( 0, (int) get_current_user_id() ),
			$mission,
			$encounter_seed
		);

		if ( is_wp_error( $suggested ) ) {
			return new \WP_REST_Response( [ 'message' => $suggested->get_error_message() ], 500 );
		}

		return new \WP_REST_Response(
			[
				'mission_slug' => $mission_slug,
				'encounter_seed_slug' => $encounter_seed_slug,
				'scene' => self::sanitize_story_workbench_scene_fields( (array) $suggested ),
				'debug_prompt' => sanitize_textarea_field( (string) ( $suggested['debug_prompt'] ?? '' ) ),
			]
		);
	}

	public static function save_ironquest_story_workbench_location( \WP_REST_Request $req ): \WP_REST_Response {
		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: '' ) );

		if ( '' === $location_slug ) {
			return new \WP_REST_Response( [ 'message' => 'location_slug is required.' ], 400 );
		}

		$location_config_path = IronQuestRegistryService::get_config_file_path( 'locations.json' );
		if ( '' === $location_config_path || ! file_exists( $location_config_path ) || ! is_readable( $location_config_path ) || ! is_writable( $location_config_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'locations.json is not writable.' ], 500 );
		}

		$raw = file_get_contents( $location_config_path );
		$decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! is_array( $decoded ) ) {
			return new \WP_REST_Response( [ 'message' => 'locations.json could not be parsed.' ], 500 );
		}

		$locations = array_values( array_filter( (array) ( $decoded['locations'] ?? [] ), 'is_array' ) );
		$location_index = null;
		foreach ( $locations as $index => $location ) {
			if ( $location_slug === sanitize_key( (string) ( $location['slug'] ?? '' ) ) ) {
				$location_index = $index;
				break;
			}
		}

		if ( null === $location_index ) {
			return new \WP_REST_Response( [ 'message' => 'Location not found in locations.json.' ], 404 );
		}

		$foundation = self::sanitize_story_workbench_location_foundation( (array) ( $req->get_param( 'location' ) ?? [] ) );
		$locations[ $location_index ]['theme'] = $foundation['theme'];
		$locations[ $location_index ]['tone'] = $foundation['tone'];
		$locations[ $location_index ]['story_context'] = $foundation['story_context'];
		$anchor = is_array( $locations[ $location_index ]['ai_prompt_anchor'] ?? null ) ? $locations[ $location_index ]['ai_prompt_anchor'] : [];
		$anchor['theme'] = $foundation['ai_theme'];
		$anchor['tone'] = $foundation['ai_tone'];
		$anchor['enemy_types'] = $foundation['enemy_types'];
		$locations[ $location_index ]['ai_prompt_anchor'] = $anchor;
		$decoded['locations'] = $locations;

		$encoded = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $encoded ) || false === file_put_contents( $location_config_path, $encoded . PHP_EOL ) ) {
			return new \WP_REST_Response( [ 'message' => 'Failed to write locations.json.' ], 500 );
		}

		IronQuestRegistryService::reset_cache();

		return new \WP_REST_Response(
			[
				'message' => 'Location foundation saved to locations.json.',
				'location_slug' => $location_slug,
				'location' => $foundation,
			]
		);
	}

	public static function suggest_ironquest_story_workbench_location( \WP_REST_Request $req ): \WP_REST_Response {
		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: '' ) );
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );

		if ( '' === $location_slug ) {
			return new \WP_REST_Response( [ 'message' => 'location_slug is required.' ], 400 );
		}

		$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		if ( [] === $location ) {
			return new \WP_REST_Response( [ 'message' => 'Location not found.' ], 404 );
		}

		$mission = '' !== $mission_slug ? self::find_ironquest_mission( $mission_slug ) : [];

		$suggested = IronQuestAiNarrativeService::build_story_workbench_location_foundation(
			max( 0, (int) get_current_user_id() ),
			$location,
			$mission
		);

		if ( is_wp_error( $suggested ) ) {
			return new \WP_REST_Response( [ 'message' => $suggested->get_error_message() ], 500 );
		}

		return new \WP_REST_Response(
			[
				'location_slug' => $location_slug,
				'mission_slug' => $mission_slug,
				'location' => self::sanitize_story_workbench_location_foundation( (array) $suggested ),
				'debug_prompt' => sanitize_textarea_field( (string) ( $suggested['debug_prompt'] ?? '' ) ),
			]
		);
	}

	public static function save_ironquest_story_workbench_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );

		if ( '' === $mission_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug is required.' ], 400 );
		}

		$mission_config_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		if ( '' === $mission_config_path || ! file_exists( $mission_config_path ) || ! is_readable( $mission_config_path ) || ! is_writable( $mission_config_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json is not writable.' ], 500 );
		}

		$raw = file_get_contents( $mission_config_path );
		$decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! is_array( $decoded ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json could not be parsed.' ], 500 );
		}

		$missions = array_values( array_filter( (array) ( $decoded['missions'] ?? [] ), 'is_array' ) );
		$mission_index = null;
		foreach ( $missions as $index => $mission ) {
			if ( $mission_slug === sanitize_key( (string) ( $mission['slug'] ?? '' ) ) ) {
				$mission_index = $index;
				break;
			}
		}

		if ( null === $mission_index ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found in missions.json.' ], 404 );
		}

		$foundation = self::sanitize_story_workbench_mission_foundation( (array) ( $req->get_param( 'mission' ) ?? [] ) );
		$missions[ $mission_index ]['goal'] = $foundation['goal'];
		$missions[ $mission_index ]['threat'] = $foundation['threat'];
		$missions[ $mission_index ]['narrative'] = $foundation['narrative'];
		$missions[ $mission_index ]['workout_feel'] = $foundation['workout_feel'];
		$story_profile = is_array( $missions[ $mission_index ]['story_profile'] ?? null ) ? $missions[ $mission_index ]['story_profile'] : [];
		$story_profile['genre'] = $foundation['story_profile']['genre'];
		$story_profile['voice'] = $foundation['story_profile']['voice'];
		$story_profile['pacing'] = $foundation['story_profile']['pacing'];
		$missions[ $mission_index ]['story_profile'] = $story_profile;
		$decoded['missions'] = $missions;

		$encoded = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $encoded ) || false === file_put_contents( $mission_config_path, $encoded . PHP_EOL ) ) {
			return new \WP_REST_Response( [ 'message' => 'Failed to write missions.json.' ], 500 );
		}

		IronQuestRegistryService::reset_cache();

		return new \WP_REST_Response(
			[
				'message' => 'Mission foundation saved to missions.json.',
				'mission_slug' => $mission_slug,
				'mission' => $foundation,
			]
		);
	}

	public static function suggest_ironquest_story_workbench_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );

		if ( '' === $mission_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug is required.' ], 400 );
		}

		$mission = self::find_ironquest_mission( $mission_slug );
		if ( [] === $mission ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found.' ], 404 );
		}

		$location = IronQuestRegistryService::get_location( (string) ( $mission['location_slug'] ?? '' ) ) ?? [];

		$suggested = IronQuestAiNarrativeService::build_story_workbench_mission_foundation(
			max( 0, (int) get_current_user_id() ),
			$location,
			$mission
		);

		if ( is_wp_error( $suggested ) ) {
			return new \WP_REST_Response( [ 'message' => $suggested->get_error_message() ], 500 );
		}

		return new \WP_REST_Response(
			[
				'mission_slug' => $mission_slug,
				'mission' => self::sanitize_story_workbench_mission_foundation( (array) $suggested ),
				'debug_prompt' => sanitize_textarea_field( (string) ( $suggested['debug_prompt'] ?? '' ) ),
			]
		);
	}

	public static function bootstrap_ironquest_story_workbench_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$mission_slug = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		if ( '' === $mission_slug ) {
			return new \WP_REST_Response( [ 'message' => 'mission_slug is required.' ], 400 );
		}

		$mission_config_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		if ( '' === $mission_config_path || ! file_exists( $mission_config_path ) || ! is_readable( $mission_config_path ) || ! is_writable( $mission_config_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json is not writable.' ], 500 );
		}

		$raw = file_get_contents( $mission_config_path );
		$decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! is_array( $decoded ) ) {
			return new \WP_REST_Response( [ 'message' => 'missions.json could not be parsed.' ], 500 );
		}

		$missions = array_values( array_filter( (array) ( $decoded['missions'] ?? [] ), 'is_array' ) );
		$mission_index = null;
		foreach ( $missions as $index => $mission ) {
			if ( $mission_slug === sanitize_key( (string) ( $mission['slug'] ?? '' ) ) ) {
				$mission_index = $index;
				break;
			}
		}

		if ( null === $mission_index ) {
			return new \WP_REST_Response( [ 'message' => 'Mission not found in missions.json.' ], 404 );
		}

		$mission = $missions[ $mission_index ];
		$existing_story_profile = is_array( $mission['story_profile'] ?? null ) ? $mission['story_profile'] : [];
		$existing_story_slots = is_array( $mission['story_slots'] ?? null ) ? $mission['story_slots'] : [];
		$existing_beat_templates = array_values( array_filter( (array) ( $mission['beat_templates'] ?? [] ), 'is_array' ) );

		if ( [] === $existing_story_profile ) {
			$mission['story_profile'] = self::build_story_workbench_bootstrap_story_profile();
		}
		if ( [] === $existing_story_slots ) {
			$mission['story_slots'] = self::build_story_workbench_bootstrap_story_slots();
		}
		if ( [] === $existing_beat_templates ) {
			$mission['beat_templates'] = self::build_story_workbench_bootstrap_templates( $mission_slug );
		}

		$missions[ $mission_index ] = $mission;
		$decoded['missions'] = $missions;

		$encoded = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $encoded ) || false === file_put_contents( $mission_config_path, $encoded . PHP_EOL ) ) {
			return new \WP_REST_Response( [ 'message' => 'Failed to write missions.json.' ], 500 );
		}

		IronQuestRegistryService::reset_cache();

		return new \WP_REST_Response(
			[
				'message' => 'Mission bootstrapped for the story workbench.',
				'mission_slug' => $mission_slug,
				'story_slot_count' => count( (array) ( $mission['story_slots'] ?? [] ) ),
				'beat_template_count' => count( (array) ( $mission['beat_templates'] ?? [] ) ),
			]
		);
	}

	private static function build_story_workbench_export_payload( string $mission_slug, string $slot ): array {
		$mission_slug = sanitize_key( $mission_slug );
		$slot = sanitize_key( $slot );

		$approvals = self::get_story_workbench_approval_store();
		$mission_approvals = is_array( $approvals[ $mission_slug ] ?? null ) ? $approvals[ $mission_slug ] : [];
		if ( '' !== $slot ) {
			$mission_approvals = isset( $mission_approvals[ $slot ] ) ? [ $slot => $mission_approvals[ $slot ] ] : [];
		}

		$beat_templates = [];
		foreach ( $mission_approvals as $slot_key => $slot_candidates ) {
			$position = 0;
			foreach ( (array) $slot_candidates as $approved_candidate ) {
				$position++;
				$template = self::build_story_workbench_export_template( $mission_slug, sanitize_key( (string) $slot_key ), (array) $approved_candidate, $position );
				if ( [] !== $template ) {
					$beat_templates[] = $template;
				}
			}
		}

		return [
			'mission_slug' => $mission_slug,
			'beat_templates' => $beat_templates,
		];
	}

	private static function build_story_workbench_selection_diagnostics( array $mission, array $filters, array $story_state ): array {
		$slot = sanitize_key( (string) ( $filters['slot'] ?? '' ) );
		$slot_templates = array_values(
			array_filter(
				(array) ( $mission['beat_templates'] ?? [] ),
				static fn( array $template ): bool => $slot === sanitize_key( (string) ( $template['slot'] ?? '' ) )
			)
		);
		$matching_candidates = IronQuestStoryEngineService::list_matching_candidates( $mission, $filters, $story_state );

		return [
			'slot_template_count' => count( $slot_templates ),
			'matching_template_ids' => array_values(
				array_filter(
					array_map(
						static fn( array $template ): string => sanitize_key( (string) ( $template['id'] ?? '' ) ),
						$matching_candidates
					)
				)
			),
		];
	}

	private static function build_story_workbench_coverage_report( array $mission, array $filters, array $story_state ): array {
		$rows = [];
		foreach ( self::story_workbench_coverage_set_result_options() as $set_result => $label ) {
			$cells = [];
			foreach ( self::story_workbench_coverage_stance_options() as $stance => $stance_label ) {
				$request = $filters;
				$request['set_result'] = $set_result;
				$request['stance'] = $stance;
				$candidates = IronQuestStoryEngineService::list_matching_candidates( $mission, $request, $story_state );
				$top_candidate = is_array( $candidates[0] ?? null ) ? $candidates[0] : [];
				$cells[] = [
					'stance' => $stance,
					'stance_label' => $stance_label,
					'template_id' => sanitize_key( (string) ( $top_candidate['id'] ?? '' ) ),
				];
			}

			$rows[] = [
				'set_result' => $set_result,
				'set_result_label' => $label,
				'cells' => $cells,
			];
		}

		return [
			'stances' => self::story_workbench_coverage_stance_options(),
			'rows' => $rows,
		];
	}

	private static function find_ironquest_mission( string $mission_slug ): array {
		$mission_slug = sanitize_key( $mission_slug );
		foreach ( (array) ( IronQuestRegistryService::get_missions_config()['missions'] ?? [] ) as $mission ) {
			if ( $mission_slug === sanitize_key( (string) ( $mission['slug'] ?? '' ) ) ) {
				return (array) $mission;
			}
		}

		return [];
	}

	private static function find_encounter_seed( array $mission, string $encounter_seed_slug ): array {
		$seeds = array_values( array_filter( (array) ( $mission['encounter_seeds'] ?? [] ), 'is_array' ) );
		if ( [] === $seeds ) {
			return [];
		}

		$encounter_seed_slug = sanitize_key( $encounter_seed_slug );
		if ( '' === $encounter_seed_slug ) {
			return (array) $seeds[0];
		}

		foreach ( $seeds as $seed ) {
			if ( $encounter_seed_slug === sanitize_key( (string) ( $seed['slug'] ?? '' ) ) ) {
				return (array) $seed;
			}
		}

		return [];
	}

	private static function store_story_workbench_session( array $session ): void {
		$session_id = sanitize_key( (string) ( $session['session_id'] ?? '' ) );
		if ( '' === $session_id ) {
			return;
		}

		$sessions = self::get_story_workbench_sessions();
		$sessions[ $session_id ] = self::sanitize_story_workbench_session( $session );
		$sessions = array_slice( $sessions, -1 * self::IRONQUEST_STORY_WORKBENCH_SESSION_LIMIT, null, true );
		update_option( self::IRONQUEST_STORY_WORKBENCH_SESSIONS_OPTION, $sessions, false );
	}

	private static function get_story_workbench_session( string $session_id ): array {
		$session_id = sanitize_key( $session_id );
		if ( '' === $session_id ) {
			return [];
		}

		$sessions = self::get_story_workbench_sessions();

		return is_array( $sessions[ $session_id ] ?? null ) ? $sessions[ $session_id ] : [];
	}

	private static function get_story_workbench_sessions(): array {
		$value = get_option( self::IRONQUEST_STORY_WORKBENCH_SESSIONS_OPTION, [] );
		if ( ! is_array( $value ) ) {
			return [];
		}

		$clean = [];
		foreach ( $value as $session_id => $session ) {
			$session_id = sanitize_key( (string) $session_id );
			if ( '' === $session_id || ! is_array( $session ) ) {
				continue;
			}

			$clean[ $session_id ] = self::sanitize_story_workbench_session( $session );
		}

		return $clean;
	}

	private static function sanitize_story_workbench_session( array $session ): array {
		$candidates = [];
		foreach ( (array) ( $session['candidateSession']['candidates'] ?? [] ) as $candidate ) {
			if ( ! is_array( $candidate ) ) {
				continue;
			}

			$candidates[] = self::sanitize_story_workbench_candidate( $candidate );
		}

		return [
			'session_id' => sanitize_key( (string) ( $session['session_id'] ?? $session['candidateSession']['session_id'] ?? '' ) ),
			'mission' => [
				'slug' => sanitize_key( (string) ( $session['mission']['slug'] ?? '' ) ),
				'name' => sanitize_text_field( (string) ( $session['mission']['name'] ?? '' ) ),
				'goal' => sanitize_text_field( (string) ( $session['mission']['goal'] ?? '' ) ),
				'location_slug' => sanitize_key( (string) ( $session['mission']['location_slug'] ?? '' ) ),
				'location_name' => sanitize_text_field( (string) ( $session['mission']['location_name'] ?? '' ) ),
			],
			'filters' => self::sanitize_story_workbench_filters( (array) ( $session['filters'] ?? [] ) ),
			'promptContext' => [
				'storyProfile' => self::sanitize_story_workbench_struct( (array) ( $session['promptContext']['storyProfile'] ?? [] ) ),
				'encounterSeed' => self::sanitize_story_workbench_struct( (array) ( $session['promptContext']['encounterSeed'] ?? [] ) ),
				'recentTemplates' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $session['promptContext']['recentTemplates'] ?? [] ) ) ) ),
				'recentPhrases' => array_values( array_filter( array_map( 'sanitize_textarea_field', (array) ( $session['promptContext']['recentPhrases'] ?? [] ) ) ) ),
			],
			'candidateSession' => [
				'session_id' => sanitize_key( (string) ( $session['candidateSession']['session_id'] ?? $session['session_id'] ?? '' ) ),
				'status' => sanitize_key( (string) ( $session['candidateSession']['status'] ?? 'ready' ) ),
				'generated_at' => sanitize_text_field( (string) ( $session['candidateSession']['generated_at'] ?? '' ) ),
				'approved_count' => max( 0, (int) ( $session['candidateSession']['approved_count'] ?? 0 ) ),
				'candidates' => $candidates,
			],
		];
	}

	private static function sanitize_story_workbench_filters( array $filters ): array {
		return [
			'slot' => sanitize_key( (string) ( $filters['slot'] ?? '' ) ),
			'encounter_seed_slug' => sanitize_key( (string) ( $filters['encounter_seed_slug'] ?? '' ) ),
			'stage' => sanitize_key( (string) ( $filters['stage'] ?? '' ) ),
			'tension' => sanitize_key( (string) ( $filters['tension'] ?? '' ) ),
			'stance' => sanitize_key( (string) ( $filters['stance'] ?? '' ) ),
			'set_result' => sanitize_key( (string) ( $filters['set_result'] ?? '' ) ),
			'result_band' => sanitize_key( (string) ( $filters['result_band'] ?? '' ) ),
			'progress_phase' => sanitize_key( (string) ( $filters['progress_phase'] ?? '' ) ),
		];
	}

	private static function sanitize_story_workbench_candidate( array $candidate ): array {
		return [
			'candidate_id' => sanitize_key( (string) ( $candidate['candidate_id'] ?? '' ) ),
			'template_id' => sanitize_key( (string) ( $candidate['template_id'] ?? '' ) ),
			'tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $candidate['tags'] ?? [] ) ) ) ),
			'draft' => [
				'summary' => sanitize_textarea_field( (string) ( $candidate['draft']['summary'] ?? '' ) ),
				'follow_up' => sanitize_textarea_field( (string) ( $candidate['draft']['follow_up'] ?? '' ) ),
				'decision_prompt' => sanitize_text_field( (string) ( $candidate['draft']['decision_prompt'] ?? '' ) ),
			],
			'source' => sanitize_key( (string) ( $candidate['source'] ?? 'authored_template' ) ),
			'status' => sanitize_key( (string) ( $candidate['status'] ?? 'unreviewed' ) ),
		];
	}

	private static function sanitize_story_workbench_struct( array $data ): array {
		$clean = [];
		foreach ( $data as $key => $value ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key || is_array( $value ) ) {
				continue;
			}

			if ( is_numeric( $value ) ) {
				$clean[ $key ] = $value + 0;
				continue;
			}

			$clean[ $key ] = sanitize_text_field( (string) $value );
		}

		return $clean;
	}

	private static function sanitize_story_workbench_scene_fields( array $scene ): array {
		return [
			'scene_brief' => sanitize_textarea_field( (string) ( $scene['scene_brief'] ?? '' ) ),
			'player_goal' => sanitize_textarea_field( (string) ( $scene['player_goal'] ?? '' ) ),
			'opponent_pressure' => sanitize_textarea_field( (string) ( $scene['opponent_pressure'] ?? '' ) ),
			'failure_cost' => sanitize_textarea_field( (string) ( $scene['failure_cost'] ?? '' ) ),
			'setting_detail' => sanitize_textarea_field( (string) ( $scene['setting_detail'] ?? '' ) ),
		];
	}

	private static function sanitize_story_workbench_location_foundation( array $location ): array {
		$enemy_types = [];
		foreach ( (array) ( $location['enemy_types'] ?? [] ) as $enemy_type ) {
			$value = sanitize_text_field( (string) $enemy_type );
			if ( '' !== $value ) {
				$enemy_types[] = $value;
			}
		}

		return [
			'theme' => sanitize_text_field( (string) ( $location['theme'] ?? '' ) ),
			'tone' => sanitize_text_field( (string) ( $location['tone'] ?? '' ) ),
			'story_context' => sanitize_textarea_field( (string) ( $location['story_context'] ?? '' ) ),
			'ai_theme' => sanitize_text_field( (string) ( $location['ai_theme'] ?? '' ) ),
			'ai_tone' => sanitize_text_field( (string) ( $location['ai_tone'] ?? '' ) ),
			'enemy_types' => array_values( array_slice( $enemy_types, 0, 8 ) ),
		];
	}

	private static function sanitize_story_workbench_mission_foundation( array $mission ): array {
		return [
			'goal' => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
			'threat' => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
			'narrative' => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
			'workout_feel' => sanitize_text_field( (string) ( $mission['workout_feel'] ?? '' ) ),
			'story_profile' => [
				'genre' => sanitize_key( (string) ( $mission['story_profile']['genre'] ?? $mission['genre'] ?? '' ) ),
				'voice' => sanitize_key( (string) ( $mission['story_profile']['voice'] ?? $mission['voice'] ?? '' ) ),
				'pacing' => sanitize_key( (string) ( $mission['story_profile']['pacing'] ?? $mission['pacing'] ?? '' ) ),
			],
		];
	}

	private static function build_story_workbench_bootstrap_story_profile(): array {
		return [
			'genre' => 'mission_fantasy',
			'voice' => 'grounded_heroic',
			'pacing' => 'steady_pressure',
			'repetition_window' => 6,
			'stance_bias' => [
				'steady' => [ 'control', 'advance' ],
				'aggressive' => [ 'pressure', 'defiance' ],
				'cautious' => [ 'recovery', 'control' ],
			],
			'banned_terms' => [ 'bench press', 'rep', 'set' ],
			'allowed_mechanics_mentions' => [ 'hp_loss_this_set', 'roll_band', 'set_result' ],
		];
	}

	private static function build_story_workbench_bootstrap_story_slots(): array {
		return [
			'set_progression' => [
				'count_target' => 12,
				'notes' => 'Bootstrapped slot for between-set progression beats.',
			],
			'transition_setup' => [
				'count_target' => 6,
				'notes' => 'Bootstrapped slot for carrying story continuity into the next encounter.',
			],
		];
	}

	private static function build_story_workbench_bootstrap_templates( string $mission_slug ): array {
		$mission_slug = sanitize_key( $mission_slug );

		return [
			[
				'id' => sanitize_key( $mission_slug . '_progression_control_01' ),
				'slot' => 'set_progression',
				'tags' => [ 'advance', 'control', 'steady' ],
				'weight' => 4,
				'conditions' => [
					'set_result' => [ 'target_met', 'recovered' ],
				],
				'tokens_required' => [ 'success_turn', 'enemy_posture' ],
				'skeleton' => [
					'summary' => '{success_turn}',
					'follow_up' => '{enemy_posture}',
					'decision_prompt' => 'Press the opening before the scene can settle against you.',
				],
			],
			[
				'id' => sanitize_key( $mission_slug . '_progression_pressure_01' ),
				'slot' => 'set_progression',
				'tags' => [ 'pressure', 'recovery', 'cautious' ],
				'weight' => 3,
				'conditions' => [
					'set_result' => [ 'close_call', 'slipped' ],
				],
				'tokens_required' => [ 'pressure', 'hazard' ],
				'skeleton' => [
					'summary' => '{pressure}',
					'follow_up' => '{hazard}',
					'decision_prompt' => 'Settle the next answer before the pressure hardens into a loss.',
				],
			],
			[
				'id' => sanitize_key( $mission_slug . '_progression_crisis_01' ),
				'slot' => 'set_progression',
				'tags' => [ 'crisis', 'defiance', 'aggressive' ],
				'weight' => 2,
				'conditions' => [
					'set_result' => [ 'strain', 'struggle' ],
				],
				'tokens_required' => [ 'crisis_turn', 'stakes' ],
				'skeleton' => [
					'summary' => '{crisis_turn}',
					'follow_up' => '{stakes}',
					'decision_prompt' => 'Hold the next exchange together before the whole scene turns on you.',
				],
			],
			[
				'id' => sanitize_key( $mission_slug . '_transition_control_01' ),
				'slot' => 'transition_setup',
				'tags' => [ 'transition', 'control', 'steady' ],
				'weight' => 3,
				'conditions' => [
					'set_result' => [ 'target_met', 'recovered' ],
				],
				'tokens_required' => [ 'transition', 'landmark' ],
				'skeleton' => [
					'summary' => '{transition}',
					'follow_up' => 'The next ground is {landmark}.',
					'decision_prompt' => 'Move before the next scene decides itself without you.',
				],
			],
			[
				'id' => sanitize_key( $mission_slug . '_transition_pressure_01' ),
				'slot' => 'transition_setup',
				'tags' => [ 'transition', 'pressure', 'cautious' ],
				'weight' => 2,
				'conditions' => [
					'set_result' => [ 'close_call', 'slipped', 'strain', 'struggle' ],
				],
				'tokens_required' => [ 'transition', 'stakes' ],
				'skeleton' => [
					'summary' => '{transition}',
					'follow_up' => '{stakes}',
					'decision_prompt' => 'Choose the next step before the danger closes fully around it.',
				],
			],
		];
	}

	private static function find_story_workbench_candidate( array $session, string $candidate_id ): array {
		$candidate_id = sanitize_key( $candidate_id );
		foreach ( (array) ( $session['candidateSession']['candidates'] ?? [] ) as $candidate ) {
			if ( $candidate_id === sanitize_key( (string) ( $candidate['candidate_id'] ?? '' ) ) ) {
				return self::sanitize_story_workbench_candidate( (array) $candidate );
			}
		}

		return [];
	}

	private static function story_workbench_candidate_key( array $candidate ): string {
		$key = sanitize_key( (string) ( $candidate['template_id'] ?? '' ) );
		if ( '' !== $key ) {
			return $key;
		}

		return sanitize_key( (string) ( $candidate['candidate_id'] ?? '' ) );
	}

	private static function get_story_workbench_approval_store(): array {
		$value = get_option( self::IRONQUEST_STORY_WORKBENCH_APPROVALS_OPTION, [] );
		if ( ! is_array( $value ) ) {
			return [];
		}

		$clean = [];
		foreach ( $value as $mission_slug => $mission_approvals ) {
			$mission_slug = sanitize_key( (string) $mission_slug );
			if ( '' === $mission_slug || ! is_array( $mission_approvals ) ) {
				continue;
			}

			foreach ( $mission_approvals as $slot => $slot_approvals ) {
				$slot = sanitize_key( (string) $slot );
				if ( '' === $slot || ! is_array( $slot_approvals ) ) {
					continue;
				}

				foreach ( $slot_approvals as $approval_key => $approval ) {
					$approval_key = sanitize_key( (string) $approval_key );
					if ( '' === $approval_key || ! is_array( $approval ) ) {
						continue;
					}

					$clean[ $mission_slug ][ $slot ][ $approval_key ] = self::sanitize_story_workbench_approval( $approval );
				}
			}
		}

		return $clean;
	}

	private static function store_story_workbench_approval_store( array $approvals ): void {
		update_option( self::IRONQUEST_STORY_WORKBENCH_APPROVALS_OPTION, self::get_sanitized_story_workbench_approval_store( $approvals ), false );
	}

	private static function get_sanitized_story_workbench_approval_store( array $approvals ): array {
		$clean = [];
		foreach ( $approvals as $mission_slug => $mission_approvals ) {
			$mission_slug = sanitize_key( (string) $mission_slug );
			if ( '' === $mission_slug || ! is_array( $mission_approvals ) ) {
				continue;
			}

			foreach ( $mission_approvals as $slot => $slot_approvals ) {
				$slot = sanitize_key( (string) $slot );
				if ( '' === $slot || ! is_array( $slot_approvals ) ) {
					continue;
				}

				foreach ( $slot_approvals as $approval_key => $approval ) {
					$approval_key = sanitize_key( (string) $approval_key );
					if ( '' === $approval_key || ! is_array( $approval ) ) {
						continue;
					}

					$clean[ $mission_slug ][ $slot ][ $approval_key ] = self::sanitize_story_workbench_approval( $approval );
				}
			}
		}

		return $clean;
	}

	private static function sanitize_story_workbench_approval( array $approval ): array {
		return [
			'mission_slug' => sanitize_key( (string) ( $approval['mission_slug'] ?? '' ) ),
			'slot' => sanitize_key( (string) ( $approval['slot'] ?? '' ) ),
			'encounter_seed_slug' => sanitize_key( (string) ( $approval['encounter_seed_slug'] ?? '' ) ),
			'filters' => self::sanitize_story_workbench_filters( (array) ( $approval['filters'] ?? [] ) ),
			'candidate' => self::sanitize_story_workbench_candidate( (array) ( $approval['candidate'] ?? [] ) ),
			'approved_at' => sanitize_text_field( (string) ( $approval['approved_at'] ?? '' ) ),
			'session_id' => sanitize_key( (string) ( $approval['session_id'] ?? '' ) ),
		];
	}

	private static function get_story_workbench_approved_candidates( string $mission_slug, string $slot ): array {
		$approvals = self::get_story_workbench_approval_store();
		$mission_slug = sanitize_key( $mission_slug );
		$slot = sanitize_key( $slot );

		return array_values( is_array( $approvals[ $mission_slug ][ $slot ] ?? null ) ? $approvals[ $mission_slug ][ $slot ] : [] );
	}

	private static function build_story_workbench_export_template( string $mission_slug, string $slot, array $approved_candidate, int $position ): array {
		$candidate = self::sanitize_story_workbench_candidate( (array) ( $approved_candidate['candidate'] ?? [] ) );
		if ( '' === (string) ( $candidate['draft']['summary'] ?? '' ) ) {
			return [];
		}

		$filters = self::sanitize_story_workbench_filters( (array) ( $approved_candidate['filters'] ?? [] ) );
		$encounter_seed_slug = sanitize_key( (string) ( $approved_candidate['encounter_seed_slug'] ?? '' ) );
		$conditions = [];
		if ( '' !== $encounter_seed_slug ) {
			$conditions['encounter_seed_slug'] = [ $encounter_seed_slug ];
		}
		if ( '' !== (string) ( $filters['set_result'] ?? '' ) ) {
			$conditions['set_result'] = [ (string) $filters['set_result'] ];
		}
		if ( '' !== (string) ( $filters['stance'] ?? '' ) ) {
			$conditions['stance'] = [ (string) $filters['stance'] ];
		}

		$template_id = sanitize_key(
			sprintf(
				'%s_%s_%s_%02d',
				$mission_slug,
				$slot,
				'' !== $encounter_seed_slug ? $encounter_seed_slug : 'draft',
				$position
			)
		);

		return [
			'id' => $template_id,
			'slot' => $slot,
			'tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $candidate['tags'] ?? [] ) ) ) ),
			'weight' => 1,
			'conditions' => $conditions,
			'skeleton' => [
				'summary' => sanitize_textarea_field( (string) ( $candidate['draft']['summary'] ?? '' ) ),
				'follow_up' => sanitize_textarea_field( (string) ( $candidate['draft']['follow_up'] ?? '' ) ),
				'decision_prompt' => sanitize_text_field( (string) ( $candidate['draft']['decision_prompt'] ?? '' ) ),
			],
		];
	}

	private static function story_workbench_coverage_set_result_options(): array {
		return [
			'target_met' => 'Target met',
			'recovered' => 'Recovered',
			'close_call' => 'Close call',
			'slipped' => 'Slipped',
			'strain' => 'Strain',
			'struggle' => 'Struggle',
		];
	}

	private static function story_workbench_coverage_stance_options(): array {
		return [
			'steady' => 'Steady',
			'aggressive' => 'Aggressive',
			'cautious' => 'Cautious',
		];
	}

	public static function list_exercises( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT id, slug, name, description, movement_pattern, primary_muscle, secondary_muscles_json,
			        equipment, difficulty, age_friendliness_score, joint_stress_score, spinal_load_score,
			        default_rep_min, default_rep_max, default_sets, default_progression_type,
			        coaching_cues_json, day_types_json, slot_types_json, active
			 FROM {$wpdb->prefix}fit_exercises
			 ORDER BY active DESC, name ASC"
		);

		$rows = array_map( [ __CLASS__, 'normalise_exercise_admin_row' ], $rows );

		return new \WP_REST_Response( $rows );
	}

	public static function save_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$id = (int) $req->get_param( 'id' );
		$data = [
			'slug'                     => sanitize_title( (string) $req->get_param( 'slug' ) ?: (string) $req->get_param( 'name' ) ),
			'name'                     => sanitize_text_field( (string) $req->get_param( 'name' ) ),
			'description'              => sanitize_textarea_field( (string) $req->get_param( 'description' ) ),
			'movement_pattern'         => sanitize_text_field( (string) $req->get_param( 'movement_pattern' ) ),
			'primary_muscle'           => sanitize_text_field( (string) $req->get_param( 'primary_muscle' ) ),
			'secondary_muscles_json'   => wp_json_encode( self::normalise_string_list( $req->get_param( 'secondary_muscles' ) ) ),
			'equipment'                => sanitize_text_field( (string) $req->get_param( 'equipment' ) ?: 'other' ),
			'difficulty'               => sanitize_text_field( (string) $req->get_param( 'difficulty' ) ?: 'beginner' ),
			'age_friendliness_score'   => max( 1, min( 10, (int) ( $req->get_param( 'age_friendliness_score' ) ?: 5 ) ) ),
			'joint_stress_score'       => max( 1, min( 10, (int) ( $req->get_param( 'joint_stress_score' ) ?: 3 ) ) ),
			'spinal_load_score'        => max( 1, min( 10, (int) ( $req->get_param( 'spinal_load_score' ) ?: 3 ) ) ),
			'default_rep_min'          => max( 1, (int) ( $req->get_param( 'default_rep_min' ) ?: 8 ) ),
			'default_rep_max'          => max( 1, (int) ( $req->get_param( 'default_rep_max' ) ?: 12 ) ),
			'default_sets'             => max( 1, (int) ( $req->get_param( 'default_sets' ) ?: 3 ) ),
			'default_progression_type' => sanitize_text_field( (string) ( $req->get_param( 'default_progression_type' ) ?: 'double_progression' ) ),
			'coaching_cues_json'       => wp_json_encode( self::normalise_string_list( $req->get_param( 'coaching_cues' ) ) ),
			'day_types_json'           => wp_json_encode( self::normalise_string_list( $req->get_param( 'day_types' ) ) ),
			'slot_types_json'          => wp_json_encode( self::normalise_string_list( $req->get_param( 'slot_types' ) ) ),
			'active'                   => null !== $req->get_param( 'active' ) ? (int) (bool) $req->get_param( 'active' ) : 1,
		];

		if ( $id > 0 ) {
			$wpdb->update( $wpdb->prefix . 'fit_exercises', $data, [ 'id' => $id ] );
			return new \WP_REST_Response( [ 'updated' => true ] );
		}

		$wpdb->insert( $wpdb->prefix . 'fit_exercises', $data );

		return new \WP_REST_Response( [ 'id' => (int) $wpdb->insert_id ], 201 );
	}

	public static function list_substitutions( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT s.id, s.exercise_id, s.substitute_exercise_id, s.reason_code, s.priority,
			        base.name AS exercise_name, sub.name AS substitute_name
			 FROM {$wpdb->prefix}fit_exercise_substitutions s
			 JOIN {$wpdb->prefix}fit_exercises base ON base.id = s.exercise_id
			 JOIN {$wpdb->prefix}fit_exercises sub ON sub.id = s.substitute_exercise_id
			 ORDER BY base.name ASC, s.priority ASC"
		);

		return new \WP_REST_Response( $rows );
	}

	public static function save_substitution( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$wpdb->insert( $wpdb->prefix . 'fit_exercise_substitutions', [
			'exercise_id'            => (int) $req->get_param( 'exercise_id' ),
			'substitute_exercise_id' => (int) $req->get_param( 'substitute_exercise_id' ),
			'reason_code'            => sanitize_text_field( (string) ( $req->get_param( 'reason_code' ) ?: 'variation' ) ),
			'priority'               => max( 1, (int) ( $req->get_param( 'priority' ) ?: 1 ) ),
		] );

		return new \WP_REST_Response( [ 'id' => (int) $wpdb->insert_id ], 201 );
	}

	public static function delete_substitution( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'fit_exercise_substitutions', [ 'id' => (int) $req->get_param( 'id' ) ] );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function list_awards( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		return new \WP_REST_Response( $wpdb->get_results(
			"SELECT id, code, name, description, icon, points, active
			 FROM {$wpdb->prefix}fit_awards
			 ORDER BY points ASC, name ASC"
		) );
	}

	public static function save_award( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$id = (int) $req->get_param( 'id' );
		$data = [
			'code'        => sanitize_key( (string) $req->get_param( 'code' ) ),
			'name'        => sanitize_text_field( (string) $req->get_param( 'name' ) ),
			'description' => sanitize_textarea_field( (string) $req->get_param( 'description' ) ),
			'icon'        => sanitize_text_field( (string) $req->get_param( 'icon' ) ),
			'points'      => max( 0, (int) ( $req->get_param( 'points' ) ?: 0 ) ),
			'active'      => null !== $req->get_param( 'active' ) ? (int) (bool) $req->get_param( 'active' ) : 1,
		];

		if ( $id > 0 ) {
			$wpdb->update( $wpdb->prefix . 'fit_awards', $data, [ 'id' => $id ] );
			return new \WP_REST_Response( [ 'updated' => true ] );
		}

		$wpdb->insert( $wpdb->prefix . 'fit_awards', $data );
		return new \WP_REST_Response( [ 'id' => (int) $wpdb->insert_id ], 201 );
	}

	public static function get_recipe_library( \WP_REST_Request $req ): \WP_REST_Response {
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( array_map( [ __CLASS__, 'normalise_recipe_library_item' ], $recipes ) ) : [];
		usort( $recipes, static function( array $left, array $right ): int {
			$meal_cmp = strcmp( (string) ( $left['meal_type'] ?? '' ), (string) ( $right['meal_type'] ?? '' ) );
			if ( 0 !== $meal_cmp ) {
				return $meal_cmp;
			}

			return strcmp( (string) ( $left['recipe_name'] ?? '' ), (string) ( $right['recipe_name'] ?? '' ) );
		} );

		return new \WP_REST_Response( $recipes );
	}

	public static function save_recipe_library_item( \WP_REST_Request $req ): \WP_REST_Response {
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( $recipes ) : [];
		$id      = (int) ( $req->get_param( 'id' ) ?: time() );
		$item    = self::build_recipe_library_item_from_request( $req, $id );

		if ( empty( $item['dietary_tags'] ) ) {
			$tagging = AiService::auto_tag_recipe_library_items( get_current_user_id(), [ $item ] );
			if ( ! is_wp_error( $tagging ) && ! empty( $tagging[0]['tags'] ) ) {
				$item['dietary_tags'] = self::sanitize_recipe_dietary_tags( $tagging[0]['tags'] );
			}
		}

		$updated = false;
		foreach ( $recipes as $index => $recipe ) {
			if ( (int) ( $recipe['id'] ?? 0 ) === $id ) {
				$recipes[ $index ] = $item;
				$updated = true;
				break;
			}
		}

		if ( ! $updated ) {
			$recipes[] = $item;
		}

		update_option( 'jf_recipe_library', $recipes, false );

		return new \WP_REST_Response( [ 'saved' => true, 'id' => $id ] );
	}

	public static function discover_recipes( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$query     = sanitize_text_field( (string) ( $req->get_param( 'query' ) ?: '' ) );
		$meal_type = sanitize_key( (string) ( $req->get_param( 'meal_type' ) ?: '' ) );
		$count     = max( 1, min( 10, (int) ( $req->get_param( 'count' ) ?: 5 ) ) );

		$result = AiService::discover_recipe_library_items( $user_id, [
			'query'     => $query,
			'meal_type' => $meal_type,
			'count'     => $count,
		] );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function retag_recipe_library_items( \WP_REST_Request $req ): \WP_REST_Response {
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( array_map( [ __CLASS__, 'normalise_recipe_library_item' ], $recipes ) ) : [];

		if ( empty( $recipes ) ) {
			return new \WP_REST_Response( [
				'updated' => 0,
				'recipes' => [],
			] );
		}

		$tagging = AiService::auto_tag_recipe_library_items( get_current_user_id(), $recipes );
		if ( is_wp_error( $tagging ) ) {
			return new \WP_REST_Response( [ 'message' => $tagging->get_error_message() ], 500 );
		}

		$tags_by_index = [];
		foreach ( (array) $tagging as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$index = isset( $row['index'] ) ? (int) $row['index'] : -1;
			if ( $index < 0 ) {
				continue;
			}

			$tags_by_index[ $index ] = self::sanitize_recipe_dietary_tags( $row['tags'] ?? [] );
		}

		$updated = 0;
		foreach ( $recipes as $index => $recipe ) {
			if ( ! isset( $tags_by_index[ $index ] ) ) {
				continue;
			}

			$recipes[ $index ]['dietary_tags'] = $tags_by_index[ $index ];
			$updated++;
		}

		update_option( 'jf_recipe_library', $recipes, false );

		return new \WP_REST_Response( [
			'updated' => $updated,
			'recipes' => array_values( array_map( [ __CLASS__, 'normalise_recipe_library_item' ], $recipes ) ),
		] );
	}

	public static function delete_recipe_library_item( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( array_filter( $recipes, static fn( $recipe ) => (int) ( $recipe['id'] ?? 0 ) !== $id ) ) : [];
		update_option( 'jf_recipe_library', $recipes, false );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function generate_recipe_library_item_image( \WP_REST_Request $req ): \WP_REST_Response {
		$id      = (int) $req->get_param( 'id' );
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( $recipes ) : [];

		foreach ( $recipes as $index => $recipe ) {
			if ( (int) ( $recipe['id'] ?? 0 ) !== $id ) {
				continue;
			}

			$recipe = self::normalise_recipe_library_item( (array) $recipe );
			$image  = self::generate_recipe_image_file( get_current_user_id(), $recipe );
			if ( is_wp_error( $image ) ) {
				return new \WP_REST_Response( [ 'message' => $image->get_error_message() ], 500 );
			}

			$recipe['image_url'] = (string) ( $image['image_url'] ?? '' );
			$recipes[ $index ]   = $recipe;
			update_option( 'jf_recipe_library', $recipes, false );

			return new \WP_REST_Response( [
				'saved'  => true,
				'recipe' => $recipe,
			] );
		}

		return new \WP_REST_Response( [ 'message' => 'Recipe not found.' ], 404 );
	}

	public static function get_settings( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'ai_settings'   => get_option( 'jf_ai_settings', [
				'default_model'                        => 'gpt-5.6-sol',
				'web_search_enabled'                   => 1,
				'tool_calls_enabled'                   => 1,
				'progress_photo_compare_debug_enabled' => 0,
			] ),
			'feature_flags' => get_option( 'jf_feature_flags', [
				'progress_photos' => 1,
				'saved_foods'     => 1,
				'recovery_summary'=> 1,
			] ),
			'push_settings' => PushService::get_settings(),
			'color_schemes' => self::get_color_schemes_config(),
			'app_images' => self::get_app_images_config(),
			'live_workout_frames' => self::get_live_workout_frames_config(),
		] );
	}

	public static function save_settings( \WP_REST_Request $req ): \WP_REST_Response {
		$ai_settings = (array) $req->get_param( 'ai_settings' );
		$feature_flags = (array) $req->get_param( 'feature_flags' );
		$push_settings = (array) $req->get_param( 'push_settings' );
		$color_schemes = $req->get_param( 'color_schemes' );
		$app_images = $req->get_param( 'app_images' );
		$live_workout_frames = $req->get_param( 'live_workout_frames' );

		update_option( 'jf_ai_settings', [
			'default_model'                        => sanitize_text_field( (string) ( $ai_settings['default_model'] ?? 'gpt-5.6-sol' ) ),
			'web_search_enabled'                   => ! empty( $ai_settings['web_search_enabled'] ) ? 1 : 0,
			'tool_calls_enabled'                   => ! empty( $ai_settings['tool_calls_enabled'] ) ? 1 : 0,
			'progress_photo_compare_debug_enabled' => ! empty( $ai_settings['progress_photo_compare_debug_enabled'] ) ? 1 : 0,
		], false );

		update_option( 'jf_feature_flags', array_map(
			static fn( $value ) => ! empty( $value ) ? 1 : 0,
			$feature_flags
		), false );

		update_option( 'jf_push_settings', PushService::sanitize_settings( $push_settings ), false );
		update_option( 'jf_color_schemes', self::sanitize_color_schemes( $color_schemes ), false );
		update_option( 'jf_app_images', self::sanitize_app_images( $app_images ), false );
		update_option( 'jf_live_workout_frames', self::sanitize_live_workout_frames( $live_workout_frames ), false );

		return new \WP_REST_Response( [ 'saved' => true ] );
	}

	// ── GET /admin/support-guides ─────────────────────────────────────────────

	public static function get_support_guides( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'guides' => SupportGuideService::get_support_guides_config(),
			'analytics' => SupportGuideService::support_analytics_payload( 30 ),
		] );
	}

	// ── GET /admin/persona ────────────────────────────────────────────────────

	public static function get_persona( \WP_REST_Request $req ): \WP_REST_Response {
		$defaults = AiService::admin_persona_defaults();
		$persona  = array_merge( $defaults, (array) get_option( 'jf_johnny_persona', [] ) );

		return new \WP_REST_Response( [
			'persona'       => $persona,
			'system_prompt' => get_option( 'jf_johnny_system_prompt', '' ),
			'prompt_source' => get_option( 'jf_johnny_system_prompt', '' ) ? 'custom' : 'default',
			'contract_checks' => AiService::admin_persona_contract_checks(),
		] );
	}

	// ── POST /admin/persona ───────────────────────────────────────────────────

	public static function save_persona( \WP_REST_Request $req ): \WP_REST_Response {
		$persona = array_merge( AiService::admin_persona_defaults(), (array) $req->get_json_params() );

		// Sanitize all fields recursively
		$clean = array_map( 'sanitize_textarea_field', (array) $persona );

		update_option( 'jf_johnny_persona', $clean );

		// Rebuild compiled system prompt from persona fields
		$compiled = AiService::compile_admin_persona_prompt( $clean );
		update_option( 'jf_johnny_system_prompt', $compiled );

		return new \WP_REST_Response( [
			'saved'         => true,
			'system_prompt' => $compiled,
		] );
	}

	// ── POST /admin/persona/test ──────────────────────────────────────────────

	public static function test_persona( \WP_REST_Request $req ): \WP_REST_Response {
		$message    = sanitize_textarea_field( $req->get_param( 'message' ) ?: 'Hey, how are you?' );
		$admin_id   = get_current_user_id();

		$result = AiService::preview_chat( $admin_id, $message );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [
			'reply'      => $result['reply'],
			'reply_html' => self::render_reply_html( (string) $result['reply'] ),
			'sources'    => $result['sources'] ?? [],
			'why'        => $result['why'] ?? '',
			'context_used' => $result['context_used'] ?? [],
			'confidence' => $result['confidence'] ?? '',
			'used_web_search' => (bool) ( $result['used_web_search'] ?? false ),
			'system_prompt' => $result['system_prompt'] ?? '',
		] );
	}

	public static function get_persona_follow_ups( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = (int) $req->get_param( 'user_id' );
		if ( $user_id <= 0 ) {
			$user_id = get_current_user_id();
		}

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new \WP_REST_Response( [ 'message' => 'User not found.' ], 404 );
		}

		return new \WP_REST_Response( [
			'user' => [
				'id' => $user_id,
				'email' => (string) $user->user_email,
				'display_name' => (string) $user->display_name,
			],
			'overview' => AiService::get_follow_up_overview( $user_id ),
			'pending' => AiService::get_pending_follow_ups( $user_id ),
		] );
	}

	public static function preview_persona_time( \WP_REST_Request $req ): \WP_REST_Response {
		$message  = sanitize_textarea_field( $req->get_param( 'message' ) ?: 'Give me a helpful snack suggestion right now.' );
		$admin_id = get_current_user_id();
		$today    = UserTime::today( $admin_id );
		$timezone = UserTime::timezone( $admin_id );
		$scenarios = [
			[ 'key' => 'morning', 'label' => 'Morning', 'time' => '08:00' ],
			[ 'key' => 'late_night', 'label' => 'Late night', 'time' => '22:30' ],
		];

		$results = [];

		foreach ( $scenarios as $scenario ) {
			$datetime = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i', $today . ' ' . $scenario['time'], $timezone );
			if ( false === $datetime ) {
				return new \WP_REST_Response( [ 'message' => 'Could not build preview time context.' ], 500 );
			}

			$context_overrides = [
				'current_local_date'     => $datetime->format( 'Y-m-d' ),
				'current_local_time'     => $datetime->format( 'g:i A' ),
				'current_local_datetime' => $datetime->format( 'Y-m-d g:i A T' ),
				'user_timezone'          => $timezone->getName(),
			];

			$preview = AiService::preview_chat( $admin_id, $message, 'general', $context_overrides );
			if ( is_wp_error( $preview ) ) {
				return new \WP_REST_Response( [ 'message' => $preview->get_error_message() ], 500 );
			}

			$results[] = [
				'key'              => $scenario['key'],
				'label'            => $scenario['label'],
				'preview_datetime' => $context_overrides['current_local_datetime'],
				'reply'            => $preview['reply'],
				'why'              => $preview['why'] ?? '',
				'context_used'     => $preview['context_used'] ?? [],
				'confidence'       => $preview['confidence'] ?? '',
				'context'          => $preview['context'],
			];
		}

		return new \WP_REST_Response( [
			'message'   => $message,
			'scenarios' => $results,
		] );
	}

	public static function preview_persona_actions( \WP_REST_Request $req ): \WP_REST_Response {
		$message  = sanitize_textarea_field( $req->get_param( 'message' ) ?: 'Look at my nutrition today and take the next best action.' );
		$admin_id = get_current_user_id();

		$preview = AiService::preview_chat( $admin_id, $message );
		if ( is_wp_error( $preview ) ) {
			return new \WP_REST_Response( [ 'message' => $preview->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [
			'message'       => $message,
			'reply'         => $preview['reply'],
			'actions'       => $preview['actions'] ?? [],
			'why'           => $preview['why'] ?? '',
			'context_used'  => $preview['context_used'] ?? [],
			'confidence'    => $preview['confidence'] ?? '',
			'system_prompt' => $preview['system_prompt'] ?? '',
			'context'       => $preview['context'] ?? [],
		] );
	}

	public static function test_sms( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = (int) $req->get_param( 'user_id' );
		$trigger_type = sanitize_key( (string) $req->get_param( 'trigger_type' ) );

		if ( $user_id <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'A valid user_id is required.' ], 400 );
		}

		$result = \Johnny5k\Services\SmsService::send_test_reminder( $user_id, $trigger_type );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'sent' => true,
			'result' => $result,
		] );
	}

	public static function test_push( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = (int) $req->get_param( 'user_id' );
		$title   = sanitize_text_field( (string) ( $req->get_param( 'title' ) ?? '' ) );
		$body    = sanitize_textarea_field( (string) ( $req->get_param( 'body' ) ?? '' ) );
		$url     = sanitize_text_field( (string) ( $req->get_param( 'url' ) ?? '/dashboard' ) );

		if ( $user_id <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'A valid user_id is required.' ], 400 );
		}

		$result = PushService::send_test_notification( $user_id, $title, $body, $url );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'sent'   => true,
			'result' => $result,
		] );
	}

	public static function get_diagnostics( \WP_REST_Request $req ): \WP_REST_Response {
		$limit = max( 1, min( 100, (int) ( $req->get_param( 'limit' ) ?: 50 ) ) );

		return new \WP_REST_Response( [
			'entries' => InternalDiagnosticsLogger::list_entries( $limit ),
		] );
	}

	public static function log_client_diagnostic( \WP_REST_Request $req ): \WP_REST_Response {
		$params  = (array) $req->get_json_params();
		$source  = sanitize_key( (string) ( $params['source'] ?? '' ) );
		$message = sanitize_text_field( (string) ( $params['message'] ?? '' ) );

		if ( '' === $source || '' === $message ) {
			return new \WP_REST_Response( [ 'message' => 'source and message are required.' ], 400 );
		}

		$entry = InternalDiagnosticsLogger::record_client_event( $params, get_current_user_id() );

		return new \WP_REST_Response( [
			'logged' => true,
			'entry'  => $entry,
		] );
	}

	public static function get_retention_analytics( \WP_REST_Request $req ): \WP_REST_Response {
		$days = max( 7, min( 90, (int) ( $req->get_param( 'days' ) ?: 30 ) ) );
		return new \WP_REST_Response( self::retention_analytics_payload( $days ) );
	}

	public static function retention_analytics_payload( int $days = 30 ): array {
		global $wpdb;

		$days = max( 7, min( 90, $days ) );
		$since_utc = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );
		$p = $wpdb->prefix . 'fit_';

		$users = $wpdb->get_results(
			"SELECT u.ID AS user_id, u.user_email, u.user_registered, p.first_name, p.last_name, p.onboarding_complete
			 FROM {$wpdb->users} u
			 LEFT JOIN {$p}user_profiles p ON p.user_id = u.ID
			 ORDER BY u.user_registered DESC"
		);

		$segments = [
			'active' => 0,
			'at_risk' => 0,
			'winback' => 0,
			'churned' => 0,
		];
		$rows = [];

		foreach ( (array) $users as $user ) {
			$user_id = (int) ( $user->user_id ?? 0 );
			if ( $user_id <= 0 ) {
				continue;
			}

			$last_active = $wpdb->get_var( $wpdb->prepare(
				"SELECT MAX(last_activity) FROM (
					SELECT MAX(created_at) AS last_activity FROM {$p}behavior_events WHERE user_id = %d
					UNION ALL
					SELECT MAX(created_at) AS last_activity FROM {$p}workout_sessions WHERE user_id = %d
					UNION ALL
					SELECT MAX(created_at) AS last_activity FROM {$p}cardio_logs WHERE user_id = %d
					UNION ALL
					SELECT MAX(created_at) AS last_activity FROM {$p}step_logs WHERE user_id = %d
					UNION ALL
					SELECT MAX(created_at) AS last_activity FROM {$p}sleep_logs WHERE user_id = %d
					UNION ALL
					SELECT MAX(created_at) AS last_activity FROM {$p}meals WHERE user_id = %d
				 ) activity_rollup",
				$user_id,
				$user_id,
				$user_id,
				$user_id,
				$user_id,
				$user_id
			) );

			$inactive_days = null;
			if ( $last_active ) {
				$inactive_days = (int) floor( ( time() - strtotime( (string) $last_active ) ) / DAY_IN_SECONDS );
			}

			$segment = 'churned';
			if ( null === $inactive_days || $inactive_days >= 14 ) {
				$segment = 'churned';
			} elseif ( $inactive_days >= 7 ) {
				$segment = 'winback';
			} elseif ( $inactive_days >= 3 ) {
				$segment = 'at_risk';
			} else {
				$segment = 'active';
			}
			$segments[ $segment ]++;

			$rows[] = [
				'user_id' => $user_id,
				'user_email' => (string) ( $user->user_email ?? '' ),
				'name' => trim( (string) ( $user->first_name ?? '' ) . ' ' . (string) ( $user->last_name ?? '' ) ),
				'onboarding_complete' => ! empty( $user->onboarding_complete ),
				'user_registered' => (string) ( $user->user_registered ?? '' ),
				'last_active_at' => $last_active ? (string) $last_active : '',
				'inactive_days' => $inactive_days,
				'segment' => $segment,
			];
		}

		usort( $rows, static function( array $a, array $b ): int {
			$left = isset( $a['inactive_days'] ) ? (int) $a['inactive_days'] : 9999;
			$right = isset( $b['inactive_days'] ) ? (int) $b['inactive_days'] : 9999;
			return $left <=> $right;
		} );

		$events = $wpdb->get_results( $wpdb->prepare(
			"SELECT event_name, COUNT(*) AS total_events, COUNT(DISTINCT user_id) AS active_users
			 FROM {$p}behavior_events
			 WHERE occurred_at >= %s
			 GROUP BY event_name
			 ORDER BY total_events DESC
			 LIMIT 20",
			$since_utc
		), ARRAY_A );

		$delivery_summary_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT channel, status, COUNT(*) AS total
			 FROM {$p}coach_delivery_logs
			 WHERE created_at >= %s
			 GROUP BY channel, status
			 ORDER BY channel ASC, status ASC",
			$since_utc
		), ARRAY_A );

		$delivery_summary = [];
		foreach ( (array) $delivery_summary_rows as $row ) {
			$channel = sanitize_key( (string) ( $row['channel'] ?? '' ) );
			$status  = sanitize_key( (string) ( $row['status'] ?? '' ) );
			if ( '' === $channel || '' === $status ) {
				continue;
			}
			if ( ! isset( $delivery_summary[ $channel ] ) ) {
				$delivery_summary[ $channel ] = [];
			}
			$delivery_summary[ $channel ][ $status ] = (int) ( $row['total'] ?? 0 );
		}

		$recent_deliveries = $wpdb->get_results( $wpdb->prepare(
			"SELECT l.user_id, l.channel, l.status, l.delivery_key, l.title, l.error_message, l.created_at,
			        u.user_email, p.first_name, p.last_name
			 FROM {$p}coach_delivery_logs l
			 LEFT JOIN {$wpdb->users} u ON u.ID = l.user_id
			 LEFT JOIN {$p}user_profiles p ON p.user_id = l.user_id
			 WHERE l.created_at >= %s
			 ORDER BY l.created_at DESC
			 LIMIT 20",
			$since_utc
		), ARRAY_A );

		return [
			'days' => $days,
			'since_utc' => $since_utc,
			'total_users' => count( $rows ),
			'segments' => $segments,
			'events' => array_values( $events ),
			'push_summary' => PushService::get_subscription_summary(),
			'delivery_summary' => $delivery_summary,
			'recent_deliveries' => array_values( $recent_deliveries ),
			'users' => $rows,
		];
	}

	// ── Persona compiler ──────────────────────────────────────────────────────

	private static function render_reply_html( string $reply ): string {
		$reply = preg_replace( '/\s(?=\d+\.\s+\*\*)/', "\n", trim( $reply ) );
		$html  = esc_html( $reply );

		// Support the most common formatting the model returns in the admin preview.
		$html = preg_replace( '/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $html );
		$html = preg_replace( '/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/s', '<em>$1</em>', $html );
		$html = preg_replace( '/`([^`]+)`/', '<code>$1</code>', $html );

		return wp_kses_post( wpautop( $html ) );
	}

	private static function build_recipe_library_item_from_request( \WP_REST_Request $req, int $id ): array {
		return self::normalise_recipe_library_item( [
			'id'                  => $id,
			'meal_type'           => $req->get_param( 'meal_type' ),
			'recipe_name'         => $req->get_param( 'recipe_name' ),
			'ingredients'         => $req->get_param( 'ingredients' ),
			'instructions'        => $req->get_param( 'instructions' ),
			'estimated_calories'  => $req->get_param( 'estimated_calories' ),
			'estimated_protein_g' => $req->get_param( 'estimated_protein_g' ),
			'estimated_carbs_g'   => $req->get_param( 'estimated_carbs_g' ),
			'estimated_fat_g'     => $req->get_param( 'estimated_fat_g' ),
			'why_this_works'      => $req->get_param( 'why_this_works' ),
			'source_url'          => $req->get_param( 'source_url' ),
			'source_title'        => $req->get_param( 'source_title' ),
			'source_type'         => $req->get_param( 'source_type' ),
			'dietary_tags'        => $req->get_param( 'dietary_tags' ),
			'image_url'           => $req->get_param( 'image_url' ),
		] );
	}

	private static function normalise_recipe_library_item( array $recipe ): array {
		return [
			'id'                  => (int) ( $recipe['id'] ?? time() ),
			'meal_type'           => sanitize_key( (string) ( $recipe['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
			'recipe_name'         => sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) ),
			'ingredients'         => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ),
			'instructions'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['instructions'] ?? [] ) ) ) ),
			'estimated_calories'  => (int) ( $recipe['estimated_calories'] ?? 0 ),
			'estimated_protein_g' => (float) ( $recipe['estimated_protein_g'] ?? 0 ),
			'estimated_carbs_g'   => (float) ( $recipe['estimated_carbs_g'] ?? 0 ),
			'estimated_fat_g'     => (float) ( $recipe['estimated_fat_g'] ?? 0 ),
			'why_this_works'      => sanitize_text_field( (string) ( $recipe['why_this_works'] ?? '' ) ),
			'source_url'          => esc_url_raw( (string) ( $recipe['source_url'] ?? '' ) ),
			'source_title'        => sanitize_text_field( (string) ( $recipe['source_title'] ?? '' ) ),
			'source_type'         => sanitize_key( (string) ( $recipe['source_type'] ?? 'manual' ) ) ?: 'manual',
			'dietary_tags'        => self::sanitize_recipe_dietary_tags( $recipe['dietary_tags'] ?? [] ),
			'image_url'           => esc_url_raw( (string) ( $recipe['image_url'] ?? '' ) ),
		];
	}

	private static function sanitize_recipe_dietary_tags( $tags ): array {
		return array_values( array_unique( array_filter( array_map(
			static function( $tag ): string {
				$key = sanitize_key( (string) $tag );
				return in_array( $key, self::RECIPE_DIETARY_TAG_OPTIONS, true ) ? $key : '';
			},
			(array) $tags
		) ) ) );
	}

	private static function build_recipe_image_prompt( array $recipe ): string {
		$meal_type = sanitize_text_field( (string) ( $recipe['meal_type'] ?? 'meal' ) );
		$name      = sanitize_text_field( (string) ( $recipe['recipe_name'] ?? 'Recipe' ) );
		$ingredients = array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ), 0, 8 );
		$tags = self::sanitize_recipe_dietary_tags( $recipe['dietary_tags'] ?? [] );

		$parts = [
			sprintf( 'Create a polished square food photo of %s.', $name ),
			sprintf( 'Show it as a %s recipe plated attractively with realistic food texture and natural lighting.', $meal_type ),
			$ingredients ? 'Key visible ingredients: ' . implode( ', ', $ingredients ) . '.' : '',
			$tags ? 'The meal should visually fit these dietary tags when possible: ' . implode( ', ', $tags ) . '.' : '',
			'Avoid text overlays, labels, watermarks, hands, or packaging. Keep it appetizing, clean, and suitable for a fitness recipe library.',
		];

		return trim( implode( ' ', array_filter( $parts ) ) );
	}

	private static function generate_recipe_image_file( int $user_id, array $recipe ): array|\WP_Error {
		$result = GeminiImageService::generate_image( $user_id, self::build_recipe_image_prompt( $recipe ), [], [
			'aspect_ratio' => '1:1',
			'image_size'   => '2K',
		] );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! function_exists( 'wp_upload_dir' ) ) {
			return new \WP_Error( 'recipe_image_upload_unavailable', 'The uploads directory is unavailable.' );
		}

		$upload_dir = wp_upload_dir();
		$base_dir   = (string) ( $upload_dir['basedir'] ?? '' );
		$base_url   = (string) ( $upload_dir['baseurl'] ?? '' );
		if ( '' === $base_dir || '' === $base_url ) {
			return new \WP_Error( 'recipe_image_upload_unavailable', 'The uploads directory is unavailable.' );
		}

		$target_dir = trailingslashit( $base_dir ) . 'johnny5k-recipe-images';
		if ( ! file_exists( $target_dir ) && ! wp_mkdir_p( $target_dir ) ) {
			return new \WP_Error( 'recipe_image_upload_failed', 'The recipe image directory could not be created.' );
		}

		$extension = 'png';
		$mime_type = (string) ( $result['mime_type'] ?? 'image/png' );
		if ( 'image/jpeg' === $mime_type ) {
			$extension = 'jpg';
		} elseif ( 'image/webp' === $mime_type ) {
			$extension = 'webp';
		}

		$filename = sanitize_file_name(
			sanitize_title( (string) ( $recipe['recipe_name'] ?? 'recipe' ) ) . '-' . time() . '.' . $extension
		);
		$target_path = trailingslashit( $target_dir ) . $filename;
		if ( false === file_put_contents( $target_path, (string) ( $result['data'] ?? '' ) ) ) {
			return new \WP_Error( 'recipe_image_upload_failed', 'The generated recipe image could not be saved.' );
		}

		return [
			'image_url' => trailingslashit( $base_url ) . 'johnny5k-recipe-images/' . $filename,
		];
	}

	private static function normalise_exercise_admin_row( $row ): array {
		$data = (array) $row;

		return [
			'id'                       => (int) ( $data['id'] ?? 0 ),
			'slug'                     => sanitize_title( (string) ( $data['slug'] ?? '' ) ),
			'name'                     => sanitize_text_field( (string) ( $data['name'] ?? '' ) ),
			'description'              => sanitize_textarea_field( (string) ( $data['description'] ?? '' ) ),
			'movement_pattern'         => sanitize_text_field( (string) ( $data['movement_pattern'] ?? '' ) ),
			'primary_muscle'           => sanitize_text_field( (string) ( $data['primary_muscle'] ?? '' ) ),
			'secondary_muscles'        => self::normalise_string_list( $data['secondary_muscles_json'] ?? [] ),
			'equipment'                => sanitize_text_field( (string) ( $data['equipment'] ?? '' ) ),
			'difficulty'               => sanitize_text_field( (string) ( $data['difficulty'] ?? '' ) ),
			'age_friendliness_score'   => (int) ( $data['age_friendliness_score'] ?? 0 ),
			'joint_stress_score'       => (int) ( $data['joint_stress_score'] ?? 0 ),
			'spinal_load_score'        => (int) ( $data['spinal_load_score'] ?? 0 ),
			'default_rep_min'          => (int) ( $data['default_rep_min'] ?? 0 ),
			'default_rep_max'          => (int) ( $data['default_rep_max'] ?? 0 ),
			'default_sets'             => (int) ( $data['default_sets'] ?? 0 ),
			'default_progression_type' => sanitize_text_field( (string) ( $data['default_progression_type'] ?? '' ) ),
			'coaching_cues'            => self::normalise_string_list( $data['coaching_cues_json'] ?? [] ),
			'day_types'                => self::normalise_string_list( $data['day_types_json'] ?? [] ),
			'slot_types'               => self::normalise_string_list( $data['slot_types_json'] ?? [] ),
			'active'                   => (int) ( $data['active'] ?? 0 ),
		];
	}

	private static function normalise_string_list( $value ): array {
		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			if ( is_array( $decoded ) ) {
				$value = $decoded;
			} else {
				$value = preg_split( '/[\r\n,]+/', $value ) ?: [];
			}
		}

		if ( ! is_array( $value ) ) {
			return [];
		}

		return array_values( array_filter( array_map( static fn( $item ): string => sanitize_text_field( (string) $item ), $value ) ) );
	}
}
