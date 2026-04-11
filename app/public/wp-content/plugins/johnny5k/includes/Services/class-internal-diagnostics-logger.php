<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class InternalDiagnosticsLogger {

	private const OPTION_KEY = 'jf_internal_diagnostics_log';
	private const MAX_ENTRIES = 100;

	public static function record_client_event( array $payload, int $user_id = 0 ): array {
		$user = $user_id > 0 ? get_user_by( 'id', $user_id ) : null;

		$entry = [
			'id'            => wp_generate_uuid4(),
			'created_at'    => current_time( 'mysql', true ),
			'user_id'       => $user_id,
			'user_email'    => $user instanceof \WP_User ? (string) $user->user_email : '',
			'source'        => sanitize_key( (string) ( $payload['source'] ?? '' ) ),
			'message'       => sanitize_text_field( (string) ( $payload['message'] ?? '' ) ),
			'error_message' => sanitize_text_field( (string) ( $payload['error_message'] ?? '' ) ),
			'status_code'   => (int) ( $payload['status_code'] ?? 0 ),
			'current_path'  => sanitize_text_field( (string) ( $payload['current_path'] ?? '' ) ),
			'current_url'   => esc_url_raw( (string) ( $payload['current_url'] ?? '' ) ),
			'user_agent'    => sanitize_text_field( (string) ( $payload['user_agent'] ?? '' ) ),
			'stack'         => self::sanitize_stack( (string) ( $payload['stack'] ?? '' ) ),
			'context'       => self::sanitize_context( $payload['context'] ?? [] ),
		];

		$entries = self::list_entries( self::MAX_ENTRIES );
		array_unshift( $entries, $entry );
		$entries = array_slice( $entries, 0, self::MAX_ENTRIES );

		update_option( self::OPTION_KEY, $entries, false );

		return $entry;
	}

	public static function list_entries( int $limit = self::MAX_ENTRIES ): array {
		$entries = get_option( self::OPTION_KEY, [] );
		if ( ! is_array( $entries ) ) {
			return [];
		}

		return array_slice( array_values( $entries ), 0, max( 1, $limit ) );
	}

	private static function sanitize_stack( string $stack ): string {
		$normalized = trim( wp_strip_all_tags( $stack ) );
		if ( '' === $normalized ) {
			return '';
		}

		return substr( $normalized, 0, 4000 );
	}

	private static function sanitize_context( $context ): array {
		if ( ! is_array( $context ) ) {
			return [];
		}

		$normalized = [];
		foreach ( $context as $key => $value ) {
			$normalized_key = sanitize_key( (string) $key );
			if ( '' === $normalized_key ) {
				continue;
			}

			if ( is_scalar( $value ) || null === $value ) {
				$normalized[ $normalized_key ] = sanitize_text_field( (string) $value );
				continue;
			}

			$encoded = wp_json_encode( $value );
			$normalized[ $normalized_key ] = $encoded ? substr( $encoded, 0, 1000 ) : '';
		}

		return $normalized;
	}
}