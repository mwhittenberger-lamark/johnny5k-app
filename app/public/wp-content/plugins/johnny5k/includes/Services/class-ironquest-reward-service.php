<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestRewardService {

	public static function record_activity_award(
		int $user_id,
		string $source_type,
		string $source_key,
		string $award_type,
		array $payload = []
	): array|\WP_Error {
		global $wpdb;

		$table      = $wpdb->prefix . 'fit_ironquest_activity_ledger';
		$source_type = sanitize_key( $source_type );
		$source_key  = sanitize_text_field( $source_key );
		$award_type  = sanitize_key( $award_type );

		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND source_type = %s AND source_key = %s AND award_type = %s LIMIT 1",
				$user_id,
				$source_type,
				$source_key,
				$award_type
			)
		);

		if ( $existing_id > 0 ) {
			return [
				'id'        => $existing_id,
				'duplicate' => true,
			];
		}

		$inserted = $wpdb->insert(
			$table,
			[
				'user_id'     => $user_id,
				'source_type' => $source_type,
				'source_key'  => $source_key,
				'award_type'  => $award_type,
				'payload_json'=> wp_json_encode( $payload ),
			],
			[ '%d', '%s', '%s', '%s', '%s' ]
		);

		if ( false === $inserted ) {
			return new \WP_Error( 'ironquest_ledger_insert_failed', 'Could not record the IronQuest activity award.' );
		}

		return [
			'id'        => (int) $wpdb->insert_id,
			'duplicate' => false,
		];
	}

	public static function upsert_activity_award(
		int $user_id,
		string $source_type,
		string $source_key,
		string $award_type,
		array $payload = []
	): array|\WP_Error {
		global $wpdb;

		$table       = $wpdb->prefix . 'fit_ironquest_activity_ledger';
		$source_type = sanitize_key( $source_type );
		$source_key  = sanitize_text_field( $source_key );
		$award_type  = sanitize_key( $award_type );

		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND source_type = %s AND source_key = %s AND award_type = %s LIMIT 1",
				$user_id,
				$source_type,
				$source_key,
				$award_type
			)
		);

		if ( $existing_id > 0 ) {
			$updated = $wpdb->update(
				$table,
				[
					'payload_json' => wp_json_encode( $payload ),
				],
				[
					'id'      => $existing_id,
					'user_id' => $user_id,
				],
				[ '%s' ],
				[ '%d', '%d' ]
			);

			if ( false === $updated ) {
				return new \WP_Error( 'ironquest_ledger_update_failed', 'Could not update the IronQuest activity award.' );
			}

			return [
				'id'        => $existing_id,
				'duplicate' => true,
				'updated'   => true,
			];
		}

		return self::record_activity_award( $user_id, $source_type, $source_key, $award_type, $payload );
	}

	public static function has_activity_award( int $user_id, string $source_type, string $source_key, string $award_type ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_activity_ledger';
		$count = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND source_type = %s AND source_key = %s AND award_type = %s",
				$user_id,
				sanitize_key( $source_type ),
				sanitize_text_field( $source_key ),
				sanitize_key( $award_type )
			)
		);

		return $count > 0;
	}

	public static function list_activity_awards( int $user_id, string $source_type = '', string $award_type = '' ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'fit_ironquest_activity_ledger';
		$where  = [ 'user_id = %d' ];
		$params = [ $user_id ];

		if ( '' !== $source_type ) {
			$where[]  = 'source_type = %s';
			$params[] = sanitize_key( $source_type );
		}

		if ( '' !== $award_type ) {
			$where[]  = 'award_type = %s';
			$params[] = sanitize_key( $award_type );
		}

		$query = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY created_at DESC';
		$rows  = $wpdb->get_results( $wpdb->prepare( $query, ...$params ), ARRAY_A );

		return array_values(
			array_map(
				static function ( array $row ): array {
					return [
						'id'          => (int) ( $row['id'] ?? 0 ),
						'user_id'     => (int) ( $row['user_id'] ?? 0 ),
						'source_type' => sanitize_key( (string) ( $row['source_type'] ?? '' ) ),
						'source_key'  => sanitize_text_field( (string) ( $row['source_key'] ?? '' ) ),
						'award_type'  => sanitize_key( (string) ( $row['award_type'] ?? '' ) ),
						'payload'     => json_decode( (string) ( $row['payload_json'] ?? '' ), true ) ?: [],
						'created_at'  => (string) ( $row['created_at'] ?? '' ),
					];
				},
				is_array( $rows ) ? $rows : []
			)
		);
	}

	public static function grant_unlock( int $user_id, string $unlock_type, string $unlock_key, ?int $source_run_id = null, array $meta = [] ): array|\WP_Error {
		global $wpdb;

		$table       = $wpdb->prefix . 'fit_ironquest_unlocks';
		$unlock_type = sanitize_key( $unlock_type );
		$unlock_key  = sanitize_key( $unlock_key );

		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND unlock_type = %s AND unlock_key = %s LIMIT 1",
				$user_id,
				$unlock_type,
				$unlock_key
			)
		);

		if ( $existing_id > 0 ) {
			return [
				'id'        => $existing_id,
				'duplicate' => true,
			];
		}

		$inserted = $wpdb->insert(
			$table,
			[
				'user_id'       => $user_id,
				'unlock_type'   => $unlock_type,
				'unlock_key'    => $unlock_key,
				'source_run_id' => $source_run_id ?: null,
				'meta_json'     => wp_json_encode( $meta ),
			],
			[ '%d', '%s', '%s', '%d', '%s' ]
		);

		if ( false === $inserted ) {
			return new \WP_Error( 'ironquest_unlock_insert_failed', 'Could not record the IronQuest unlock.' );
		}

		return [
			'id'        => (int) $wpdb->insert_id,
			'duplicate' => false,
		];
	}

	public static function list_unlocks( int $user_id, string $unlock_type = '' ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_unlocks';
		if ( '' !== $unlock_type ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM {$table} WHERE user_id = %d AND unlock_type = %s ORDER BY created_at DESC",
					$user_id,
					sanitize_key( $unlock_type )
				),
				ARRAY_A
			);
		} else {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM {$table} WHERE user_id = %d ORDER BY created_at DESC",
					$user_id
				),
				ARRAY_A
			);
		}

		$rows = self::repair_unlock_rows( $user_id, is_array( $rows ) ? $rows : [] );

		return array_values(
			array_map(
				static function ( array $row ): array {
					return [
						'id'           => (int) ( $row['id'] ?? 0 ),
						'user_id'      => (int) ( $row['user_id'] ?? 0 ),
						'unlock_type'  => sanitize_key( (string) ( $row['unlock_type'] ?? '' ) ),
						'unlock_key'   => sanitize_key( (string) ( $row['unlock_key'] ?? '' ) ),
						'source_run_id'=> (int) ( $row['source_run_id'] ?? 0 ),
						'meta'         => json_decode( (string) ( $row['meta_json'] ?? '' ), true ) ?: [],
						'created_at'   => (string) ( $row['created_at'] ?? '' ),
					];
				},
				is_array( $rows ) ? $rows : []
			)
		);
	}

	private static function repair_unlock_rows( int $user_id, array $rows ): array {
		foreach ( $rows as $index => $row ) {
			$repaired = self::repair_journal_unlock_row( $user_id, is_array( $row ) ? $row : [] );
			if ( ! empty( $repaired ) ) {
				$rows[ $index ] = $repaired;
			}
		}

		return $rows;
	}

	private static function repair_journal_unlock_row( int $user_id, array $row ): array {
		if ( 'journal_entry' !== sanitize_key( (string) ( $row['unlock_type'] ?? '' ) ) ) {
			return $row;
		}

		$unlock_id      = (int) ( $row['id'] ?? 0 );
		$source_run_id  = (int) ( $row['source_run_id'] ?? 0 );
		$meta           = json_decode( (string) ( $row['meta_json'] ?? '' ), true ) ?: [];
		$current_entry  = sanitize_textarea_field( (string) ( $meta['entry'] ?? '' ) );

		if ( $unlock_id <= 0 || $source_run_id <= 0 || '' === $current_entry || ! self::has_narrative_placeholders( $current_entry ) ) {
			return $row;
		}

		$run = IronQuestMissionService::get_run( $source_run_id, $user_id );
		if ( empty( $run ) || 'completed' !== sanitize_key( (string) ( $run['status'] ?? '' ) ) ) {
			return $row;
		}

		$story_state = IronQuestNarrativeService::get_or_create_story_state( $user_id, $run );
		$summary     = sanitize_textarea_field( (string) ( $story_state['conclusion']['summary'] ?? '' ) );

		if ( '' === $summary && '' !== (string) ( $run['result_band'] ?? '' ) ) {
			$story_state = IronQuestNarrativeService::complete_story(
				$user_id,
				$run,
				(string) $run['result_band'],
				[
					'xp'   => (int) ( $run['xp_awarded'] ?? 0 ),
					'gold' => (int) ( $run['gold_awarded'] ?? 0 ),
				]
			);
			$summary = sanitize_textarea_field( (string) ( $story_state['conclusion']['summary'] ?? '' ) );
		}

		if ( '' === $summary || self::has_narrative_placeholders( $summary ) ) {
			return $row;
		}

		$meta['entry'] = $summary;
		$meta_json     = wp_json_encode( $meta );
		if ( ! is_string( $meta_json ) || '' === $meta_json ) {
			return $row;
		}

		if ( self::update_unlock_meta_json( $unlock_id, $user_id, $meta_json ) ) {
			$row['meta_json'] = $meta_json;
		}

		return $row;
	}

	private static function update_unlock_meta_json( int $unlock_id, int $user_id, string $meta_json ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_unlocks';
		$updated = $wpdb->update(
			$table,
			[
				'meta_json' => $meta_json,
			],
			[
				'id'      => $unlock_id,
				'user_id' => $user_id,
			],
			[ '%s' ],
			[ '%d', '%d' ]
		);

		return false !== $updated;
	}

	private static function has_narrative_placeholders( string $value ): bool {
		return 1 === preg_match( '/\{[a-z_]+\}/', $value );
	}
}
