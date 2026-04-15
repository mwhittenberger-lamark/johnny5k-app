<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\IronQuestDailyStateService;
use Johnny5k\Services\IronQuestEntitlementService;
use Johnny5k\Services\IronQuestMissionService;
use Johnny5k\Services\IronQuestProfileService;
use Johnny5k\Services\IronQuestProgressionService;
use Johnny5k\Services\IronQuestRegistryService;

class IronQuestController extends RestController {

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

		$profile = IronQuestProfileService::enable_for_user( $user_id );
		$location_slug = sanitize_key( (string) ( $req->get_param( 'location_slug' ) ?: ( $profile['current_location_slug'] ?? '' ) ) );
		$mission_slug  = sanitize_key( (string) ( $req->get_param( 'mission_slug' ) ?: '' ) );
		$run_type      = sanitize_key( (string) ( $req->get_param( 'run_type' ) ?: 'workout' ) );
		$source_session_id = sanitize_text_field( (string) ( $req->get_param( 'source_session_id' ) ?: '' ) );

		if ( '' === $location_slug ) {
			return self::message( 'An IronQuest location is required.', 400 );
		}

		if ( '' === $mission_slug ) {
			$mission_slug = self::resolve_default_mission_slug( $location_slug, $run_type );
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

		$result_band = sanitize_key( (string) ( $req->get_param( 'result_band' ) ?: 'victory' ) );
		$awards      = self::resolve_awards_for_run(
			$run,
			$result_band,
			(int) ( $req->get_param( 'xp_awarded' ) ?: 0 ),
			(int) ( $req->get_param( 'gold_awarded' ) ?: 0 )
		);

		$completed = IronQuestMissionService::complete_run(
			$run_id,
			$user_id,
			$result_band,
			$awards['xp'],
			$awards['gold']
		);
		if ( is_wp_error( $completed ) ) {
			return self::message( $completed->get_error_message(), 400 );
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
			return self::message( $progression->get_error_message(), 400 );
		}

		return self::response(
			[
				'run'         => $completed,
				'awards'      => $awards,
				'progression' => $progression,
				'profile'     => IronQuestProfileService::get_profile( $user_id ),
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

	private static function build_profile_payload( int $user_id ): array {
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );

		return [
			'entitlement' => IronQuestEntitlementService::get_access_state( $user_id ),
			'profile'     => $profile,
			'location'    => $location_slug ? IronQuestRegistryService::get_location( $location_slug ) : null,
			'missions'    => $location_slug ? IronQuestRegistryService::get_location_missions( $location_slug ) : [],
			'active_run'  => IronQuestMissionService::get_active_run( $user_id ),
			'daily_state' => IronQuestDailyStateService::get_state( $user_id ),
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

	private static function resolve_awards_for_run( array $run, string $result_band, int $xp_awarded, int $gold_awarded ): array {
		if ( $xp_awarded > 0 || $gold_awarded > 0 ) {
			return [
				'xp'         => max( 0, $xp_awarded ),
				'gold'       => max( 0, $gold_awarded ),
				'source'     => 'request_override',
				'result_band'=> sanitize_key( $result_band ),
			];
		}

		$location = IronQuestRegistryService::get_location( (string) ( $run['location_slug'] ?? '' ) ) ?? [];
		$is_boss  = ! empty( self::find_location_mission( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) )['is_boss'] );
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

		return [
			'xp'          => max( 0, $xp ),
			'gold'        => max( 0, $gold ),
			'source'      => $is_boss ? 'seed_boss_rewards' : 'seed_standard_rewards',
			'result_band' => $result_band,
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
}
