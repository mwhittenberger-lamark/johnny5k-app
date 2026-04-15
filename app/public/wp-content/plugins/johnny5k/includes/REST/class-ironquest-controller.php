<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\IronQuestDailyStateService;
use Johnny5k\Services\IronQuestEntitlementService;
use Johnny5k\Services\IronQuestMissionService;
use Johnny5k\Services\IronQuestProfileService;
use Johnny5k\Services\IronQuestProgressionService;
use Johnny5k\Services\IronQuestRegistryService;
use Johnny5k\Services\IronQuestRewardService;

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
			'/ironquest/route/fast-travel',
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'fast_travel' ],
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
		$missions      = $location_slug ? IronQuestRegistryService::get_location_missions( $location_slug ) : [];
		$active_run    = IronQuestMissionService::get_active_run( $user_id );
		$daily_state   = IronQuestDailyStateService::get_state( $user_id );

		return [
			'entitlement' => IronQuestEntitlementService::get_access_state( $user_id ),
			'profile'     => $profile,
			'location'    => $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : null,
			'missions'    => $missions,
			'mission_board' => self::build_mission_board( $profile, $missions, $daily_state, $active_run ),
			'active_run'  => $active_run,
			'daily_state' => $daily_state,
			'recent_unlocks' => array_slice( $unlock_history, 0, 6 ),
			'unlock_history' => $unlock_history,
			'route_state' => $route_state,
		];
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

	private static function apply_mission_side_effects( int $user_id, int $run_id, array $run, array $mission, string $result_band, array $awards ): array {
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
					'entry'       => (string) ( $mission['outcomes']['victory'] ?? $mission['narrative'] ?? $mission['goal'] ?? '' ),
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

		$previous_daily_state = IronQuestDailyStateService::get_state( $user_id );
		$daily_state          = IronQuestDailyStateService::mark_quest_complete( $user_id, 'workout' );
		$mission_effects      = self::apply_mission_side_effects( $user_id, $run_id, $run, is_array( $mission ) ? $mission : [], $result_band, $awards );
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
}
