<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class InternalDiagnosticsLogger {

	private const OPTION_KEY = 'jf_internal_diagnostics_log';
	private const MAX_ENTRIES = 100;

	public static function record_johnny_chat_result( int $user_id, string $thread_key, string $prompt, array $result ): array {
		$tool_errors = is_array( $result['tool_errors'] ?? null ) ? $result['tool_errors'] : [];
		$first_error = '';
		if ( ! empty( $tool_errors[0]['error'] ) ) {
			$first_error = sanitize_text_field( (string) $tool_errors[0]['error'] );
		}

		return self::record_client_event(
			[
				'source'        => 'johnny_chat',
				'message'       => substr( sanitize_textarea_field( $prompt ), 0, 500 ),
				'error_message' => $first_error,
				'status_code'   => '' === $first_error ? 200 : 500,
				'current_path'  => '/dashboard',
				'context'       => [
					'thread_key'     => sanitize_text_field( $thread_key ),
					'reply'          => substr( sanitize_textarea_field( (string) ( $result['reply'] ?? '' ) ), 0, 1000 ),
					'used_tools'     => is_array( $result['used_tools'] ?? null ) ? $result['used_tools'] : [],
					'action_results' => is_array( $result['action_results'] ?? null ) ? $result['action_results'] : [],
					'tool_errors'    => $tool_errors,
					'model'          => sanitize_text_field( (string) ( $result['model'] ?? '' ) ),
				],
			],
			$user_id
		);
	}

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
