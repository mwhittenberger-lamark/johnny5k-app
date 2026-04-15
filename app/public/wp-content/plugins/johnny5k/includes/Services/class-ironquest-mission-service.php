<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestMissionService {

	public static function start_run( int $user_id, string $mission_slug, string $location_slug, string $run_type = 'workout', string $source_session_id = '' ): array|\WP_Error {
		global $wpdb;

		$mission_slug = sanitize_key( $mission_slug );
		$location_slug = sanitize_key( $location_slug );
		$run_type = sanitize_key( $run_type );
		$source_session_id = sanitize_text_field( $source_session_id );

		$mission = self::find_registry_mission( $mission_slug, $location_slug );
		if ( empty( $mission ) ) {
			return new \WP_Error( 'ironquest_mission_not_found', 'The requested IronQuest mission does not exist in the seed registry.' );
		}

		$table = $wpdb->prefix . 'fit_ironquest_mission_runs';
		$wpdb->insert(
			$table,
			[
				'user_id'           => $user_id,
				'mission_slug'      => $mission_slug,
				'location_slug'     => $location_slug,
				'run_type'          => $run_type,
				'source_session_id' => $source_session_id,
				'status'            => 'active',
				'encounter_phase'   => 'intro',
			],
			[ '%d', '%s', '%s', '%s', '%s', '%s', '%s' ]
		);

		if ( ! $wpdb->insert_id ) {
			return new \WP_Error( 'ironquest_mission_run_create_failed', 'Could not create the IronQuest mission run.' );
		}

		IronQuestProfileService::set_location_and_mission( $user_id, $location_slug, $mission_slug );

		return self::get_run( (int) $wpdb->insert_id, $user_id ) ?? [];
	}

	public static function get_run( int $run_id, int $user_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_mission_runs';
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d AND user_id = %d LIMIT 1",
				$run_id,
				$user_id
			),
			ARRAY_A
		);

		return is_array( $row ) ? self::normalize_run_row( $row ) : null;
	}

	public static function get_active_run( int $user_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_mission_runs';
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE user_id = %d AND status = 'active' ORDER BY started_at DESC LIMIT 1",
				$user_id
			),
			ARRAY_A
		);

		return is_array( $row ) ? self::normalize_run_row( $row ) : null;
	}

	public static function complete_run( int $run_id, int $user_id, string $result_band, int $xp_awarded, int $gold_awarded ): array|\WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_mission_runs';
		$updated = $wpdb->update(
			$table,
			[
				'status'       => 'completed',
				'result_band'  => sanitize_key( $result_band ),
				'xp_awarded'   => max( 0, $xp_awarded ),
				'gold_awarded' => max( 0, $gold_awarded ),
				'completed_at' => current_time( 'mysql', true ),
			],
			[
				'id'      => $run_id,
				'user_id' => $user_id,
			],
			[ '%s', '%s', '%d', '%d', '%s' ],
			[ '%d', '%d' ]
		);

		if ( false === $updated ) {
			return new \WP_Error( 'ironquest_mission_run_complete_failed', 'Could not complete the IronQuest mission run.' );
		}

		return self::get_run( $run_id, $user_id ) ?? [];
	}

	public static function set_encounter_phase( int $run_id, int $user_id, string $encounter_phase ): array|\WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_mission_runs';
		$updated = $wpdb->update(
			$table,
			[ 'encounter_phase' => sanitize_key( $encounter_phase ) ],
			[ 'id' => $run_id, 'user_id' => $user_id ],
			[ '%s' ],
			[ '%d', '%d' ]
		);

		if ( false === $updated ) {
			return new \WP_Error( 'ironquest_mission_run_phase_failed', 'Could not update the IronQuest encounter phase.' );
		}

		return self::get_run( $run_id, $user_id ) ?? [];
	}

	public static function get_location_missions( string $location_slug ): array {
		return IronQuestRegistryService::get_location_missions( sanitize_key( $location_slug ) );
	}

	private static function find_registry_mission( string $mission_slug, string $location_slug ): ?array {
		foreach ( IronQuestRegistryService::get_location_missions( $location_slug ) as $mission ) {
			if ( ( $mission['slug'] ?? '' ) === $mission_slug ) {
				return $mission;
			}
		}

		return null;
	}

	private static function normalize_run_row( array $row ): array {
		return [
			'id'                => (int) ( $row['id'] ?? 0 ),
			'user_id'           => (int) ( $row['user_id'] ?? 0 ),
			'mission_slug'      => sanitize_key( (string) ( $row['mission_slug'] ?? '' ) ),
			'location_slug'     => sanitize_key( (string) ( $row['location_slug'] ?? '' ) ),
			'run_type'          => sanitize_key( (string) ( $row['run_type'] ?? '' ) ),
			'source_session_id' => sanitize_text_field( (string) ( $row['source_session_id'] ?? '' ) ),
			'status'            => sanitize_key( (string) ( $row['status'] ?? '' ) ),
			'encounter_phase'   => sanitize_key( (string) ( $row['encounter_phase'] ?? '' ) ),
			'result_band'       => sanitize_key( (string) ( $row['result_band'] ?? '' ) ),
			'xp_awarded'        => (int) ( $row['xp_awarded'] ?? 0 ),
			'gold_awarded'      => (int) ( $row['gold_awarded'] ?? 0 ),
			'started_at'        => (string) ( $row['started_at'] ?? '' ),
			'completed_at'      => (string) ( $row['completed_at'] ?? '' ),
		];
	}
}
