<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\IronQuestDailyStateService;
use Johnny5k\Services\IronQuestEntitlementService;
use Johnny5k\Services\IronQuestMissionService;
use Johnny5k\Services\IronQuestNarrativeService;
use Johnny5k\Services\IronQuestProfileService;
use Johnny5k\Services\IronQuestProgressionService;
use Johnny5k\Services\IronQuestRegistryService;
use Johnny5k\Services\IronQuestRewardService;
use WP_Error;

class IronQuestController extends RestController {
	private const FAST_TRAVEL_GOLD_COST = 10;

	public static function register_routes(): void {
		$ns = JF_REST_NAMESPACE;

		register_rest_route(
			$ns,
			'/ironquest/config',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_config' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/config/location/(?P<slug>[a-z0-9_\-]+)',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_location' ],
				'permission_callback' => self::auth_callback(),
				'args'                => [
					'slug' => [
						'required' => true,
						'type'     => 'string',
					],
				],
				]
			);

		register_rest_route(
			$ns,
			'/ironquest/profile',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_profile' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/enable',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'enable' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/disable',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'disable' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/restart',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'restart_onboarding' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/identity',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'save_identity' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/missions/active',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_active_mission' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/missions/start',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'start_mission' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/missions/select',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'select_mission' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/missions/resolve',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'resolve_mission' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/missions/story/choice',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'choose_story_opening' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/missions/story/progress',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'progress_story' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/daily/refresh',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'refresh_daily_state' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/daily/progress',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'update_daily_progress' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/store',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_store' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/store/purchase',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'purchase_store_item' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/store/use',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'use_store_item' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/store/sell',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'sell_store_item' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/tavern',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_tavern' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/tavern/action',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'resolve_tavern_action' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/route/fast-travel',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'fast_travel' ],
				'permission_callback' => self::auth_callback(),
			]
		);

		register_rest_route(
			$ns,
			'/ironquest/route/travel',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'travel_to_location' ],
				'permission_callback' => self::auth_callback(),
			]
		);
	}

	public static function get_config( \WP_REST_Request $req ): \WP_REST_Response {
		return self::response(
			[
				'ironquest' => IronQuestRegistryService::get_seed_bundle(),
			]
		);
	}

	public static function get_location( \WP_REST_Request $req ): \WP_REST_Response {
		$slug     = sanitize_key( (string) $req->get_param( 'slug' ) );
		$location = IronQuestRegistryService::get_location( $slug );

		if ( empty( $location ) ) {
			return self::message( 'IronQuest location not found.', 404 );
		}

		return self::response(
			[
				'location' => $location,
				'missions' => IronQuestRegistryService::get_location_missions( $slug ),
				]
			);
	}

	public static function get_profile( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		return self::response( self::build_profile_payload( $user_id ) );
	}

	public static function enable( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		$profile = IronQuestProfileService::enable_for_user( $user_id );

		return self::response(
			[
				'enabled' => true,
				'profile' => $profile,
			],
			200
		);
	}

	public static function disable( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$profile = IronQuestProfileService::disable_for_user( $user_id );

		return self::response(
			[
				'enabled' => false,
				'profile' => $profile,
			],
			200
		);
	}

	public static function restart_onboarding( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		$profile = IronQuestProfileService::reset_onboarding_for_user( $user_id );

		return self::response(
			[
				'restarted' => true,
				'profile'   => $profile,
			],
			200
		);
	}

	public static function save_identity( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		$profile = IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'                    => $req->get_param( 'class_slug' ),
				'motivation_slug'               => $req->get_param( 'motivation_slug' ),
				'starter_portrait_attachment_id' => (int) ( $req->get_param( 'starter_portrait_attachment_id' ) ?: 0 ),
				'enabled'                       => 1,
			]
		);

		return self::response(
			[
				'profile' => $profile,
			]
		);
	}

	public static function get_active_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$profile = IronQuestProfileService::ensure_profile( $user_id );
		$active  = IronQuestMissionService::get_active_run( $user_id );

		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );

		return self::response(
			[
				'active_run' => $active,
				'story_state' => self::get_story_state_for_run( $user_id, $active ),
				'profile'    => $profile,
				'location'   => $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : null,
				'missions'   => $location_slug ? IronQuestRegistryService::get_location_missions( $location_slug ) : [],
			]
		);
	}

	public static function start_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		$profile = IronQuestProfileService::ensure_profile( $user_id );
		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: ( $profile['current_location_slug'] ?? '' ) ) );
		$mission_slug  = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$run_type      = sanitize_key( (string) ( $req->get_param( 'run_type' ) ?: 'workout' ) );
		$source_session_id = sanitize_text_field( (string) ( $req->get_param( 'source_session_id' ) ?: '' ) );

		if ( '' === $location_slug ) {
			return self::message( 'An IronQuest location is required.', 400 );
		}

		if ( '' === $mission_slug ) {
			$mission_slug = self::resolve_selected_or_default_mission_slug( $profile, $location_slug, $run_type );
		}

		if ( '' === $mission_slug ) {
			return self::message( 'No IronQuest mission is available for the requested location.', 400 );
		}

		$run = IronQuestMissionService::start_run( $user_id, $mission_slug, $location_slug, $run_type, $source_session_id );
		if ( is_wp_error( $run ) ) {
			return self::message( $run->get_error_message(), 400 );
		}

		return self::response(
			[
				'run'      => $run,
				'story_state' => self::get_story_state_for_run( $user_id, $run ),
				'profile'  => IronQuestProfileService::get_profile( $user_id ),
				'location' => IronQuestRegistryService::get_location( $location_slug ),
				'mission'  => self::find_location_mission( $location_slug, $mission_slug ),
			],
			201
		);
	}

	public static function select_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		$profile = IronQuestProfileService::ensure_profile( $user_id );
		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: ( $profile['current_location_slug'] ?? '' ) ) );
		$mission_slug  = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );

		if ( '' === $location_slug ) {
			return self::message( 'An IronQuest location is required.', 400 );
		}

		if ( '' === $mission_slug ) {
			return self::message( 'A mission slug is required.', 400 );
		}

		$mission = self::find_location_mission( $location_slug, $mission_slug );
		if ( empty( $mission ) ) {
			return self::message( 'That mission is not available for the current region.', 404 );
		}

		$profile = IronQuestProfileService::set_location_and_mission( $user_id, $location_slug, $mission_slug );

		return self::response(
			[
				'selected' => true,
				'profile'  => $profile,
				'location' => IronQuestRegistryService::get_location( $location_slug ),
				'mission'  => $mission,
			]
		);
	}

	public static function resolve_mission( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$run_id  = (int) ( $req->get_param( 'run_id' ) ?: 0 );

		if ( $run_id <= 0 ) {
			return self::message( 'A mission run id is required.', 400 );
		}

		$run = IronQuestMissionService::get_run( $run_id, $user_id );
		if ( empty( $run ) ) {
			return self::message( 'IronQuest mission run not found.', 404 );
		}

		$result = self::resolve_mission_run(
			$user_id,
			$run_id,
			(string) ( $req->get_param( 'result_band' ) ?: 'victory' ),
			(int) ( $req->get_param( 'xp_awarded' ) ?: 0 ),
			(int) ( $req->get_param( 'gold_awarded' ) ?: 0 )
		);
		if ( is_wp_error( $result ) ) {
			return self::message( $result->get_error_message(), 400 );
		}

		return self::response( $result );
	}

	public static function choose_story_opening( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$run_id  = (int) ( $req->get_param( 'run_id' ) ?: 0 );

		if ( $run_id <= 0 ) {
			return self::message( 'A mission run id is required.', 400 );
		}

		$run = IronQuestMissionService::get_run( $run_id, $user_id );
		if ( empty( $run ) ) {
			return self::message( 'IronQuest mission run not found.', 404 );
		}

		$story_state = IronQuestNarrativeService::choose_opening_action(
			$user_id,
			$run,
			(string) ( $req->get_param( 'choice_id' ) ?: '' ),
			(string) ( $req->get_param( 'stance' ) ?: 'steady' )
		);
		$updated_run = self::sync_story_phase_on_run( $run, $user_id, $story_state );

		return self::response(
			[
				'run'         => $updated_run,
				'story_state' => $story_state,
				'mission'     => self::find_location_mission( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) ),
				'location'    => IronQuestRegistryService::get_location( (string) ( $run['location_slug'] ?? '' ) ),
			]
		);
	}

	public static function progress_story( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$run_id  = (int) ( $req->get_param( 'run_id' ) ?: 0 );

		if ( $run_id <= 0 ) {
			return self::message( 'A mission run id is required.', 400 );
		}

		$run = IronQuestMissionService::get_run( $run_id, $user_id );
		if ( empty( $run ) ) {
			return self::message( 'IronQuest mission run not found.', 404 );
		}

		$story_state = IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'         => (string) ( $req->get_param( 'event_type' ) ?: 'set_saved' ),
				'exercise_name'      => (string) ( $req->get_param( 'exercise_name' ) ?: '' ),
				'slot_type'          => (string) ( $req->get_param( 'slot_type' ) ?: '' ),
				'exercise_order'     => (int) ( $req->get_param( 'exercise_order' ) ?: 0 ),
				'exercise_count'     => (int) ( $req->get_param( 'exercise_count' ) ?: 0 ),
				'set_number'         => (int) ( $req->get_param( 'set_number' ) ?: 0 ),
				'sets_total'         => (int) ( $req->get_param( 'sets_total' ) ?: 0 ),
				'rep_target_min'     => (int) ( $req->get_param( 'rep_target_min' ) ?: 0 ),
				'rep_target_max'     => (int) ( $req->get_param( 'rep_target_max' ) ?: 0 ),
				'reps_completed'     => (int) ( $req->get_param( 'reps_completed' ) ?: 0 ),
				'current_rir'        => '' !== (string) $req->get_param( 'current_rir' ) ? (float) $req->get_param( 'current_rir' ) : null,
				'completed_exercise' => ! empty( $req->get_param( 'completed_exercise' ) ),
				'has_next_exercise'  => ! empty( $req->get_param( 'has_next_exercise' ) ),
				'next_exercise_name' => (string) ( $req->get_param( 'next_exercise_name' ) ?: '' ),
				'next_slot_type'     => (string) ( $req->get_param( 'next_slot_type' ) ?: '' ),
				'stance'             => (string) ( $req->get_param( 'stance' ) ?: 'steady' ),
			]
		);
		$updated_run = self::sync_story_phase_on_run( $run, $user_id, $story_state );

		return self::response(
			[
				'run'         => $updated_run,
				'story_state' => $story_state,
				'profile'     => IronQuestProfileService::ensure_profile( $user_id ),
			]
		);
	}

	public static function refresh_daily_state( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );
		$state      = IronQuestDailyStateService::get_state( $user_id, $state_date ?: null );

		return self::response(
			[
				'daily_state' => $state,
				'profile'     => IronQuestProfileService::ensure_profile( $user_id ),
			]
		);
	}

	public static function get_tavern( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );

		return self::response( self::build_tavern_state( $user_id, $state_date ?: null ) );
	}

	public static function get_store( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		return self::response( self::build_profile_payload( $user_id )['store'] ?? [] );
	}

	public static function purchase_store_item( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );
		$item_id    = sanitize_key( (string) ( $req->get_param( 'item_id' ) ?: '' ) );
		$profile    = IronQuestProfileService::ensure_profile( $user_id );

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		if ( '' === $item_id ) {
			return self::message( 'Choose a store item before purchasing it.', 400 );
		}

		$result = self::apply_store_purchase( $user_id, $item_id, $state_date ?: null );
		if ( is_wp_error( $result ) ) {
			$status = match ( $result->get_error_code() ) {
				'invalid_item' => 404,
				'insufficient_gold', 'inventory_full', 'already_owned' => 409,
				default => 400,
			};

			return self::response(
				[
					'purchased' => false,
					'reason'    => $result->get_error_code(),
					'message'   => $result->get_error_message(),
					'store'     => self::build_profile_payload( $user_id )['store'] ?? [],
					'profile'   => $profile,
				],
				$status
			);
		}

		return self::response( $result, 201 );
	}

	public static function use_store_item( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );
		$item_id    = sanitize_key( (string) ( $req->get_param( 'item_id' ) ?: '' ) );
		$profile    = IronQuestProfileService::ensure_profile( $user_id );

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		if ( '' === $item_id ) {
			return self::message( 'Choose an inventory item before using it.', 400 );
		}

		$result = self::apply_store_item_use( $user_id, $item_id, $state_date ?: null );
		if ( is_wp_error( $result ) ) {
			$status = match ( $result->get_error_code() ) {
				'invalid_item' => 404,
				'already_prepped', 'hp_full' => 409,
				default => 400,
			};

			return self::response(
				[
					'used'    => false,
					'reason'  => $result->get_error_code(),
					'message' => $result->get_error_message(),
					'store'   => self::build_profile_payload( $user_id )['store'] ?? [],
					'profile' => $profile,
				],
				$status
			);
		}

		return self::response( $result );
	}

	public static function sell_store_item( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );
		$item_id    = sanitize_key( (string) ( $req->get_param( 'item_id' ) ?: '' ) );
		$profile    = IronQuestProfileService::ensure_profile( $user_id );

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		if ( '' === $item_id ) {
			return self::message( 'Choose an inventory item before selling it.', 400 );
		}

		$result = self::apply_store_item_sellback( $user_id, $item_id, $state_date ?: null );
		if ( is_wp_error( $result ) ) {
			$status = match ( $result->get_error_code() ) {
				'invalid_item' => 404,
				default => 400,
			};

			return self::response(
				[
					'sold'    => false,
					'reason'  => $result->get_error_code(),
					'message' => $result->get_error_message(),
					'store'   => self::build_profile_payload( $user_id )['store'] ?? [],
					'profile' => $profile,
				],
				$status
			);
		}

		return self::response( $result );
	}

	public static function resolve_tavern_action( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );
		$action_id  = sanitize_key( (string) ( $req->get_param( 'action_id' ) ?: '' ) );

		$result = self::apply_tavern_action( $user_id, $action_id, $state_date ?: null );
		if ( is_wp_error( $result ) ) {
			$status = 'action_already_resolved' === $result->get_error_code() ? 409 : 400;

			return self::message(
				$result->get_error_message(),
				$status,
				[
					'reason' => $result->get_error_code(),
					'state'  => self::build_tavern_state( $user_id, $state_date ?: null ),
				]
			);
		}

		return self::response( $result );
	}

	public static function update_daily_progress( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$state_date = sanitize_text_field( (string) ( $req->get_param( 'state_date' ) ?: '' ) );
		$profile    = IronQuestProfileService::ensure_profile( $user_id );

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::response(
				[
					'applied'     => false,
					'reason'      => 'not_entitled',
					'daily_state' => IronQuestDailyStateService::get_state( $user_id, $state_date ?: null ),
					'profile'     => $profile,
				]
			);
		}

		if ( empty( $profile['enabled'] ) ) {
			return self::response(
				[
					'applied'     => false,
					'reason'      => 'disabled',
					'daily_state' => IronQuestDailyStateService::get_state( $user_id, $state_date ?: null ),
					'profile'     => $profile,
				]
			);
		}

		$quest_key     = sanitize_key( (string) ( $req->get_param( 'quest_key' ) ?: '' ) );
		$travel_source = sanitize_key( (string) ( $req->get_param( 'travel_source' ) ?: '' ) );
		$state         = IronQuestDailyStateService::get_state( $user_id, $state_date ?: null );
		$previous_state = $state;
		$applied       = false;

		if ( in_array( $quest_key, [ 'meal', 'sleep', 'cardio', 'steps', 'workout' ], true ) ) {
			$state   = IronQuestDailyStateService::mark_quest_complete( $user_id, $quest_key, $state_date ?: null );
			$applied = true;
		}

		if ( '' !== $travel_source ) {
			$travel_points = self::resolve_daily_travel_points( $req );
			$state   = IronQuestDailyStateService::sync_travel_points_source(
				$user_id,
				$travel_source,
				$travel_points,
				$state_date ?: null
			);
			IronQuestRewardService::upsert_activity_award(
				$user_id,
				'route_progress',
				$travel_source,
				'travel_points',
				[
					'points'     => $travel_points,
					'state_date' => (string) ( $state['state_date'] ?? ( $state_date ?: '' ) ),
				]
			);
			$applied = true;
		}

		$route_sync = self::sync_route_progression( $user_id );

		return self::response(
			[
				'applied'     => $applied,
				'daily_state' => $state,
				'changes'     => self::build_daily_progress_changes( $previous_state, $state ),
				'route_state' => $route_sync['route_state'],
				'route_changes' => $route_sync['route_changes'],
				'profile'     => IronQuestProfileService::get_profile( $user_id ),
			]
		);
	}

	public static function admin_build_profile_payload( int $user_id ): array {
		return self::build_profile_payload( $user_id );
	}

	public static function admin_sync_route_progression( int $user_id, array $context = [] ): array {
		return self::sync_route_progression( $user_id, $context );
	}

	public static function admin_mark_daily_quest( int $user_id, string $quest_key, ?string $state_date = null ): array {
		$quest_key       = sanitize_key( $quest_key );
		$previous_state  = IronQuestDailyStateService::get_state( $user_id, $state_date ?: null );
		$next_state      = IronQuestDailyStateService::mark_quest_complete( $user_id, $quest_key, $state_date ?: null );
		$route_sync      = self::sync_route_progression( $user_id );

		return [
			'daily_state'    => $next_state,
			'changes'        => self::build_daily_progress_changes( $previous_state, $next_state ),
			'route_state'    => $route_sync['route_state'],
			'route_changes'  => $route_sync['route_changes'],
			'profile'        => IronQuestProfileService::get_profile( $user_id ),
		];
	}

	public static function fast_travel( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$profile = IronQuestProfileService::ensure_profile( $user_id );

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		$route_state   = self::build_route_state( $user_id, $profile );
		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: ( $route_state['next_unlocks'][0]['location_slug'] ?? '' ) ) );
		$unlock_state  = self::find_route_unlock_state( $route_state, $location_slug );

		if ( empty( $unlock_state ) ) {
			return self::message( 'No matching locked route destination was found.', 404 );
		}

		if ( empty( $unlock_state['requirements_met'] ) ) {
			return self::message( 'Clear the route gate before using fast travel on this destination.', 409 );
		}

		$requested_points = max( 1, (int) ( $req->get_param( 'travel_points' ) ?: 1 ) );
		$available_points = max( 0, (int) ( $unlock_state['fast_travel_points_available'] ?? 0 ) );
		if ( $available_points <= 0 ) {
			return self::message( 'No fast travel points are available for this destination right now.', 409 );
		}

		$points_to_apply = min( $requested_points, $available_points );
		$gold_cost       = $points_to_apply * self::FAST_TRAVEL_GOLD_COST;
		$current_gold    = max( 0, (int) ( $profile['gold'] ?? 0 ) );

		if ( $current_gold < $gold_cost ) {
			$gold_shortfall = max( 0, $gold_cost - $current_gold );
			$message        = sprintf(
				'You need %1$d more gold to buy %2$d travel point%3$s.',
				$gold_shortfall,
				$points_to_apply,
				1 === $points_to_apply ? '' : 's'
			);

			return self::response(
				[
					'applied'        => false,
					'reason'         => 'insufficient_gold',
					'message'        => $message,
					'gold_required'  => $gold_cost,
					'gold_available' => $current_gold,
					'gold_shortfall' => $gold_shortfall,
					'profile'        => $profile,
					'route_state'    => $route_state,
				]
				,
				409
			);
		}

		$existing_fast_travel_points = self::fast_travel_points_used_for_location( $user_id, $location_slug );
		$record                      = IronQuestRewardService::upsert_activity_award(
			$user_id,
			'route_progress',
			self::fast_travel_source_key( $location_slug ),
			'travel_points',
			[
				'points'               => $existing_fast_travel_points + $points_to_apply,
				'fast_travel'          => true,
				'location_slug'        => $location_slug,
				'gold_spent_total'     => ( $existing_fast_travel_points + $points_to_apply ) * self::FAST_TRAVEL_GOLD_COST,
				'last_gold_spent'      => $gold_cost,
				'travel_points_bought' => $points_to_apply,
			]
		);

		if ( is_wp_error( $record ) ) {
			return self::message( $record->get_error_message(), 500 );
		}

		$profile    = IronQuestProfileService::update_progression( $user_id, 0, -$gold_cost );
		$route_sync = self::sync_route_progression( $user_id );

		return self::response(
			[
				'applied'          => true,
				'location_slug'    => $location_slug,
				'travel_points'    => $points_to_apply,
				'gold_spent'       => $gold_cost,
				'profile'          => $profile,
				'route_state'      => $route_sync['route_state'],
				'route_changes'    => $route_sync['route_changes'],
				'recent_unlocks'   => array_slice( IronQuestRewardService::list_unlocks( $user_id ), 0, 6 ),
			]
		);
	}

	public static function travel_to_location( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		if ( ! IronQuestEntitlementService::user_has_access( $user_id ) ) {
			return self::message( 'IronQuest is not enabled for this account.', 403 );
		}

		$profile = IronQuestProfileService::ensure_profile( $user_id );
		if ( empty( $profile['enabled'] ) ) {
			return self::message( 'IronQuest mode is turned off for this profile.', 409 );
		}

		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: '' ) );
		if ( '' === $location_slug ) {
			return self::message( 'A destination location is required.', 400 );
		}

		$location = IronQuestRegistryService::get_location( $location_slug );
		if ( empty( $location ) ) {
			return self::message( 'That IronQuest region does not exist.', 404 );
		}

		$route_state        = self::build_route_state( $user_id, $profile );
		$unlocked_locations = array_values( array_filter( array_map( 'sanitize_key', (array) ( $route_state['unlocked_locations'] ?? [] ) ) ) );
		if ( ! in_array( $location_slug, $unlocked_locations, true ) ) {
			return self::message( 'That region is not unlocked yet.', 409 );
		}

		$current_location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$mission_slug          = $current_location_slug === $location_slug
			? sanitize_key( (string) ( $profile['active_mission_slug'] ?? '' ) )
			: '';

		if ( '' === $mission_slug || empty( self::find_location_mission( $location_slug, $mission_slug ) ) ) {
			$mission_slug = self::resolve_default_mission_slug( $location_slug, '' );
		}

		IronQuestProfileService::set_location_and_mission( $user_id, $location_slug, $mission_slug );

		return self::response(
			[
				'traveled'      => true,
				'location_slug' => $location_slug,
				'message'       => sprintf( 'Traveled to %s.', (string) ( $location['name'] ?? $location_slug ) ),
			] + self::build_profile_payload( $user_id )
		);
	}

	public static function admin_grant_travel_points( int $user_id, int $travel_points, string $travel_source = '', ?string $state_date = null ): array {
		$travel_points  = max( 0, $travel_points );
		$travel_source  = sanitize_key( $travel_source );
		$travel_source  = '' !== $travel_source ? $travel_source : sanitize_key( sprintf( 'admin_manual_%s', wp_generate_uuid4() ) );
		$previous_state = IronQuestDailyStateService::get_state( $user_id, $state_date ?: null );
		$next_state     = IronQuestDailyStateService::sync_travel_points_source(
			$user_id,
			$travel_source,
			$travel_points,
			$state_date ?: null
		);

		IronQuestRewardService::upsert_activity_award(
			$user_id,
			'route_progress',
			$travel_source,
			'travel_points',
			[
				'points'     => $travel_points,
				'state_date' => (string) ( $next_state['state_date'] ?? ( $state_date ?: '' ) ),
				'source'     => 'admin_manual',
			]
		);

		$route_sync = self::sync_route_progression( $user_id );

		return [
			'daily_state'    => $next_state,
			'changes'        => self::build_daily_progress_changes( $previous_state, $next_state ),
			'route_state'    => $route_sync['route_state'],
			'route_changes'  => $route_sync['route_changes'],
			'profile'        => IronQuestProfileService::get_profile( $user_id ),
			'travel_source'  => $travel_source,
		];
	}

	public static function admin_resolve_active_mission( int $user_id, string $result_band = 'victory', int $xp_awarded = 0, int $gold_awarded = 0 ): array|\WP_Error {
		$run = IronQuestMissionService::get_active_run( $user_id );
		if ( empty( $run['id'] ) ) {
			return new \WP_Error( 'ironquest_no_active_mission', 'No active IronQuest mission is available for this user.' );
		}

		return self::resolve_mission_run( $user_id, (int) $run['id'], $result_band, $xp_awarded, $gold_awarded );
	}

	public static function admin_start_mission( int $user_id, string $location_slug = '', string $mission_slug = '', string $run_type = 'workout', string $source_session_id = '' ): array|\WP_Error {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$location_slug = sanitize_key( $location_slug ?: (string) ( $profile['current_location_slug'] ?? '' ) );
		$mission_slug  = sanitize_key( $mission_slug );
		$run_type      = sanitize_key( $run_type ?: 'workout' );

		if ( '' === $location_slug ) {
			return new \WP_Error( 'ironquest_location_required', 'An IronQuest location is required to start a mission.' );
		}

		if ( '' === $mission_slug ) {
			$mission_slug = self::resolve_selected_or_default_mission_slug( $profile, $location_slug, $run_type );
		}

		if ( '' === $mission_slug ) {
			return new \WP_Error( 'ironquest_mission_required', 'No IronQuest mission is available for the requested location.' );
		}

		$run = IronQuestMissionService::start_run( $user_id, $mission_slug, $location_slug, $run_type, $source_session_id );
		if ( is_wp_error( $run ) ) {
			return $run;
		}

		return [
			'run'      => $run,
			'profile'  => IronQuestProfileService::get_profile( $user_id ),
			'location' => IronQuestRegistryService::get_location( $location_slug ),
			'mission'  => self::find_location_mission( $location_slug, $mission_slug ),
		];
	}

	public static function admin_clear_location_arc( int $user_id, string $location_slug, int $source_run_id = 0 ): array {
		self::clear_location_arc( $user_id, $location_slug, $source_run_id );
		$route_sync = self::sync_route_progression( $user_id );

		return [
			'route_state'   => $route_sync['route_state'],
			'route_changes' => $route_sync['route_changes'],
			'profile'       => IronQuestProfileService::get_profile( $user_id ),
		];
	}

	public static function admin_unlock_location( int $user_id, string $location_slug, int $source_run_id = 0 ): array {
		$location_slug       = sanitize_key( $location_slug );
		$travel_requirement  = self::location_travel_requirement(
			$location_slug,
			array_values( IronQuestRegistryService::get_locations_config()['locations'] ?? [] )
		);
		self::unlock_location_for_user( $user_id, $location_slug, $source_run_id, $travel_requirement );
		$route_sync = self::sync_route_progression( $user_id );

		return [
			'route_state'   => $route_sync['route_state'],
			'route_changes' => $route_sync['route_changes'],
			'profile'       => IronQuestProfileService::get_profile( $user_id ),
		];
	}

	public static function admin_jump_location( int $user_id, string $location_slug ): array {
		$location_slug = sanitize_key( $location_slug );
		$mission_slug  = self::resolve_default_mission_slug( $location_slug, '' );
		$profile       = IronQuestProfileService::set_location_and_mission( $user_id, $location_slug, $mission_slug );
		$route_sync    = self::sync_route_progression( $user_id );

		return [
			'profile'       => $profile,
			'route_state'   => $route_sync['route_state'],
			'route_changes' => $route_sync['route_changes'],
		];
	}

	private static function build_profile_payload( int $user_id ): array {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$route_state   = self::build_route_state( $user_id, $profile );
		$unlock_history = array_slice( IronQuestRewardService::list_unlocks( $user_id ), 0, 24 );
		$location      = $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : null;
		$missions      = $location_slug ? IronQuestRegistryService::get_location_missions( $location_slug ) : [];
		$active_run    = IronQuestMissionService::get_active_run( $user_id );
		$daily_state   = IronQuestDailyStateService::get_state( $user_id );

		return [
			'entitlement' => IronQuestEntitlementService::get_access_state( $user_id ),
			'profile'     => $profile,
			'location'    => $location,
			'missions'    => $missions,
			'mission_board' => self::build_mission_board( $profile, $missions, $daily_state, $active_run ),
			'active_run'  => $active_run,
			'story_state' => self::get_story_state_for_run( $user_id, $active_run ),
			'daily_state' => $daily_state,
			'recent_unlocks' => array_slice( $unlock_history, 0, 6 ),
			'unlock_history' => $unlock_history,
			'route_state' => $route_state,
			'character_sheet' => self::build_character_sheet_payload( $profile, is_array( $location ) ? $location : [], $route_state, $daily_state, $unlock_history, $active_run ),
			'store' => self::build_store_payload( $profile, is_array( $location ) ? $location : [], $daily_state, $unlock_history, $active_run ),
		];
	}

	private static function build_character_sheet_payload( array $profile, array $location, array $route_state, array $daily_state, array $unlock_history, ?array $active_run ): array {
		$title_unlocks = array_values( array_filter( $unlock_history, static fn( array $unlock ): bool => ( $unlock['unlock_type'] ?? '' ) === 'title' ) );
		$relic_unlocks = array_values( array_filter( $unlock_history, static fn( array $unlock ): bool => ( $unlock['unlock_type'] ?? '' ) === 'relic' ) );
		$journal_unlocks = array_values( array_filter( $unlock_history, static fn( array $unlock ): bool => ( $unlock['unlock_type'] ?? '' ) === 'journal_entry' ) );
		$inventory_state = self::build_character_sheet_inventory_summary( $title_unlocks, $relic_unlocks, $daily_state );
		$display_title = self::resolve_character_sheet_display_title( $title_unlocks[0] ?? null );
		$selected_mission_slug = sanitize_key( (string) ( $profile['active_mission_slug'] ?? '' ) );
		$selected_mission_name = '';

		if ( '' !== $selected_mission_slug ) {
			$selected_mission_name = (string) ( self::find_location_mission( (string) ( $profile['current_location_slug'] ?? '' ), $selected_mission_slug )['name'] ?? self::humanize_key( $selected_mission_slug ) );
		}

		return [
			'identity' => [
				'portrait_attachment_id' => (int) ( $profile['starter_portrait_attachment_id'] ?? 0 ),
				'display_title'         => $display_title,
				'class_slug'            => sanitize_key( (string) ( $profile['class_slug'] ?? '' ) ),
				'motivation_slug'       => sanitize_key( (string) ( $profile['motivation_slug'] ?? '' ) ),
			],
			'progression' => [
				'level'      => max( 1, (int) ( $profile['level'] ?? 1 ) ),
				'xp'         => max( 0, (int) ( $profile['xp'] ?? 0 ) ),
				'hp_current' => max( 0, (int) ( $profile['hp_current'] ?? 0 ) ),
				'hp_max'     => max( 1, (int) ( $profile['hp_max'] ?? 100 ) ),
				'gold'       => max( 0, (int) ( $profile['gold'] ?? 0 ) ),
			],
			'campaign' => [
				'current_location_slug' => sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) ),
				'current_location_name' => (string) ( $location['name'] ?? self::humanize_key( (string) ( $profile['current_location_slug'] ?? '' ) ) ),
				'selected_mission_slug' => $selected_mission_slug,
				'selected_mission_name' => $selected_mission_name,
				'route_progress_label'  => self::build_character_sheet_route_progress_label( $route_state ),
				'tavern_name'           => (string) ( $location['tavern']['name'] ?? '' ),
				'store_name'            => self::resolve_store_name( $location ),
			],
			'active_effects' => self::build_character_sheet_active_effects( $daily_state, $active_run ),
			'inventory_summary' => $inventory_state,
			'collections' => [
				'titles'  => array_values( array_map( [ __CLASS__, 'build_character_sheet_unlock_entry' ], array_slice( $title_unlocks, 0, 6 ) ) ),
				'relics'  => array_values( array_map( [ __CLASS__, 'build_character_sheet_unlock_entry' ], array_slice( $relic_unlocks, 0, 6 ) ) ),
				'journal' => array_values( array_map( [ __CLASS__, 'build_character_sheet_unlock_entry' ], array_slice( $journal_unlocks, 0, 6 ) ) ),
			],
			'recent_history' => array_values( array_map( [ __CLASS__, 'build_character_sheet_unlock_entry' ], array_slice( $unlock_history, 0, 4 ) ) ),
		];
	}

	private static function build_character_sheet_inventory_summary( array $title_unlocks, array $relic_unlocks, array $daily_state ): array {
		$equipped_relics = array_values( array_map( [ __CLASS__, 'build_character_sheet_unlock_entry' ], array_slice( $relic_unlocks, 0, 2 ) ) );
		$consumables     = self::extract_store_inventory_consumables( $daily_state );
		$display_title   = self::resolve_character_sheet_display_title( $title_unlocks[0] ?? null );

		return [
			'active_relics'    => count( $equipped_relics ),
			'relic_count'      => count( $relic_unlocks ),
			'consumable_count' => count( $consumables ),
			'equipped_title'   => $display_title,
			'equipped_relics'  => $equipped_relics,
			'consumables'      => $consumables,
		];
	}

	private static function resolve_character_sheet_display_title( ?array $unlock ): string {
		if ( ! is_array( $unlock ) ) {
			return '';
		}

		$label = trim( (string) ( $unlock['meta']['label'] ?? '' ) );

		return '' !== $label ? $label : self::humanize_key( (string) ( $unlock['unlock_key'] ?? '' ) );
	}

	private static function build_character_sheet_route_progress_label( array $route_state ): string {
		$next_unlock = is_array( $route_state['next_unlocks'][0] ?? null ) ? $route_state['next_unlocks'][0] : null;
		if ( ! is_array( $next_unlock ) ) {
			return 'Current route fully unlocked.';
		}

		$travel_remaining = max( 0, (int) ( $next_unlock['travel_remaining'] ?? 0 ) );
		$location_name    = self::humanize_key( (string) ( $next_unlock['location_slug'] ?? '' ) );

		return sprintf( '%d route point%s to %s.', $travel_remaining, 1 === $travel_remaining ? '' : 's', $location_name );
	}

	private static function build_character_sheet_active_effects( array $daily_state, ?array $active_run ): array {
		$effects = [];
		$tavern_resolution = self::extract_tavern_resolution( $daily_state );
		$store_inventory   = self::extract_store_inventory_state( $daily_state );

		if ( is_array( $tavern_resolution ) ) {
			$action_id = sanitize_key( (string) ( $tavern_resolution['action_id'] ?? '' ) );
			$effect_data = is_array( $tavern_resolution['effects'] ?? null ) ? $tavern_resolution['effects'] : [];
			$effect_parts = [];

			if ( ! empty( $effect_data['hp_delta'] ) ) {
				$effect_parts[] = sprintf( '+%d HP', (int) $effect_data['hp_delta'] );
			}
			if ( ! empty( $effect_data['gold_delta'] ) ) {
				$effect_parts[] = sprintf( '+%d gold', (int) $effect_data['gold_delta'] );
			}
			if ( ! empty( $effect_data['xp_delta'] ) ) {
				$effect_parts[] = sprintf( '+%d XP', (int) $effect_data['xp_delta'] );
			}
			if ( ! empty( $effect_data['mission_preview'] ) ) {
				$effect_parts[] = 'mission preview ready';
			}

			$effects[] = [
				'id'             => 'tavern_' . ( $action_id ?: 'action' ),
				'label'          => 'Tavern: ' . self::humanize_key( $action_id ?: 'action' ),
				'effect_summary' => ! empty( $effect_parts ) ? implode( ' • ', $effect_parts ) : 'Tavern action resolved today.',
			];
		}

		if ( is_array( $active_run ) && ! empty( $active_run['mission_slug'] ) ) {
			$effects[] = [
				'id'             => 'active_mission',
				'label'          => 'Mission in progress',
				'effect_summary' => self::humanize_key( (string) $active_run['mission_slug'] ) . ' is still active.',
			];
		}

		$active_charm = is_array( $store_inventory['active_charm'] ?? null ) ? $store_inventory['active_charm'] : null;
		if ( is_array( $active_charm ) ) {
			$effects[] = [
				'id'             => 'store_charm_' . sanitize_key( (string) ( $active_charm['id'] ?? 'active' ) ),
				'label'          => (string) ( $active_charm['name'] ?? 'Store charm' ),
				'effect_summary' => (string) ( $active_charm['effect_summary'] ?? 'Store effect active.' ),
			];
		}

		$active_prep = is_array( $store_inventory['active_prep'] ?? null ) ? $store_inventory['active_prep'] : null;
		if ( is_array( $active_prep ) ) {
			$effects[] = [
				'id'             => 'store_prep_' . sanitize_key( (string) ( $active_prep['id'] ?? 'active' ) ),
				'label'          => (string) ( $active_prep['name'] ?? 'Mission prep' ),
				'effect_summary' => (string) ( $active_prep['effect_summary'] ?? 'Prep item active for the next mission.' ),
			];
		}

		return $effects;
	}

	private static function build_store_payload( array $profile, array $location, array $daily_state, array $unlock_history, ?array $active_run ): array {
		$location_slug    = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$inventory_state  = self::extract_store_inventory_state( $daily_state );
		$sections         = self::build_store_sections( $location_slug, $location );
		$recommended_item = self::build_store_recommended_purchase( $profile, $sections, $active_run );
		$relic_count      = count( array_filter( $unlock_history, static fn( array $unlock ): bool => ( $unlock['unlock_type'] ?? '' ) === 'relic' ) );

		return [
			'location_slug'        => $location_slug,
			'location_name'        => (string) ( $location['name'] ?? self::humanize_key( $location_slug ) ),
			'store_name'           => self::resolve_store_name( $location ),
			'gold'                 => max( 0, (int) ( $profile['gold'] ?? 0 ) ),
			'hp_current'           => max( 0, (int) ( $profile['hp_current'] ?? 0 ) ),
			'hp_max'               => max( 1, (int) ( $profile['hp_max'] ?? 100 ) ),
			'recommended_purchase' => $recommended_item,
			'sections'             => $sections,
			'inventory'            => [
				'consumables' => self::extract_store_inventory_consumables( $daily_state ),
				'active_charm' => is_array( $inventory_state['active_charm'] ?? null ) ? $inventory_state['active_charm'] : null,
				'active_prep' => is_array( $inventory_state['active_prep'] ?? null ) ? $inventory_state['active_prep'] : null,
				'sellback'    => self::build_store_sellback_entries( $daily_state, $sections ),
				'relic_count' => $relic_count,
			],
		];
	}

	private static function apply_store_purchase( int $user_id, string $item_id, ?string $state_date = null ): array|WP_Error {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$daily_state   = IronQuestDailyStateService::get_state( $user_id, $state_date );
		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$location      = $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : [];
		$sections      = self::build_store_sections( $location_slug, is_array( $location ) ? $location : [] );
		$item          = self::find_store_item( $sections, $item_id );

		if ( ! is_array( $item ) ) {
			return new WP_Error( 'invalid_item', 'That store item is not available in this region right now.' );
		}

		$gold_available = max( 0, (int) ( $profile['gold'] ?? 0 ) );
		$gold_cost      = max( 0, (int) ( $item['cost_gold'] ?? 0 ) );
		if ( $gold_available < $gold_cost ) {
			return new WP_Error( 'insufficient_gold', 'You do not have enough gold for that purchase yet.' );
		}

		$store_state = self::extract_store_inventory_state( $daily_state );
		$category    = sanitize_key( (string) ( $item['category'] ?? '' ) );

		if ( 'utility_charms' === $category ) {
			$active_charm = is_array( $store_state['active_charm'] ?? null ) ? $store_state['active_charm'] : null;
			if ( is_array( $active_charm ) && sanitize_key( (string) ( $active_charm['id'] ?? '' ) ) === $item_id ) {
				return new WP_Error( 'already_owned', 'That charm is already active.' );
			}
			$store_state['active_charm'] = [
				'id'             => $item_id,
				'name'           => (string) ( $item['name'] ?? self::humanize_key( $item_id ) ),
				'effect_summary' => (string) ( $item['effect_summary'] ?? '' ),
				'category'       => $category,
				'purchased_at'   => current_time( 'mysql' ),
			];
		} else {
			$consumables = is_array( $store_state['consumables'] ?? null ) ? $store_state['consumables'] : [];
			$matched     = false;
			foreach ( $consumables as &$consumable ) {
				if ( ! is_array( $consumable ) || sanitize_key( (string) ( $consumable['id'] ?? '' ) ) !== $item_id ) {
					continue;
				}

				$consumable['quantity'] = max( 1, (int) ( $consumable['quantity'] ?? 1 ) + 1 );
				$matched = true;
				break;
			}
			unset( $consumable );

			if ( ! $matched ) {
				$item_definition = self::find_store_catalog_item( $item_id );
				$consumables[] = [
					'id'             => $item_id,
					'name'           => (string) ( $item['name'] ?? self::humanize_key( $item_id ) ),
					'effect_summary' => (string) ( $item['effect_summary'] ?? '' ),
					'quantity'       => 1,
					'category'       => $category,
					'use_effect'     => is_array( $item_definition['use_effect'] ?? null ) ? $item_definition['use_effect'] : [],
					'purchased_at'   => current_time( 'mysql' ),
				];
			}

			$store_state['consumables'] = array_values( $consumables );
		}

		$updated_profile = IronQuestProfileService::update_progression( $user_id, 0, -$gold_cost );
		$updated_daily   = IronQuestDailyStateService::upsert_state(
			$user_id,
			(string) ( $daily_state['state_date'] ?? $state_date ?? '' ),
			[
				'bonus_state_json' => array_merge(
					is_array( $daily_state['bonus_state'] ?? null ) ? $daily_state['bonus_state'] : [],
					[ 'store' => $store_state ]
				),
			]
		);

		$payload = self::build_profile_payload( $user_id );

		return [
			'purchased'   => true,
			'item_id'     => $item_id,
			'item'        => [
				'id'             => $item_id,
				'name'           => (string) ( $item['name'] ?? self::humanize_key( $item_id ) ),
				'effect_summary' => (string) ( $item['effect_summary'] ?? '' ),
				'category'       => $category,
				'cost_gold'      => $gold_cost,
			],
			'gold_spent'   => $gold_cost,
			'profile'      => $updated_profile,
			'daily_state'  => $updated_daily,
			'store'        => $payload['store'] ?? [],
			'character_sheet' => $payload['character_sheet'] ?? [],
		];
	}

	private static function apply_store_item_use( int $user_id, string $item_id, ?string $state_date = null ): array|WP_Error {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$daily_state   = IronQuestDailyStateService::get_state( $user_id, $state_date );
		$store_state   = self::extract_store_inventory_state( $daily_state );
		$consumables   = is_array( $store_state['consumables'] ?? null ) ? array_values( $store_state['consumables'] ) : [];
		$item_id       = sanitize_key( $item_id );
		$matched_index = null;
		$matched_item  = null;

		foreach ( $consumables as $index => $consumable ) {
			if ( ! is_array( $consumable ) || sanitize_key( (string) ( $consumable['id'] ?? '' ) ) !== $item_id ) {
				continue;
			}

			$matched_index = $index;
			$matched_item  = $consumable;
			break;
		}

		if ( ! is_array( $matched_item ) || null === $matched_index ) {
			return new WP_Error( 'invalid_item', 'That consumable is not currently in your inventory.' );
		}

		$effect = self::resolve_store_item_use_effect( $matched_item, $profile, $store_state );
		if ( is_wp_error( $effect ) ) {
			return $effect;
		}

		$consumables[ $matched_index ]['quantity'] = max( 0, (int) ( $consumables[ $matched_index ]['quantity'] ?? 1 ) - 1 );
		if ( (int) $consumables[ $matched_index ]['quantity'] <= 0 ) {
			array_splice( $consumables, $matched_index, 1 );
		}

		$store_state['consumables'] = array_values( $consumables );
		if ( ! empty( $effect['active_prep'] ) ) {
			$store_state['active_prep'] = $effect['active_prep'];
		}

		$updated_profile = $profile;
		if ( ! empty( $effect['hp_delta'] ) ) {
			$updated_profile = IronQuestProfileService::set_hp(
				$user_id,
				max( 0, (int) ( $profile['hp_current'] ?? 0 ) ) + (int) $effect['hp_delta'],
				(int) ( $profile['hp_max'] ?? 100 )
			);
		}

		$updated_daily = IronQuestDailyStateService::upsert_state(
			$user_id,
			(string) ( $daily_state['state_date'] ?? $state_date ?? '' ),
			[
				'bonus_state_json' => array_merge(
					is_array( $daily_state['bonus_state'] ?? null ) ? $daily_state['bonus_state'] : [],
					[ 'store' => $store_state ]
				),
			]
		);

		$payload = self::build_profile_payload( $user_id );

		return [
			'used'            => true,
			'item_id'         => $item_id,
			'item'            => self::build_store_inventory_entry_for_response( $matched_item ),
			'hp_restored'     => max( 0, (int) ( $effect['hp_delta'] ?? 0 ) ),
			'active_prep'     => is_array( $effect['active_prep'] ?? null ) ? $effect['active_prep'] : null,
			'profile'         => $updated_profile,
			'daily_state'     => $updated_daily,
			'store'           => $payload['store'] ?? [],
			'character_sheet' => $payload['character_sheet'] ?? [],
		];
	}

	private static function apply_store_item_sellback( int $user_id, string $item_id, ?string $state_date = null ): array|WP_Error {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$daily_state   = IronQuestDailyStateService::get_state( $user_id, $state_date );
		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$location      = $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : [];
		$sections      = self::build_store_sections( $location_slug, is_array( $location ) ? $location : [] );
		$store_state   = self::extract_store_inventory_state( $daily_state );
		$consumables   = is_array( $store_state['consumables'] ?? null ) ? array_values( $store_state['consumables'] ) : [];
		$item_id       = sanitize_key( $item_id );
		$matched_index = null;
		$matched_item  = null;

		foreach ( $consumables as $index => $consumable ) {
			if ( ! is_array( $consumable ) || sanitize_key( (string) ( $consumable['id'] ?? '' ) ) !== $item_id ) {
				continue;
			}

			$matched_index = $index;
			$matched_item  = $consumable;
			break;
		}

		if ( ! is_array( $matched_item ) || null === $matched_index ) {
			return new WP_Error( 'invalid_item', 'That inventory item is not available to sell back.' );
		}

		$sell_value = self::resolve_store_sell_value( $item_id, $sections );
		$consumables[ $matched_index ]['quantity'] = max( 0, (int) ( $consumables[ $matched_index ]['quantity'] ?? 1 ) - 1 );
		if ( (int) $consumables[ $matched_index ]['quantity'] <= 0 ) {
			array_splice( $consumables, $matched_index, 1 );
		}

		$store_state['consumables'] = array_values( $consumables );
		$updated_profile = IronQuestProfileService::update_progression( $user_id, 0, $sell_value );
		$updated_daily = IronQuestDailyStateService::upsert_state(
			$user_id,
			(string) ( $daily_state['state_date'] ?? $state_date ?? '' ),
			[
				'bonus_state_json' => array_merge(
					is_array( $daily_state['bonus_state'] ?? null ) ? $daily_state['bonus_state'] : [],
					[ 'store' => $store_state ]
				),
			]
		);

		$payload = self::build_profile_payload( $user_id );

		return [
			'sold'            => true,
			'item_id'         => $item_id,
			'item'            => self::build_store_inventory_entry_for_response( $matched_item ),
			'gold_gained'     => $sell_value,
			'profile'         => $updated_profile,
			'daily_state'     => $updated_daily,
			'store'           => $payload['store'] ?? [],
			'character_sheet' => $payload['character_sheet'] ?? [],
		];
	}

	private static function resolve_store_name( array $location ): string {
		$store_name = trim( (string) ( $location['store']['name'] ?? '' ) );

		if ( '' !== $store_name ) {
			return $store_name;
		}

		$location_name = trim( (string) ( $location['name'] ?? '' ) );

		return '' !== $location_name ? $location_name . ' Goods' : 'General Store';
	}

	private static function build_store_sections( string $location_slug, array $location ): array {
		$stock_config = is_array( $location['store']['stock'] ?? null ) ? $location['store']['stock'] : [];
		$defaults     = [
			'recovery_goods' => [ 'field_bandage', 'hot_meal_kit' ],
			'mission_prep'   => [ 'scouting_map', 'basic_supplies' ],
			'utility_charms' => [ 'coin_charm', 'ward_thread' ],
		];

		return [
			'recovery_goods'    => self::build_store_stock_entries( $stock_config['recovery_goods'] ?? $defaults['recovery_goods'], 'recovery_goods' ),
			'mission_prep'      => self::build_store_stock_entries( $stock_config['mission_prep'] ?? $defaults['mission_prep'], 'mission_prep' ),
			'utility_charms'    => self::build_store_stock_entries( $stock_config['utility_charms'] ?? $defaults['utility_charms'], 'utility_charms' ),
			'inventory_sellback' => [],
		];
	}

	private static function build_store_stock_entries( array $item_ids, string $category ): array {
		$entries = [];

		foreach ( $item_ids as $item_id ) {
			$item = self::find_store_catalog_item( (string) $item_id );
			if ( ! is_array( $item ) ) {
				continue;
			}

			if ( sanitize_key( (string) ( $item['category'] ?? '' ) ) !== sanitize_key( $category ) ) {
				continue;
			}

			$entries[] = [
				'id'             => sanitize_key( (string) ( $item['id'] ?? '' ) ),
				'category'       => sanitize_key( (string) ( $item['category'] ?? $category ) ),
				'name'           => (string) ( $item['name'] ?? self::humanize_key( (string) $item_id ) ),
				'description'    => (string) ( $item['description'] ?? '' ),
				'effect_summary' => (string) ( $item['effect_summary'] ?? '' ),
				'cost_gold'      => max( 0, (int) ( $item['cost_gold'] ?? 0 ) ),
				'available'      => ! array_key_exists( 'available', $item ) || ! empty( $item['available'] ),
			];
		}

		return array_values( $entries );
	}

	private static function find_store_catalog_item( string $item_id ): ?array {
		$item_id = sanitize_key( $item_id );
		if ( '' === $item_id ) {
			return null;
		}

		foreach ( IronQuestRegistryService::get_store_items_config()['items'] as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			if ( sanitize_key( (string) ( $item['id'] ?? '' ) ) === $item_id ) {
				return $item;
			}
		}

		return null;
	}

	private static function find_store_item( array $sections, string $item_id ): ?array {
		$item_id = sanitize_key( $item_id );
		foreach ( $sections as $section_key => $items ) {
			foreach ( (array) $items as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}

				if ( sanitize_key( (string) ( $item['id'] ?? '' ) ) !== $item_id ) {
					continue;
				}

				$item['category'] = sanitize_key( (string) ( $item['category'] ?? $section_key ) );

				return $item;
			}
		}

		return null;
	}

	private static function resolve_store_item_use_effect( array $item, array $profile, array $store_state ): array|WP_Error {
		$item_id    = sanitize_key( (string) ( $item['id'] ?? '' ) );
		$current_hp = max( 0, (int) ( $profile['hp_current'] ?? 0 ) );
		$hp_max     = max( 1, (int) ( $profile['hp_max'] ?? 100 ) );
		$definition = self::find_store_catalog_item( $item_id );
		$use_effect = is_array( $item['use_effect'] ?? null ) && ! empty( $item['use_effect'] )
			? $item['use_effect']
			: ( is_array( $definition['use_effect'] ?? null ) ? $definition['use_effect'] : [] );
		$effect_type = sanitize_key( (string) ( $use_effect['type'] ?? '' ) );

		if ( 'restore_hp' === $effect_type ) {
			$hp_restore = max( 0, (int) ( $use_effect['hp_restore'] ?? 0 ) );
			if ( $current_hp >= $hp_max ) {
				return new WP_Error( 'hp_full', 'HP is already full. Save that recovery item for a rougher day.' );
			}

			return [
				'hp_delta' => min( $hp_restore, $hp_max - $current_hp ),
			];
		}

		if ( 'activate_prep' === $effect_type ) {
			if ( is_array( $store_state['active_prep'] ?? null ) ) {
				return new WP_Error( 'already_prepped', 'A prep item is already active for the next mission.' );
			}

			return [
				'active_prep' => [
					'id'             => $item_id,
					'name'           => (string) ( $item['name'] ?? $definition['name'] ?? self::humanize_key( $item_id ) ),
					'effect_summary' => (string) ( $use_effect['active_effect_summary'] ?? $item['effect_summary'] ?? '' ),
				],
			];
		}

		return new WP_Error( 'invalid_item', 'That item cannot be used from inventory right now.' );
	}

	private static function build_store_sellback_entries( array $daily_state, array $sections ): array {
		$consumables = self::extract_store_inventory_consumables( $daily_state );

		return array_values(
			array_map(
				static function ( array $item ) use ( $sections ): array {
					$item_id = sanitize_key( (string) ( $item['id'] ?? '' ) );
					return array_merge(
						$item,
						[
							'sell_value' => self::resolve_store_sell_value( $item_id, $sections ),
						]
					);
				},
				$consumables
			)
		);
	}

	private static function resolve_store_sell_value( string $item_id, array $sections ): int {
		$item = self::find_store_item( $sections, $item_id );
		if ( ! is_array( $item ) ) {
			$item = self::find_store_catalog_item( $item_id );
		}
		$cost = max( 0, (int) ( $item['cost_gold'] ?? 0 ) );

		return max( 1, (int) floor( $cost / 2 ) );
	}

	private static function build_store_inventory_entry_for_response( array $item ): array {
		return [
			'id'             => sanitize_key( (string) ( $item['id'] ?? '' ) ),
			'name'           => (string) ( $item['name'] ?? self::humanize_key( (string) ( $item['id'] ?? 'item' ) ) ),
			'effect_summary' => (string) ( $item['effect_summary'] ?? '' ),
			'quantity'       => max( 1, (int) ( $item['quantity'] ?? 1 ) ),
		];
	}

	private static function build_store_recommended_purchase( array $profile, array $sections, ?array $active_run ): array {
		$hp_current = max( 0, (int) ( $profile['hp_current'] ?? 0 ) );
		$hp_max     = max( 1, (int) ( $profile['hp_max'] ?? 100 ) );
		$gold       = max( 0, (int) ( $profile['gold'] ?? 0 ) );

		if ( $hp_current <= (int) floor( $hp_max * 0.45 ) ) {
			$item = $sections['recovery_goods'][0] ?? [];

			return [
				'item_id' => (string) ( $item['id'] ?? 'field_bandage' ),
				'label'   => 'You are running light on HP. Patch up before the next push.',
			];
		}

		if ( is_array( $active_run ) && ! empty( $active_run['mission_slug'] ) ) {
			$item = $sections['mission_prep'][0] ?? [];

			return [
				'item_id' => (string) ( $item['id'] ?? 'scouting_map' ),
				'label'   => 'You already have a mission running. Buy prep that helps the next one, not more noise right now.',
			];
		}

		if ( $gold >= 25 ) {
			$item = $sections['utility_charms'][0] ?? [];

			return [
				'item_id' => (string) ( $item['id'] ?? 'coin_charm' ),
				'label'   => 'You have enough gold to make the next mission pay back better.',
			];
		}

		$item = $sections['recovery_goods'][1] ?? $sections['recovery_goods'][0] ?? [];

		return [
			'item_id' => (string) ( $item['id'] ?? 'hot_meal_kit' ),
			'label'   => 'Keep it simple. Buy the next small thing that makes tomorrow feel easier.',
		];
	}

	private static function extract_store_inventory_state( array $daily_state ): array {
		$bonus_state = is_array( $daily_state['bonus_state'] ?? null ) ? $daily_state['bonus_state'] : [];
		$store_state = is_array( $bonus_state['store'] ?? null ) ? $bonus_state['store'] : [];

		return $store_state;
	}

	private static function extract_store_inventory_consumables( array $daily_state ): array {
		$store_state  = self::extract_store_inventory_state( $daily_state );
		$consumables  = is_array( $store_state['consumables'] ?? null ) ? $store_state['consumables'] : [];

		return array_values(
			array_filter(
				array_map(
					static function ( mixed $item ): ?array {
						if ( ! is_array( $item ) ) {
							return null;
						}

						return [
							'id'             => sanitize_key( (string) ( $item['id'] ?? '' ) ),
							'name'           => (string) ( $item['name'] ?? self::humanize_key( (string) ( $item['id'] ?? 'consumable' ) ) ),
							'effect_summary' => (string) ( $item['effect_summary'] ?? '' ),
							'category'       => sanitize_key( (string) ( $item['category'] ?? '' ) ),
							'quantity'       => max( 1, (int) ( $item['quantity'] ?? 1 ) ),
						];
					},
					$consumables
				)
			)
		);
	}

	private static function build_character_sheet_unlock_entry( array $unlock ): array {
		$label = trim( (string) ( $unlock['meta']['label'] ?? '' ) );
		if ( '' === $label ) {
			$label = self::humanize_key( (string) ( $unlock['unlock_key'] ?? $unlock['unlock_type'] ?? 'entry' ) );
		}

		$subtitle = trim( (string) ( $unlock['meta']['description'] ?? '' ) );
		if ( '' === $subtitle ) {
			$subtitle = ! empty( $unlock['source_run_id'] )
				? sprintf( 'Granted from mission run %d.', (int) $unlock['source_run_id'] )
				: 'Recorded in the IronQuest ledger.';
		}

		return [
			'id'         => (string) ( $unlock['id'] ?? '' ),
			'label'      => $label,
			'subtitle'   => $subtitle,
			'created_at' => (string) ( $unlock['created_at'] ?? '' ),
		];
	}

	private static function build_tavern_state( int $user_id, ?string $state_date = null ): array {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$date          = is_string( $state_date ) && '' !== $state_date ? $state_date : null;
		$daily_state   = IronQuestDailyStateService::get_state( $user_id, $date );
		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$location      = $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : [];
		$tavern        = is_array( $location['tavern'] ?? null ) ? $location['tavern'] : [];
		$resolved      = self::extract_tavern_resolution( $daily_state );

		return [
			'date'            => (string) ( $daily_state['state_date'] ?? $state_date ?? '' ),
			'location_slug'   => $location_slug,
			'location_name'   => (string) ( $location['name'] ?? self::humanize_key( $location_slug ) ),
			'tavern'          => [
				'name'        => (string) ( $tavern['name'] ?? 'The Tavern' ),
				'tone_tags'   => array_values( array_filter( array_map( 'strval', (array) ( $tavern['tone_tags'] ?? [] ) ) ) ),
				'flavor_text' => self::build_tavern_flavor_text( $location, $tavern ),
			],
			'profile'         => $profile,
			'today_context'   => [
				'day_type'              => 'rest',
				'meal_quest_complete'   => ! empty( $daily_state['meal_quest_complete'] ),
				'sleep_quest_complete'  => ! empty( $daily_state['sleep_quest_complete'] ),
				'cardio_quest_complete' => ! empty( $daily_state['cardio_quest_complete'] ),
				'steps_quest_complete'  => ! empty( $daily_state['steps_quest_complete'] ),
				'travel_points_earned'  => (int) ( $daily_state['travel_points_earned'] ?? 0 ),
			],
			'available_actions' => self::build_tavern_actions( $location_slug, $profile, $resolved ),
			'selected_action'   => $resolved,
			'resolved_today'    => ! empty( $resolved ),
			'johnny_line'       => ! empty( $resolved['johnny_line'] ?? '' )
				? (string) $resolved['johnny_line']
				: self::build_tavern_johnny_line( $location_slug, '', [] ),
			'daily_state'       => $daily_state,
		];
	}

	private static function apply_tavern_action( int $user_id, string $action_id, ?string $state_date = null ): array|WP_Error {
		$action_id = sanitize_key( $action_id );
		if ( '' === $action_id ) {
			return new WP_Error( 'invalid_action', 'Choose a tavern action before resolving it.' );
		}

		$profile     = IronQuestProfileService::ensure_profile( $user_id );
		$daily_state = IronQuestDailyStateService::get_state( $user_id, $state_date );
		if ( ! empty( self::extract_tavern_resolution( $daily_state ) ) ) {
			return new WP_Error( 'action_already_resolved', 'Today\'s tavern action is already locked in.' );
		}

		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$effects = [
			'hp_delta'        => 0,
			'gold_delta'      => 0,
			'xp_delta'        => 0,
			'mission_preview' => null,
		];

		switch ( $action_id ) {
			case 'rest':
				$next_hp = min( (int) ( $profile['hp_max'] ?? 100 ), (int) ( $profile['hp_current'] ?? 0 ) + 8 );
				$effects['hp_delta'] = max( 0, $next_hp - (int) ( $profile['hp_current'] ?? 0 ) );
				$profile = IronQuestProfileService::set_hp( $user_id, $next_hp, (int) ( $profile['hp_max'] ?? 100 ) );
				break;

			case 'side_job':
				$profile = IronQuestProfileService::update_progression( $user_id, 0, 10 );
				$effects['gold_delta'] = 10;
				break;

			case 'rumors':
				$profile = IronQuestProfileService::update_progression( $user_id, 10, 0 );
				$effects['xp_delta'] = 10;
				$effects['mission_preview'] = self::build_tavern_mission_preview( $location_slug, (string) ( $profile['active_mission_slug'] ?? '' ) );
				break;

			default:
				return new WP_Error( 'invalid_action', 'That tavern action is not available yet.' );
		}

		$bonus_state = is_array( $daily_state['bonus_state'] ?? null ) ? $daily_state['bonus_state'] : [];
		$bonus_state['tavern_day'] = [
			'action_id'       => $action_id,
			'resolved_at'     => current_time( 'mysql' ),
			'effects'         => $effects,
			'johnny_line'     => self::build_tavern_johnny_line( $location_slug, $action_id, $effects ),
			'mission_preview' => $effects['mission_preview'],
		];

		$updated_daily = IronQuestDailyStateService::upsert_state(
			$user_id,
			(string) ( $daily_state['state_date'] ?? $state_date ?? '' ),
			[ 'bonus_state_json' => $bonus_state ]
		);

		return [
			'resolved'        => true,
			'action_id'       => $action_id,
			'effects'         => $effects,
			'profile'         => $profile,
			'daily_state'     => $updated_daily,
			'johnny_line'     => (string) ( $bonus_state['tavern_day']['johnny_line'] ?? '' ),
			'mission_preview' => $effects['mission_preview'],
			'state'           => self::build_tavern_state( $user_id, (string) ( $daily_state['state_date'] ?? $state_date ?? '' ) ),
		];
	}

	private static function extract_tavern_resolution( array $daily_state ): ?array {
		$bonus_state = is_array( $daily_state['bonus_state'] ?? null ) ? $daily_state['bonus_state'] : [];
		$resolution  = is_array( $bonus_state['tavern_day'] ?? null ) ? $bonus_state['tavern_day'] : null;

		return is_array( $resolution ) ? $resolution : null;
	}

	private static function build_tavern_actions( string $location_slug, array $profile, ?array $resolved ): array {
		$disabled = ! empty( $resolved );

		return [
			[
				'id'             => 'rest',
				'label'          => 'Take a room',
				'description'    => 'Recover quietly and let the day stay easy.',
				'effect_summary' => '+8 HP',
				'disabled'       => $disabled,
			],
			[
				'id'             => 'side_job',
				'label'          => 'Pick up a side job',
				'description'    => 'Take the easy coin without turning the day into work.',
				'effect_summary' => '+10 gold',
				'disabled'       => $disabled,
			],
			[
				'id'             => 'rumors',
				'label'          => 'Listen for rumors',
				'description'    => sprintf( 'Hear what %s is stirring up next.', self::humanize_key( $location_slug ) ),
				'effect_summary' => '+10 XP and mission preview',
				'disabled'       => $disabled,
			],
		];
	}

	private static function build_tavern_flavor_text( array $location, array $tavern ): string {
		$name = trim( (string) ( $tavern['name'] ?? '' ) );
		$tone_tags = array_values( array_filter( array_map( 'strval', (array) ( $tavern['tone_tags'] ?? [] ) ) ) );
		$location_name = trim( (string) ( $location['name'] ?? '' ) );

		if ( $name && ! empty( $tone_tags ) ) {
			return sprintf( '%s holds a %s mood tonight.', $name, implode( ', ', $tone_tags ) );
		}

		if ( $location_name ) {
			return sprintf( 'The tavern in %s is the place to reset before the next push.', $location_name );
		}

		return 'This is a good place to reset before the next push.';
	}

	private static function build_tavern_mission_preview( string $location_slug, string $active_mission_slug ): ?array {
		$missions = IronQuestRegistryService::get_location_missions( $location_slug );
		foreach ( $missions as $mission ) {
			$mission_slug = sanitize_key( (string) ( $mission['slug'] ?? '' ) );
			if ( '' !== $mission_slug && $mission_slug !== sanitize_key( $active_mission_slug ) ) {
				return [
					'slug'    => $mission_slug,
					'name'    => (string) ( $mission['name'] ?? self::humanize_key( $mission_slug ) ),
					'summary' => (string) ( $mission['goal'] ?? $mission['narrative'] ?? '' ),
				];
			}
		}

		$mission = $missions[0] ?? null;
		if ( ! is_array( $mission ) ) {
			return null;
		}

		return [
			'slug'    => sanitize_key( (string) ( $mission['slug'] ?? '' ) ),
			'name'    => (string) ( $mission['name'] ?? '' ),
			'summary' => (string) ( $mission['goal'] ?? $mission['narrative'] ?? '' ),
		];
	}

	private static function build_tavern_johnny_line( string $location_slug, string $action_id, array $effects ): string {
		return match ( $action_id ) {
			'rest' => 'Take the quiet win. A real reset tonight does more than forcing one more task.',
			'side_job' => 'Easy coin is enough for today. Keep the day light and leave with something useful.',
			'rumors' => 'Listen close, take the hint, and let tomorrow have a little direction.',
			default => sprintf( 'Settle in at %s and keep the day simple.', self::humanize_key( $location_slug ) ),
		};
	}

	private static function resolve_default_mission_slug( string $location_slug, string $run_type ): string {
		$missions = IronQuestRegistryService::get_location_missions( $location_slug );
		if ( empty( $missions ) ) {
			return '';
		}

		$run_type = sanitize_key( $run_type );
		foreach ( $missions as $mission ) {
			$mission_run_type = sanitize_key( (string) ( $mission['run_type'] ?? '' ) );
			if ( '' !== $run_type && '' !== $mission_run_type && $mission_run_type === $run_type ) {
				return sanitize_key( (string) ( $mission['slug'] ?? '' ) );
			}
		}

		foreach ( $missions as $mission ) {
			if ( empty( $mission['is_boss'] ) ) {
				return sanitize_key( (string) ( $mission['slug'] ?? '' ) );
			}
		}

		return sanitize_key( (string) ( $missions[0]['slug'] ?? '' ) );
	}

	private static function find_location_mission( string $location_slug, string $mission_slug ): ?array {
		foreach ( IronQuestRegistryService::get_location_missions( $location_slug ) as $mission ) {
			if ( ( $mission['slug'] ?? '' ) === sanitize_key( $mission_slug ) ) {
				return $mission;
			}
		}

		return null;
	}

	private static function resolve_selected_or_default_mission_slug( array $profile, string $location_slug, string $run_type ): string {
		$location_slug        = sanitize_key( $location_slug );
		$selected_mission_slug = sanitize_key( (string) ( $profile['active_mission_slug'] ?? '' ) );
		if ( '' !== $location_slug && '' !== $selected_mission_slug ) {
			$selected_mission = self::find_location_mission( $location_slug, $selected_mission_slug );
			if ( ! empty( $selected_mission ) && self::mission_matches_run_type( $selected_mission, $run_type ) ) {
				return $selected_mission_slug;
			}
		}

		return self::resolve_default_mission_slug( $location_slug, $run_type );
	}

	private static function resolve_awards_for_run( array $run, string $result_band, int $xp_awarded, int $gold_awarded ): array {
		$mission     = self::find_location_mission( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) ) ?? [];
		$effect      = self::mission_effect_profile( $mission );

		if ( $xp_awarded > 0 || $gold_awarded > 0 ) {
			return [
				'xp'         => max( 0, $xp_awarded ),
				'gold'       => max( 0, $gold_awarded ),
				'source'     => 'request_override',
				'result_band'=> sanitize_key( $result_band ),
				'travel_points_bonus' => max( 0, (int) ( $effect['travel_points_bonus'] ?? 0 ) ),
				'effect_tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $effect['effect_tags'] ?? [] ) ) ) ),
			];
		}

		$location = IronQuestRegistryService::get_location( (string) ( $run['location_slug'] ?? '' ) ) ?? [];
		$is_boss  = ! empty( $mission['is_boss'] );
		$profile  = (array) ( $location['reward_profile'] ?? [] );

		if ( $is_boss ) {
			$xp   = (int) ( $profile['boss_xp'] ?? 0 );
			$gold = (int) ( $profile['boss_gold'] ?? 0 );
		} else {
			$xp   = self::average_min_max( (array) ( $profile['standard_xp'] ?? [] ) );
			$gold = self::average_min_max( (array) ( $profile['standard_gold'] ?? [] ) );
		}

		$result_band = sanitize_key( $result_band );
		if ( 'partial' === $result_band ) {
			$xp = (int) floor( $xp * 0.65 );
			$gold = (int) floor( $gold * 0.65 );
		} elseif ( 'failure' === $result_band ) {
			$xp = (int) floor( $xp * 0.35 );
			$gold = (int) floor( $gold * 0.35 );
		}

		$xp = (int) floor( $xp * max( 0, (float) ( $effect['xp_multiplier'] ?? 1 ) ) );
		$gold = (int) floor( $gold * max( 0, (float) ( $effect['gold_multiplier'] ?? 1 ) ) );

		return [
			'xp'          => max( 0, $xp ),
			'gold'        => max( 0, $gold ),
			'source'      => $is_boss ? 'seed_boss_rewards' : 'seed_standard_rewards',
			'result_band' => $result_band,
			'travel_points_bonus' => max( 0, (int) ( $effect['travel_points_bonus'] ?? 0 ) ),
			'effect_tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $effect['effect_tags'] ?? [] ) ) ) ),
		];
	}

	private static function average_min_max( array $value ): int {
		$min = (int) ( $value['min'] ?? 0 );
		$max = (int) ( $value['max'] ?? 0 );

		if ( $min <= 0 && $max <= 0 ) {
			return 0;
		}

		if ( $max <= 0 ) {
			return $min;
		}

		if ( $min <= 0 ) {
			return $max;
		}

		return (int) floor( ( $min + $max ) / 2 );
	}

	private static function mission_matches_run_type( array $mission, string $run_type ): bool {
		$run_type         = sanitize_key( $run_type );
		$mission_run_type = sanitize_key( (string) ( $mission['run_type'] ?? '' ) );

		if ( '' === $run_type || '' === $mission_run_type ) {
			return true;
		}

		return $mission_run_type === $run_type;
	}

	private static function mission_effect_profile( array $mission ): array {
		$mission_type = sanitize_key( (string) ( $mission['mission_type'] ?? '' ) );

		$profiles = [
			'easy_workout' => [
				'xp_multiplier'       => 0.9,
				'gold_multiplier'     => 1.15,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'recovery_safe', 'gold_bias' ],
			],
			'runner_task' => [
				'xp_multiplier'       => 0.95,
				'gold_multiplier'     => 1.1,
				'travel_points_bonus' => 1,
				'effect_tags'         => [ 'travel_bonus', 'grind' ],
			],
			'intro_combat' => [
				'xp_multiplier'       => 1.1,
				'gold_multiplier'     => 1.0,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'recommended', 'xp_bias' ],
			],
			'structured_progression' => [
				'xp_multiplier'       => 1.2,
				'gold_multiplier'     => 1.0,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'recommended', 'xp_bias' ],
			],
			'pressure_and_intensity' => [
				'xp_multiplier'       => 1.05,
				'gold_multiplier'     => 1.15,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'grind', 'gold_bias' ],
			],
			'pressure_combat' => [
				'xp_multiplier'       => 1.05,
				'gold_multiplier'     => 1.15,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'grind', 'gold_bias' ],
			],
			'endurance_and_tension' => [
				'xp_multiplier'       => 1.15,
				'gold_multiplier'     => 1.05,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'grind', 'xp_bias' ],
			],
			'ambush_control' => [
				'xp_multiplier'       => 1.05,
				'gold_multiplier'     => 1.1,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'grind', 'precision' ],
			],
			'pre_boss_escalation' => [
				'xp_multiplier'       => 1.1,
				'gold_multiplier'     => 1.05,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'boss_prep', 'recommended' ],
			],
			'boss' => [
				'xp_multiplier'       => 1.25,
				'gold_multiplier'     => 1.25,
				'travel_points_bonus' => 0,
				'effect_tags'         => [ 'boss', 'high_stakes' ],
			],
		];

		return $profiles[ $mission_type ] ?? [
			'xp_multiplier'       => 1.0,
			'gold_multiplier'     => 1.0,
			'travel_points_bonus' => 0,
			'effect_tags'         => [],
		];
	}

	private static function resolve_daily_travel_points( \WP_REST_Request $req ): int {
		$explicit_points = $req->get_param( 'travel_points' );
		if ( null !== $explicit_points && '' !== $explicit_points ) {
			return max( 0, (int) $explicit_points );
		}

		$steps = (int) ( $req->get_param( 'steps' ) ?: 0 );
		if ( $steps > 0 ) {
			return self::travel_points_from_step_equivalent( $steps );
		}

		$cardio_duration = (int) ( $req->get_param( 'cardio_duration_minutes' ) ?: 0 );
		if ( $cardio_duration > 0 ) {
			$cardio_type      = sanitize_key( (string) ( $req->get_param( 'cardio_type' ) ?: 'other' ) );
			$cardio_intensity = sanitize_key( (string) ( $req->get_param( 'cardio_intensity' ) ?: 'moderate' ) );
			$step_equivalent  = BodyMetricsController::estimate_cardio_step_equivalent( $cardio_type, $cardio_intensity, $cardio_duration );

			return self::travel_points_from_step_equivalent( $step_equivalent );
		}

		return 0;
	}

	private static function travel_points_from_step_equivalent( int $step_equivalent ): int {
		$step_equivalent = max( 0, $step_equivalent );
		if ( $step_equivalent <= 0 ) {
			return 0;
		}

		return max( 1, (int) floor( $step_equivalent / 2500 ) );
	}

	private static function sync_route_progression( int $user_id, array $context = [] ): array {
		$profile      = IronQuestProfileService::ensure_profile( $user_id );
		$before_state = self::build_route_state( $user_id, $profile );
		$run          = is_array( $context['run'] ?? null ) ? $context['run'] : [];
		$mission      = is_array( $context['mission'] ?? null ) ? $context['mission'] : [];
		$result_band  = sanitize_key( (string) ( $context['result_band'] ?? '' ) );

		if ( ! empty( $mission['is_boss'] ) && 'victory' === $result_band ) {
			self::clear_location_arc( $user_id, (string) ( $run['location_slug'] ?? '' ), (int) ( $run['id'] ?? 0 ) );
		}

		$route_state = self::build_route_state( $user_id, IronQuestProfileService::ensure_profile( $user_id ) );
		$graph       = IronQuestRegistryService::get_launch_graph_config();
		$locations   = IronQuestRegistryService::get_locations_config()['locations'] ?? [];

		foreach ( (array) ( $graph['edges'] ?? [] ) as $edge ) {
			$to_slug = sanitize_key( (string) ( $edge['to'] ?? '' ) );
			if ( '' === $to_slug || in_array( $to_slug, $route_state['unlocked_locations'], true ) ) {
				continue;
			}

			if ( ! self::route_edge_requirements_met( $edge, $route_state ) ) {
				continue;
			}

			$travel_requirement = self::location_travel_requirement( $to_slug, $locations );
			if ( $route_state['total_travel_points'] < $travel_requirement ) {
				continue;
			}

			self::unlock_location_for_user( $user_id, $to_slug, (int) ( $run['id'] ?? 0 ), $travel_requirement );
			$route_state = self::build_route_state( $user_id, IronQuestProfileService::ensure_profile( $user_id ) );
		}

		$profile            = IronQuestProfileService::ensure_profile( $user_id );
		$next_location_slug = self::resolve_next_active_location_slug( $profile, $route_state );
		if ( '' !== $next_location_slug && $next_location_slug !== (string) ( $profile['current_location_slug'] ?? '' ) ) {
			$next_mission_slug = self::resolve_default_mission_slug( $next_location_slug, '' );
			$profile           = IronQuestProfileService::set_location_and_mission( $user_id, $next_location_slug, $next_mission_slug );
			$route_state       = self::build_route_state( $user_id, $profile );
		}

		return [
			'route_state'   => $route_state,
			'route_changes' => self::build_route_changes( $before_state, $route_state ),
		];
	}

	private static function build_route_state( int $user_id, ?array $profile = null ): array {
		$profile   = is_array( $profile ) ? $profile : IronQuestProfileService::ensure_profile( $user_id );
		$graph     = IronQuestRegistryService::get_launch_graph_config();
		$locations = array_values( IronQuestRegistryService::get_locations_config()['locations'] ?? [] );
		$path      = array_values( array_filter( (array) ( $graph['recommended_path'] ?? [] ) ) );
		$travel_breakdown = self::travel_points_breakdown_for_user( $user_id );

		if ( empty( $path ) ) {
			$path = array_values( array_map( static fn( array $location ): string => sanitize_key( (string) ( $location['slug'] ?? '' ) ), $locations ) );
		}

		$unlocked_locations = array_values(
			array_unique(
				array_merge(
					array_values(
						array_map(
							static fn( array $node ): string => sanitize_key( (string) ( $node['slug'] ?? '' ) ),
							array_filter(
								(array) ( $graph['nodes'] ?? [] ),
								static fn( array $node ): bool => ! empty( $node['available_at_start'] )
							)
						)
					),
					array_values(
						array_map(
							static fn( array $unlock ): string => sanitize_key( (string) ( $unlock['unlock_key'] ?? '' ) ),
							array_filter(
								IronQuestRewardService::list_unlocks( $user_id, 'location' ),
								static fn( array $unlock ): bool => sanitize_key( (string) ( $unlock['unlock_key'] ?? '' ) ) !== ''
							)
						)
					)
				)
			)
		);

		$cleared_locations = array_values(
			array_unique(
				array_values(
					array_map(
						static fn( array $unlock ): string => sanitize_key( (string) ( $unlock['unlock_key'] ?? '' ) ),
						array_filter(
							IronQuestRewardService::list_unlocks( $user_id, 'location_arc' ),
							static fn( array $unlock ): bool => sanitize_key( (string) ( $unlock['unlock_key'] ?? '' ) ) !== ''
						)
					)
				)
			)
		);

		$total_travel_points = (int) ( $travel_breakdown['total'] ?? 0 );
		$next_unlocks        = [];

		foreach ( (array) ( $graph['edges'] ?? [] ) as $edge ) {
			$to_slug = sanitize_key( (string) ( $edge['to'] ?? '' ) );
			if ( '' === $to_slug || in_array( $to_slug, $unlocked_locations, true ) ) {
				continue;
			}

			$travel_requirement = self::location_travel_requirement( $to_slug, $locations );
			$requirements_met   = self::route_edge_requirements_met(
				$edge,
				[
					'cleared_locations' => $cleared_locations,
				]
			);
			$fast_travel_cap       = self::fast_travel_points_cap( $travel_requirement );
			$fast_travel_used      = self::fast_travel_points_used_for_location( $user_id, $to_slug );
			$travel_remaining      = max( 0, $travel_requirement - $total_travel_points );
			$fast_travel_remaining = max( 0, $fast_travel_cap - $fast_travel_used );
			$fast_travel_available = min( $travel_remaining, $fast_travel_remaining );

			$next_unlocks[] = [
				'location_slug'      => $to_slug,
				'travel_required'    => $travel_requirement,
				'travel_remaining'   => $travel_remaining,
				'requirements_met'   => $requirements_met,
				'required_arc_clear' => sanitize_key( (string) ( $edge['requirements']['complete_location_arc'] ?? '' ) ),
				'fast_travel_points_cap' => $fast_travel_cap,
				'fast_travel_points_used' => $fast_travel_used,
				'fast_travel_points_available' => $fast_travel_available,
				'fast_travel_gold_cost' => self::FAST_TRAVEL_GOLD_COST,
				'fast_travel_gold_cost_max' => $fast_travel_available * self::FAST_TRAVEL_GOLD_COST,
			];
		}

		usort(
			$next_unlocks,
			static function ( array $left, array $right ) use ( $path ): int {
				$left_index  = array_search( $left['location_slug'], $path, true );
				$right_index = array_search( $right['location_slug'], $path, true );
				$left_index  = false === $left_index ? PHP_INT_MAX : (int) $left_index;
				$right_index = false === $right_index ? PHP_INT_MAX : (int) $right_index;

				if ( $left_index === $right_index ) {
					return (int) ( $left['travel_remaining'] ?? 0 ) <=> (int) ( $right['travel_remaining'] ?? 0 );
				}

				return $left_index <=> $right_index;
			}
		);

		return [
			'current_location_slug' => sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) ),
			'unlocked_locations'    => $unlocked_locations,
			'cleared_locations'     => $cleared_locations,
			'total_travel_points'   => $total_travel_points,
			'travel_points_breakdown' => $travel_breakdown,
			'path'                  => $path,
			'next_unlocks'          => $next_unlocks,
		];
	}

	private static function build_route_changes( array $previous_state, array $next_state ): array {
		$previous_unlocked = array_values( array_filter( array_map( 'sanitize_key', (array) ( $previous_state['unlocked_locations'] ?? [] ) ) ) );
		$next_unlocked     = array_values( array_filter( array_map( 'sanitize_key', (array) ( $next_state['unlocked_locations'] ?? [] ) ) ) );
		$previous_cleared  = array_values( array_filter( array_map( 'sanitize_key', (array) ( $previous_state['cleared_locations'] ?? [] ) ) ) );
		$next_cleared      = array_values( array_filter( array_map( 'sanitize_key', (array) ( $next_state['cleared_locations'] ?? [] ) ) ) );

		return [
			'newly_unlocked_locations' => array_values( array_diff( $next_unlocked, $previous_unlocked ) ),
			'newly_cleared_locations'  => array_values( array_diff( $next_cleared, $previous_cleared ) ),
			'travel_points_total'      => (int) ( $next_state['total_travel_points'] ?? 0 ),
			'active_location_changed'  => sanitize_key( (string) ( $previous_state['current_location_slug'] ?? '' ) ) !== sanitize_key( (string) ( $next_state['current_location_slug'] ?? '' ) ),
			'current_location_slug'    => sanitize_key( (string) ( $next_state['current_location_slug'] ?? '' ) ),
		];
	}

	private static function total_travel_points_for_user( int $user_id ): int {
		return (int) ( self::travel_points_breakdown_for_user( $user_id )['total'] ?? 0 );
	}

	private static function travel_points_breakdown_for_user( int $user_id ): array {
		$movement = 0;
		$fast_travel = 0;

		foreach ( IronQuestRewardService::list_activity_awards( $user_id, 'route_progress', 'travel_points' ) as $award ) {
			$points = max( 0, (int) ( $award['payload']['points'] ?? 0 ) );
			if ( $points <= 0 ) {
				continue;
			}

			if ( ! empty( $award['payload']['fast_travel'] ) ) {
				$fast_travel += $points;
				continue;
			}

			$movement += $points;
		}

		return [
			'movement'    => $movement,
			'fast_travel' => $fast_travel,
			'total'       => $movement + $fast_travel,
		];
	}

	private static function fast_travel_points_used_for_location( int $user_id, string $location_slug ): int {
		$location_slug = sanitize_key( $location_slug );
		if ( '' === $location_slug ) {
			return 0;
		}

		$total = 0;
		foreach ( IronQuestRewardService::list_activity_awards( $user_id, 'route_progress', 'travel_points' ) as $award ) {
			if ( sanitize_text_field( (string) ( $award['source_key'] ?? '' ) ) !== self::fast_travel_source_key( $location_slug ) ) {
				continue;
			}

			if ( empty( $award['payload']['fast_travel'] ) ) {
				continue;
			}

			$total = max( $total, max( 0, (int) ( $award['payload']['points'] ?? 0 ) ) );
		}

		return $total;
	}

	private static function fast_travel_points_cap( int $travel_requirement ): int {
		$travel_requirement = max( 0, $travel_requirement );

		return max( 0, (int) floor( $travel_requirement / 2 ) );
	}

	private static function fast_travel_source_key( string $location_slug ): string {
		return 'fast_travel_' . sanitize_key( $location_slug );
	}

	private static function clear_location_arc( int $user_id, string $location_slug, int $source_run_id = 0 ): void {
		$location_slug = sanitize_key( $location_slug );
		if ( '' === $location_slug ) {
			return;
		}

		$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		$bonus    = (array) ( $location['reward_profile']['full_clear_bonus'] ?? [] );

		IronQuestRewardService::grant_unlock(
			$user_id,
			'location_arc',
			$location_slug,
			$source_run_id ?: null,
			[
				'description' => $location ? sprintf( 'Cleared %s.', (string) ( $location['name'] ?? $location_slug ) ) : 'Location arc cleared.',
				'source'      => 'boss_victory',
			]
		);

		$bonus_xp   = max( 0, (int) ( $bonus['xp'] ?? 0 ) );
		$bonus_gold = max( 0, (int) ( $bonus['gold'] ?? 0 ) );
		if ( $bonus_xp > 0 || $bonus_gold > 0 ) {
			IronQuestProgressionService::apply_progression_award(
				$user_id,
				$bonus_xp,
				$bonus_gold,
				'location_arc',
				$location_slug,
				'full_clear_bonus'
			);
		}
	}

	private static function unlock_location_for_user( int $user_id, string $location_slug, int $source_run_id = 0, int $travel_requirement = 0 ): void {
		$location_slug = sanitize_key( $location_slug );
		if ( '' === $location_slug ) {
			return;
		}

		$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		$location_name = (string) ( $location['name'] ?? $location_slug );

		IronQuestRewardService::grant_unlock(
			$user_id,
			'location',
			$location_slug,
			$source_run_id ?: null,
			[
				'description' => sprintf(
					'Unlocked %s after clearing the route requirements and reaching %d travel point%s.',
					$location_name,
					max( 0, $travel_requirement ),
					1 === max( 0, $travel_requirement ) ? '' : 's'
				),
				'source'      => 'route_progression',
			]
		);
	}

	private static function resolve_next_active_location_slug( array $profile, array $route_state ): string {
		$current_location = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$cleared          = array_values( array_filter( array_map( 'sanitize_key', (array) ( $route_state['cleared_locations'] ?? [] ) ) ) );
		$unlocked         = array_values( array_filter( array_map( 'sanitize_key', (array) ( $route_state['unlocked_locations'] ?? [] ) ) ) );
		$path             = array_values( array_filter( array_map( 'sanitize_key', (array) ( $route_state['path'] ?? [] ) ) ) );

		if ( '' === $current_location || ! in_array( $current_location, $cleared, true ) ) {
			return '';
		}

		$current_index = array_search( $current_location, $path, true );
		if ( false === $current_index ) {
			return '';
		}

		for ( $index = (int) $current_index + 1; $index < count( $path ); $index++ ) {
			$candidate = sanitize_key( (string) ( $path[ $index ] ?? '' ) );
			if ( '' === $candidate ) {
				continue;
			}
			if ( in_array( $candidate, $unlocked, true ) && ! in_array( $candidate, $cleared, true ) ) {
				return $candidate;
			}
		}

		return '';
	}

	private static function route_edge_requirements_met( array $edge, array $route_state ): bool {
		$required_arc = sanitize_key( (string) ( $edge['requirements']['complete_location_arc'] ?? '' ) );
		if ( '' === $required_arc ) {
			return true;
		}

		return in_array( $required_arc, (array) ( $route_state['cleared_locations'] ?? [] ), true );
	}

	private static function location_travel_requirement( string $location_slug, array $locations ): int {
		$location_slug = sanitize_key( $location_slug );
		foreach ( $locations as $location ) {
			if ( sanitize_key( (string) ( $location['slug'] ?? '' ) ) !== $location_slug ) {
				continue;
			}

			return max( 0, (int) ( $location['source_graph']['travel_requirement']['value'] ?? 0 ) );
		}

		return 0;
	}

	private static function find_route_unlock_state( array $route_state, string $location_slug ): ?array {
		$location_slug = sanitize_key( $location_slug );
		if ( '' === $location_slug ) {
			return null;
		}

		foreach ( (array) ( $route_state['next_unlocks'] ?? [] ) as $unlock_state ) {
			if ( sanitize_key( (string) ( $unlock_state['location_slug'] ?? '' ) ) === $location_slug ) {
				return $unlock_state;
			}
		}

		return null;
	}

	private static function build_daily_progress_changes( array $previous_state, array $next_state ): array {
		$newly_completed_quests = [];

		foreach ( [
			'meal_quest_complete' => 'meal',
			'sleep_quest_complete' => 'sleep',
			'cardio_quest_complete' => 'cardio',
			'steps_quest_complete' => 'steps',
			'workout_quest_complete' => 'workout',
		] as $state_key => $quest_key ) {
			if ( empty( $previous_state[ $state_key ] ) && ! empty( $next_state[ $state_key ] ) ) {
				$newly_completed_quests[] = $quest_key;
			}
		}

		$previous_travel = (int) ( $previous_state['travel_points_earned'] ?? 0 );
		$next_travel     = (int) ( $next_state['travel_points_earned'] ?? 0 );

		return [
			'newly_completed_quests' => $newly_completed_quests,
			'travel_points_added'    => max( 0, $next_travel - $previous_travel ),
			'travel_points_total'    => max( 0, $next_travel ),
		];
	}

	private static function build_mission_board( array $profile, array $missions, array $daily_state, ?array $active_run = null ): array {
		$selected_mission_slug = sanitize_key( (string) ( $profile['active_mission_slug'] ?? '' ) );
		$active_mission_slug   = sanitize_key( (string) ( $active_run['mission_slug'] ?? '' ) );
		$recommended_slug      = self::recommended_mission_slug_for_state( $missions, $daily_state );

		return array_values(
			array_map(
			static function ( array $mission ) use ( $selected_mission_slug, $active_mission_slug, $recommended_slug ): array {
				$mission_slug = sanitize_key( (string) ( $mission['slug'] ?? '' ) );
				$mission_type = sanitize_key( (string) ( $mission['mission_type'] ?? '' ) );
				$run_type     = sanitize_key( (string) ( $mission['run_type'] ?? '' ) );
				$board_role   = 'optional';

				if ( '' !== $active_mission_slug && $mission_slug === $active_mission_slug ) {
					$board_role = 'active';
				} elseif ( ! empty( $mission['is_boss'] ) ) {
					$board_role = 'boss';
				} elseif ( '' !== $recommended_slug && $mission_slug === $recommended_slug ) {
					$board_role = 'recommended';
				} elseif ( 'easy_workout' === $mission_type ) {
					$board_role = 'recovery_safe';
				} elseif ( 'runner_task' === $mission_type || 'cardio' === $run_type ) {
					$board_role = 'grind';
				}

				$effect = self::mission_effect_profile( $mission );

				return array_merge(
					$mission,
					[
						'is_selected' => '' !== $selected_mission_slug && $mission_slug === $selected_mission_slug,
						'is_active'   => '' !== $active_mission_slug && $mission_slug === $active_mission_slug,
						'board_role'  => $board_role,
						'effect_tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $effect['effect_tags'] ?? [] ) ) ) ),
						'reward_preview' => [
							'xp_multiplier'       => (float) ( $effect['xp_multiplier'] ?? 1 ),
							'gold_multiplier'     => (float) ( $effect['gold_multiplier'] ?? 1 ),
							'travel_points_bonus' => (int) ( $effect['travel_points_bonus'] ?? 0 ),
						],
					]
				);
			},
			$missions
			)
		);
	}

	private static function recommended_mission_slug_for_state( array $missions, array $daily_state ): string {
		if ( empty( $missions ) ) {
			return '';
		}

		if ( empty( $daily_state['cardio_quest_complete'] ) ) {
			foreach ( $missions as $mission ) {
				if ( sanitize_key( (string) ( $mission['run_type'] ?? '' ) ) === 'cardio' ) {
					return sanitize_key( (string) ( $mission['slug'] ?? '' ) );
				}
			}
		}

		if ( empty( $daily_state['workout_quest_complete'] ) ) {
			foreach ( $missions as $mission ) {
				if ( in_array( sanitize_key( (string) ( $mission['mission_type'] ?? '' ) ), [ 'structured_progression', 'intro_combat', 'pre_boss_escalation' ], true ) ) {
					return sanitize_key( (string) ( $mission['slug'] ?? '' ) );
				}
			}
		}

		foreach ( $missions as $mission ) {
			if ( empty( $mission['is_boss'] ) && sanitize_key( (string) ( $mission['mission_type'] ?? '' ) ) !== 'easy_workout' ) {
				return sanitize_key( (string) ( $mission['slug'] ?? '' ) );
			}
		}

		return sanitize_key( (string) ( $missions[0]['slug'] ?? '' ) );
	}

	private static function apply_mission_side_effects( int $user_id, int $run_id, array $run, array $mission, string $result_band, array $awards, array $story_state = [] ): array {
		$granted_rewards = [];
		$travel_points_bonus = 0;

		if ( 'victory' !== $result_band ) {
			return [
				'travel_points_bonus' => 0,
				'granted_rewards'     => [],
			];
		}

		$effect = self::mission_effect_profile( $mission );
		$travel_points_bonus = max( 0, (int) ( $awards['travel_points_bonus'] ?? $effect['travel_points_bonus'] ?? 0 ) );

		if ( $travel_points_bonus > 0 ) {
			IronQuestRewardService::upsert_activity_award(
				$user_id,
				'route_progress',
				'mission_bonus_' . $run_id,
				'travel_points',
				[
					'points'       => $travel_points_bonus,
					'fast_travel'  => false,
					'mission_slug' => sanitize_key( (string) ( $mission['slug'] ?? '' ) ),
					'source'       => 'mission_effect',
				]
			);
		}

		$mission_type = sanitize_key( (string) ( $mission['mission_type'] ?? '' ) );
		$location_slug = sanitize_key( (string) ( $run['location_slug'] ?? '' ) );
		$mission_slug  = sanitize_key( (string) ( $run['mission_slug'] ?? '' ) );

		if ( 'easy_workout' === $mission_type ) {
			$granted_rewards[] = self::grant_inventory_unlock(
				$user_id,
				'title',
				'steady_hands',
				$run_id,
				'Title unlocked: Steady Hands.',
				[
					'label'  => 'Steady Hands',
					'source' => 'mission_effect',
				]
			);
		}

		if ( 'runner_task' === $mission_type ) {
			$granted_rewards[] = self::grant_inventory_unlock(
				$user_id,
				'relic',
				'courier_token',
				$run_id,
				'Relic recovered: Courier Token.',
				[
					'label'  => 'Courier Token',
					'source' => 'mission_effect',
				]
			);
		}

		if ( 'pre_boss_escalation' === $mission_type || ! empty( $mission['is_boss'] ) ) {
			$granted_rewards[] = self::grant_inventory_unlock(
				$user_id,
				'journal_entry',
				'journal_' . $mission_slug,
				$run_id,
				sprintf( 'Journal updated: %s.', (string) ( $mission['name'] ?? self::humanize_key( $mission_slug ) ) ),
				[
					'label'       => (string) ( $mission['name'] ?? self::humanize_key( $mission_slug ) ),
					'entry'       => self::resolve_journal_entry_text( $mission, $story_state ),
					'source'      => 'mission_effect',
					'location'    => $location_slug,
				]
			);
		}

		if ( ! empty( $mission['is_boss'] ) ) {
			$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
			$location_name = (string) ( $location['name'] ?? self::humanize_key( $location_slug ) );
			$granted_rewards[] = self::grant_inventory_unlock(
				$user_id,
				'relic',
				$location_slug . '_trophy',
				$run_id,
				sprintf( 'Boss trophy recovered from %s.', $location_name ),
				[
					'label'  => $location_name . ' Trophy',
					'source' => 'boss_victory',
				]
			);
			$granted_rewards[] = self::grant_inventory_unlock(
				$user_id,
				'title',
				$location_slug . '_conqueror',
				$run_id,
				sprintf( 'Title unlocked: Conqueror of %s.', $location_name ),
				[
					'label'  => 'Conqueror of ' . $location_name,
					'source' => 'boss_victory',
				]
			);
		}

		return [
			'travel_points_bonus' => $travel_points_bonus,
			'granted_rewards'     => array_values( array_filter( $granted_rewards ) ),
		];
	}

	private static function resolve_journal_entry_text( array $mission, array $story_state ): string {
		$summary = sanitize_textarea_field( (string) ( $story_state['conclusion']['summary'] ?? '' ) );
		if ( '' !== $summary ) {
			return $summary;
		}

		return sanitize_textarea_field( (string) ( $mission['outcomes']['victory'] ?? $mission['narrative'] ?? $mission['goal'] ?? '' ) );
	}

	private static function grant_inventory_unlock( int $user_id, string $unlock_type, string $unlock_key, int $source_run_id, string $description, array $meta = [] ): ?array {
		$meta = array_merge(
			[
				'description' => $description,
			],
			$meta
		);

		$result = IronQuestRewardService::grant_unlock(
			$user_id,
			$unlock_type,
			$unlock_key,
			$source_run_id ?: null,
			$meta
		);

		if ( is_wp_error( $result ) || ! is_array( $result ) || ! empty( $result['duplicate'] ) ) {
			return null;
		}

		return [
			'unlock_type' => sanitize_key( $unlock_type ),
			'unlock_key'  => sanitize_key( $unlock_key ),
			'meta'        => $meta,
		];
	}

	private static function humanize_key( string $value ): string {
		$normalized = sanitize_key( $value );
		if ( '' === $normalized ) {
			return 'Unknown';
		}

		return trim( preg_replace( '/\s+/', ' ', ucwords( str_replace( [ '_', '-' ], ' ', $normalized ) ) ) ?? '' );
	}

	private static function resolve_mission_run( int $user_id, int $run_id, string $result_band, int $xp_awarded = 0, int $gold_awarded = 0 ): array|\WP_Error {
		$run = IronQuestMissionService::get_run( $run_id, $user_id );
		if ( empty( $run ) ) {
			return new \WP_Error( 'ironquest_mission_run_not_found', 'IronQuest mission run not found.' );
		}

		$result_band = sanitize_key( $result_band ?: 'victory' );
		$mission     = self::find_location_mission( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) );
		$awards      = self::resolve_awards_for_run( $run, $result_band, $xp_awarded, $gold_awarded );

		$completed = IronQuestMissionService::complete_run(
			$run_id,
			$user_id,
			$result_band,
			$awards['xp'],
			$awards['gold']
		);
		if ( is_wp_error( $completed ) ) {
			return $completed;
		}

		$progression = IronQuestProgressionService::apply_progression_award(
			$user_id,
			$awards['xp'],
			$awards['gold'],
			'mission_run',
			(string) $run_id,
			'mission_completion'
		);
		if ( is_wp_error( $progression ) ) {
			return $progression;
		}

		$story_state          = IronQuestNarrativeService::complete_story( $user_id, $completed, $result_band, $awards );
		$previous_daily_state = IronQuestDailyStateService::get_state( $user_id );
		$daily_state          = IronQuestDailyStateService::mark_quest_complete( $user_id, 'workout' );
		$mission_effects      = self::apply_mission_side_effects( $user_id, $run_id, $run, is_array( $mission ) ? $mission : [], $result_band, $awards, $story_state );
		$route_sync           = self::sync_route_progression(
			$user_id,
			[
				'run'         => $completed,
				'result_band' => $result_band,
				'mission'     => $mission,
			]
		);

		return [
			'run'           => $completed,
			'awards'        => $awards,
			'story_state'   => $story_state,
			'progression'   => $progression,
			'daily_state'   => $daily_state,
			'changes'       => self::build_daily_progress_changes( $previous_daily_state, $daily_state ),
			'mission'       => $mission,
			'mission_effects' => $mission_effects,
			'route_state'   => $route_sync['route_state'],
			'route_changes' => $route_sync['route_changes'],
			'profile'       => IronQuestProfileService::get_profile( $user_id ),
		];
	}

	private static function get_story_state_for_run( int $user_id, ?array $run ): ?array {
		if ( empty( $run['id'] ) || 'active' !== (string) ( $run['status'] ?? 'active' ) ) {
			return null;
		}

		return IronQuestNarrativeService::get_or_create_story_state( $user_id, $run );
	}

	private static function sync_story_phase_on_run( array $run, int $user_id, array $story_state ): array {
		$phase = sanitize_key( (string) ( $story_state['encounter_phase'] ?? '' ) );
		if ( '' === $phase || $phase === sanitize_key( (string) ( $run['encounter_phase'] ?? '' ) ) ) {
			return $run;
		}

		$updated = IronQuestMissionService::set_encounter_phase( (int) ( $run['id'] ?? 0 ), $user_id, $phase );
		if ( is_wp_error( $updated ) || empty( $updated ) ) {
			return $run;
		}

		return $updated;
	}
}
