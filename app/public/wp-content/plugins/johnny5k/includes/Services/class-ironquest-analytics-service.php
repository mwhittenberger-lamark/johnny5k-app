<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestAnalyticsService {
	private const RECENT_EVENTS_OPTION = 'jf_ironquest_recent_events_v1';
	private const MAX_RECENT_EVENTS    = 200;

	public static function track(
		int $user_id,
		string $event_name,
		array $metadata = [],
		string $status = 'success',
		string $context = 'general',
		?float $value_num = null
	): void {
		$event_name = sanitize_key( $event_name );
		$status     = sanitize_key( $status );
		$context    = sanitize_key( $context );

		if ( '' === $event_name ) {
			return;
		}

		$metadata = self::sanitize_metadata( $metadata );
		$entry    = [
			'id'         => wp_generate_uuid4(),
			'created_at' => current_time( 'mysql', true ),
			'user_id'    => max( 0, $user_id ),
			'event_name' => $event_name,
			'status'     => '' !== $status ? $status : 'success',
			'context'    => '' !== $context ? $context : 'general',
			'metadata'   => $metadata,
		];

		$entries = get_option( self::RECENT_EVENTS_OPTION, [] );
		$entries = is_array( $entries ) ? array_values( $entries ) : [];
		array_unshift( $entries, $entry );
		update_option( self::RECENT_EVENTS_OPTION, array_slice( $entries, 0, self::MAX_RECENT_EVENTS ), false );

		if ( $user_id > 0 ) {
			BehaviorAnalyticsService::track(
				$user_id,
				'ironquest_' . $event_name,
				'ironquest',
				$entry['context'],
				$value_num,
				array_merge(
					$metadata,
					[
						'status' => $entry['status'],
					]
				)
			);
		}
	}

	public static function track_failure(
		int $user_id,
		string $event_name,
		string $message,
		array $metadata = [],
		string $context = 'general',
		int $status_code = 0
	): void {
		$message = sanitize_text_field( $message );
		if ( '' !== $message ) {
			$metadata['error_message'] = $message;
		}
		if ( $status_code > 0 ) {
			$metadata['status_code'] = $status_code;
		}

		self::track( $user_id, $event_name, $metadata, 'failure', $context );
		InternalDiagnosticsLogger::record_client_event(
			[
				'source'        => 'ironquest_backend',
				'message'       => self::humanize_key( $event_name ),
				'error_message' => $message,
				'status_code'   => $status_code,
				'context'       => $metadata,
			],
			$user_id
		);
	}

	public static function list_recent_events( int $limit = 50, int $user_id = 0 ): array {
		$entries = get_option( self::RECENT_EVENTS_OPTION, [] );
		$entries = is_array( $entries ) ? array_values( array_filter( $entries, 'is_array' ) ) : [];

		if ( $user_id > 0 ) {
			$entries = array_values(
				array_filter(
					$entries,
					static fn( array $entry ): bool => (int) ( $entry['user_id'] ?? 0 ) === $user_id
				)
			);
		}

		return array_slice( $entries, 0, max( 1, $limit ) );
	}

	private static function sanitize_metadata( $metadata ): array {
		if ( ! is_array( $metadata ) ) {
			return [];
		}

		$clean = [];
		foreach ( $metadata as $key => $value ) {
			$normalized_key = sanitize_key( (string) $key );
			if ( '' === $normalized_key ) {
				continue;
			}

			if ( is_array( $value ) ) {
				$clean[ $normalized_key ] = self::sanitize_metadata( $value );
				continue;
			}

			if ( is_bool( $value ) ) {
				$clean[ $normalized_key ] = $value;
				continue;
			}

			if ( is_numeric( $value ) ) {
				$clean[ $normalized_key ] = 0 + $value;
				continue;
			}

			if ( null === $value ) {
				$clean[ $normalized_key ] = null;
				continue;
			}

			if ( is_scalar( $value ) ) {
				$clean[ $normalized_key ] = sanitize_text_field( (string) $value );
			}
		}

		return $clean;
	}

	private static function humanize_key( string $value ): string {
		$normalized = sanitize_key( $value );
		if ( '' === $normalized ) {
			return 'IronQuest Event';
		}

		return trim( preg_replace( '/\s+/', ' ', ucwords( str_replace( [ '_', '-' ], ' ', $normalized ) ) ) ?? '' );
	}
}
