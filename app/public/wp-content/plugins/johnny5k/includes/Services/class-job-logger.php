<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class JobLogger {
	private const LOG_OPTION = 'jf_background_job_logs';
	private const HEALTH_OPTION = 'jf_background_job_health';
	private const ACTIVE_RUNS_OPTION = 'jf_background_job_active_runs';
	private const MAX_ENTRIES = 200;

	public static function record_start( int $action_id, string $hook, array $args = [], string $context = '' ): void {
		$active_runs = self::get_option_array( self::ACTIVE_RUNS_OPTION );
		$active_runs[ (string) $action_id ] = [
			'hook' => $hook,
			'started_at' => time(),
		];
		update_option( self::ACTIVE_RUNS_OPTION, $active_runs );

		self::update_health( $hook, [
			'last_started_at' => current_time( 'mysql', true ),
			'last_action_id' => $action_id,
			'last_status' => 'running',
		] );

		self::append_entry( $hook, 'start', [
			'action_id' => $action_id,
			'context' => $context,
			'args' => self::sanitize_payload( $args ),
		] );
	}

	public static function record_success( int $action_id, string $hook, array $args = [], string $context = '' ): void {
		$duration = self::clear_active_run( $action_id );

		self::update_health( $hook, [
			'last_success_at' => current_time( 'mysql', true ),
			'last_action_id' => $action_id,
			'last_status' => 'success',
			'last_error' => '',
			'last_duration_seconds' => $duration,
		] );

		self::append_entry( $hook, 'success', [
			'action_id' => $action_id,
			'context' => $context,
			'args' => self::sanitize_payload( $args ),
			'duration_seconds' => $duration,
		] );
	}

	public static function record_failure( int $action_id, string $hook, array $args = [], string $message = '', string $context = '' ): void {
		$duration = self::clear_active_run( $action_id );

		self::update_health( $hook, [
			'last_failure_at' => current_time( 'mysql', true ),
			'last_action_id' => $action_id,
			'last_status' => 'failed',
			'last_error' => sanitize_text_field( $message ),
			'last_duration_seconds' => $duration,
		] );

		self::append_entry( $hook, 'failure', [
			'action_id' => $action_id,
			'context' => $context,
			'args' => self::sanitize_payload( $args ),
			'message' => $message,
			'duration_seconds' => $duration,
		] );
	}

	public static function record_retry_scheduled( string $hook, array $args = [], int $attempt = 1, int $delay = 0 ): void {
		self::update_health( $hook, [
			'last_retry_at' => current_time( 'mysql', true ),
			'last_retry_attempt' => $attempt,
		] );

		self::append_entry( $hook, 'retry_scheduled', [
			'attempt' => $attempt,
			'delay_seconds' => $delay,
			'args' => self::sanitize_payload( $args ),
		] );
	}

	public static function record_retry_skipped( string $hook, array $args = [], string $reason = '' ): void {
		self::append_entry( $hook, 'retry_skipped', [
			'reason' => $reason,
			'args' => self::sanitize_payload( $args ),
		] );
	}

	public static function list_entries( int $limit = 50 ): array {
		$entries = self::get_option_array( self::LOG_OPTION );
		return array_slice( $entries, 0, max( 1, $limit ) );
	}

	public static function health_for_hook( string $hook ): array {
		$health = self::get_option_array( self::HEALTH_OPTION );
		return is_array( $health[ $hook ] ?? null ) ? $health[ $hook ] : [];
	}

	private static function append_entry( string $hook, string $event, array $payload ): void {
		$entries = self::get_option_array( self::LOG_OPTION );
		array_unshift( $entries, [
			'hook' => $hook,
			'event' => $event,
			'created_at' => current_time( 'mysql', true ),
			'payload' => self::sanitize_payload( $payload ),
		] );

		$entries = array_slice( $entries, 0, self::MAX_ENTRIES );
		update_option( self::LOG_OPTION, $entries );
	}

	private static function update_health( string $hook, array $values ): void {
		$health = self::get_option_array( self::HEALTH_OPTION );
		$current = is_array( $health[ $hook ] ?? null ) ? $health[ $hook ] : [];
		$health[ $hook ] = array_merge( $current, self::sanitize_payload( $values ) );
		update_option( self::HEALTH_OPTION, $health );
	}

	private static function clear_active_run( int $action_id ): int {
		$active_runs = self::get_option_array( self::ACTIVE_RUNS_OPTION );
		$run = $active_runs[ (string) $action_id ] ?? null;
		unset( $active_runs[ (string) $action_id ] );
		update_option( self::ACTIVE_RUNS_OPTION, $active_runs );

		if ( ! is_array( $run ) || ! isset( $run['started_at'] ) ) {
			return 0;
		}

		return max( 0, time() - (int) $run['started_at'] );
	}

	private static function get_option_array( string $key ): array {
		$value = get_option( $key, [] );
		return is_array( $value ) ? $value : [];
	}

	private static function sanitize_payload( array $payload ): array {
		$normalized = [];

		foreach ( $payload as $key => $value ) {
			$normalized_key = sanitize_key( (string) $key );
			if ( '' === $normalized_key ) {
				continue;
			}

			if ( is_array( $value ) ) {
				$encoded = wp_json_encode( $value );
				$normalized[ $normalized_key ] = false !== $encoded ? substr( $encoded, 0, 2000 ) : '[]';
				continue;
			}

			if ( is_bool( $value ) ) {
				$normalized[ $normalized_key ] = $value ? '1' : '0';
				continue;
			}

			if ( is_scalar( $value ) || null === $value ) {
				$normalized[ $normalized_key ] = sanitize_text_field( (string) $value );
			}
		}

		return $normalized;
	}
}