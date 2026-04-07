<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Auth\InviteCodes;
use Johnny5k\Services\AiService;
use Johnny5k\Services\CostTracker;
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
 * GET  /fit/v1/admin/persona          — get Johnny 5000 persona settings
 * POST /fit/v1/admin/persona          — save Johnny 5000 persona settings
 * POST /fit/v1/admin/persona/test     — test persona with a message
 * POST /fit/v1/admin/sms/test         — send a test SMS reminder to a user
 */
class AdminApiController {

	public static function default_color_schemes(): array {
		return [
			[
				'id' => 'classic',
				'label' => 'Classic Launch',
				'description' => 'The current Johnny5k palette.',
				'colors' => [
					'bg' => '#E6F3FD',
					'bg2' => '#FFFFFF',
					'bg3' => '#CCE6F8',
					'border' => '#A8D4F0',
					'text' => '#0F1F55',
					'textMuted' => '#5878A0',
					'accent' => '#FF5530',
					'accent2' => '#00BCDE',
					'accent3' => '#FF38A0',
					'danger' => '#FF2E50',
					'success' => '#22C47E',
					'yellow' => '#FFD000',
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
					'border' => '#445064',
					'text' => '#E8EDF6',
					'textMuted' => '#97A4BA',
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
					'border' => '#9EDBBC',
					'text' => '#123B3A',
					'textMuted' => '#507A73',
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
					'border' => '#315074',
					'text' => '#EAF4FF',
					'textMuted' => '#98B6D8',
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
					'border' => '#CFB37A',
					'text' => '#3B2A19',
					'textMuted' => '#7A6243',
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

	public static function sanitize_color_schemes( $schemes ): array {
		$defaults = self::default_color_schemes();
		$allowed_color_keys = [ 'bg', 'bg2', 'bg3', 'border', 'text', 'textMuted', 'accent', 'accent2', 'accent3', 'danger', 'success', 'yellow' ];
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
				$color_value = sanitize_hex_color( (string) ( $raw_colors[ $color_key ] ?? '' ) );
				$colors[ $color_key ] = $color_value ?: $fallback['colors'][ $color_key ];
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

		register_rest_route( $ns, '/admin/recipes/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_recipe_library_item' ],
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

	public static function delete_recipe_library_item( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( array_filter( $recipes, static fn( $recipe ) => (int) ( $recipe['id'] ?? 0 ) !== $id ) ) : [];
		update_option( 'jf_recipe_library', $recipes, false );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function get_settings( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'ai_settings'   => get_option( 'jf_ai_settings', [
				'default_model'                        => 'gpt-5.4-mini',
				'web_search_enabled'                   => 1,
				'tool_calls_enabled'                   => 1,
				'progress_photo_compare_debug_enabled' => 0,
			] ),
			'feature_flags' => get_option( 'jf_feature_flags', [
				'progress_photos' => 1,
				'saved_foods'     => 1,
				'recovery_summary'=> 1,
			] ),
			'color_schemes' => self::get_color_schemes_config(),
		] );
	}

	public static function save_settings( \WP_REST_Request $req ): \WP_REST_Response {
		$ai_settings = (array) $req->get_param( 'ai_settings' );
		$feature_flags = (array) $req->get_param( 'feature_flags' );
		$color_schemes = $req->get_param( 'color_schemes' );

		update_option( 'jf_ai_settings', [
			'default_model'                        => sanitize_text_field( (string) ( $ai_settings['default_model'] ?? 'gpt-5.4-mini' ) ),
			'web_search_enabled'                   => ! empty( $ai_settings['web_search_enabled'] ) ? 1 : 0,
			'tool_calls_enabled'                   => ! empty( $ai_settings['tool_calls_enabled'] ) ? 1 : 0,
			'progress_photo_compare_debug_enabled' => ! empty( $ai_settings['progress_photo_compare_debug_enabled'] ) ? 1 : 0,
		], false );

		update_option( 'jf_feature_flags', array_map(
			static fn( $value ) => ! empty( $value ) ? 1 : 0,
			$feature_flags
		), false );

		update_option( 'jf_color_schemes', self::sanitize_color_schemes( $color_schemes ), false );

		return new \WP_REST_Response( [ 'saved' => true ] );
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
