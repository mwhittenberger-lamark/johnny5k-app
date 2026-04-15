<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestProfileService {

	public static function get_profile( int $user_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_profiles';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE user_id = %d LIMIT 1",
				$user_id
			),
			ARRAY_A
		);

		return is_array( $row ) ? self::normalize_profile_row( $row ) : null;
	}

	public static function ensure_profile( int $user_id ): array {
		$existing = self::get_profile( $user_id );
		if ( is_array( $existing ) ) {
			return $existing;
		}

		global $wpdb;
		$table       = $wpdb->prefix . 'fit_ironquest_profiles';
		$launch_graph = IronQuestRegistryService::get_launch_graph_config();
		$start_node   = sanitize_key( (string) ( $launch_graph['start_node'] ?? '' ) );
		$start_mission = self::resolve_start_mission_slug( $start_node );

		$wpdb->insert(
			$table,
			[
				'user_id'               => $user_id,
				'enabled'               => 0,
				'level'                 => 1,
				'xp'                    => 0,
				'gold'                  => 0,
				'hp_current'            => 100,
				'hp_max'                => 100,
				'current_location_slug' => $start_node,
				'active_mission_slug'   => $start_mission,
			],
			[ '%d', '%d', '%d', '%d', '%d', '%d', '%d', '%s', '%s' ]
		);

		return self::get_profile( $user_id ) ?? [];
	}

	public static function enable_for_user( int $user_id ): array {
		self::ensure_profile( $user_id );
		self::update_profile_fields( $user_id, [ 'enabled' => 1 ] );

		return self::get_profile( $user_id ) ?? [];
	}

	public static function update_identity( int $user_id, array $identity ): array {
		self::ensure_profile( $user_id );

		$update = [];
		if ( array_key_exists( 'class_slug', $identity ) ) {
			$update['class_slug'] = sanitize_key( (string) $identity['class_slug'] );
		}
		if ( array_key_exists( 'motivation_slug', $identity ) ) {
			$update['motivation_slug'] = sanitize_key( (string) $identity['motivation_slug'] );
		}
		if ( array_key_exists( 'starter_portrait_attachment_id', $identity ) ) {
			$update['starter_portrait_attachment_id'] = max( 0, (int) $identity['starter_portrait_attachment_id'] );
		}
		if ( array_key_exists( 'enabled', $identity ) ) {
			$update['enabled'] = ! empty( $identity['enabled'] ) ? 1 : 0;
		}

		if ( ! empty( $update ) ) {
			self::update_profile_fields( $user_id, $update );
		}

		return self::get_profile( $user_id ) ?? [];
	}

	public static function update_progression( int $user_id, int $xp_delta = 0, int $gold_delta = 0 ): array {
		$profile = self::ensure_profile( $user_id );

		$new_xp    = max( 0, (int) ( $profile['xp'] ?? 0 ) + $xp_delta );
		$new_gold  = max( 0, (int) ( $profile['gold'] ?? 0 ) + $gold_delta );
		$new_level = IronQuestProgressionService::level_for_xp( $new_xp );

		self::update_profile_fields(
			$user_id,
			[
				'xp'    => $new_xp,
				'gold'  => $new_gold,
				'level' => $new_level,
			]
		);

		return self::get_profile( $user_id ) ?? [];
	}

	public static function set_location_and_mission( int $user_id, string $location_slug, string $mission_slug = '' ): array {
		self::ensure_profile( $user_id );

		self::update_profile_fields(
			$user_id,
			[
				'current_location_slug' => sanitize_key( $location_slug ),
				'active_mission_slug'   => sanitize_key( $mission_slug ),
			]
		);

		return self::get_profile( $user_id ) ?? [];
	}

	public static function set_hp( int $user_id, int $hp_current, ?int $hp_max = null ): array {
		$profile = self::ensure_profile( $user_id );
		$max     = null === $hp_max ? (int) ( $profile['hp_max'] ?? 100 ) : max( 1, $hp_max );
		$current = max( 0, min( $max, $hp_current ) );

		self::update_profile_fields(
			$user_id,
			[
				'hp_current' => $current,
				'hp_max'     => $max,
			]
		);

		return self::get_profile( $user_id ) ?? [];
	}

	private static function resolve_start_mission_slug( string $location_slug ): string {
		$missions = IronQuestRegistryService::get_location_missions( $location_slug );
		if ( empty( $missions ) ) {
			return '';
		}

		return sanitize_key( (string) ( $missions[0]['slug'] ?? '' ) );
	}

	private static function update_profile_fields( int $user_id, array $fields ): bool {
		if ( empty( $fields ) ) {
			return true;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'fit_ironquest_profiles';
		$formats = [];

		foreach ( $fields as $key => $value ) {
			$formats[] = is_int( $value ) ? '%d' : '%s';
		}

		$updated = $wpdb->update(
			$table,
			$fields,
			[ 'user_id' => $user_id ],
			$formats,
			[ '%d' ]
		);

		return false !== $updated;
	}

	private static function normalize_profile_row( array $row ): array {
		return [
			'id'                            => (int) ( $row['id'] ?? 0 ),
			'user_id'                       => (int) ( $row['user_id'] ?? 0 ),
			'enabled'                       => ! empty( $row['enabled'] ),
			'class_slug'                    => sanitize_key( (string) ( $row['class_slug'] ?? '' ) ),
			'motivation_slug'               => sanitize_key( (string) ( $row['motivation_slug'] ?? '' ) ),
			'level'                         => (int) ( $row['level'] ?? 1 ),
			'xp'                            => (int) ( $row['xp'] ?? 0 ),
			'gold'                          => (int) ( $row['gold'] ?? 0 ),
			'hp_current'                    => (int) ( $row['hp_current'] ?? 100 ),
			'hp_max'                        => (int) ( $row['hp_max'] ?? 100 ),
			'current_location_slug'         => sanitize_key( (string) ( $row['current_location_slug'] ?? '' ) ),
			'active_mission_slug'           => sanitize_key( (string) ( $row['active_mission_slug'] ?? '' ) ),
			'starter_portrait_attachment_id' => (int) ( $row['starter_portrait_attachment_id'] ?? 0 ),
			'created_at'                    => (string) ( $row['created_at'] ?? '' ),
			'updated_at'                    => (string) ( $row['updated_at'] ?? '' ),
		];
	}
}
