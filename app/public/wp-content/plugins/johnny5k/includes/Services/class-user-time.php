<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class UserTime {
	public static function sanitize_timezone( ?string $timezone ): string {
		$candidate = sanitize_text_field( (string) $timezone );
		if ( $candidate && in_array( $candidate, timezone_identifiers_list(), true ) ) {
			return $candidate;
		}

		$site_timezone = wp_timezone_string();
		return $site_timezone ?: 'UTC';
	}

	public static function timezone_string( int $user_id ): string {
		global $wpdb;

		$timezone = $wpdb->get_var( $wpdb->prepare(
			"SELECT timezone FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d LIMIT 1",
			$user_id
		) );

		return self::sanitize_timezone( is_string( $timezone ) ? $timezone : null );
	}

	public static function timezone( int $user_id ): \DateTimeZone {
		return new \DateTimeZone( self::timezone_string( $user_id ) );
	}

	public static function now( int $user_id ): \DateTimeImmutable {
		$test_now = $GLOBALS['johnny5k_test_now'] ?? null;
		if ( is_string( $test_now ) && '' !== trim( $test_now ) ) {
			try {
				return new \DateTimeImmutable( $test_now, self::timezone( $user_id ) );
			} catch ( \Exception $e ) {
				// Fall through to real time when the override is invalid.
			}
		}

		return new \DateTimeImmutable( 'now', self::timezone( $user_id ) );
	}

	public static function today( int $user_id ): string {
		return self::now( $user_id )->format( 'Y-m-d' );
	}

	public static function tomorrow( int $user_id ): string {
		return self::now( $user_id )->modify( '+1 day' )->format( 'Y-m-d' );
	}

	public static function yesterday( int $user_id ): string {
		return self::now( $user_id )->modify( '-1 day' )->format( 'Y-m-d' );
	}

	public static function days_ago( int $user_id, int $days ): string {
		return self::now( $user_id )->modify( sprintf( '-%d day', max( 0, $days ) ) )->format( 'Y-m-d' );
	}

	public static function mysql( int $user_id ): string {
		return self::now( $user_id )->format( 'Y-m-d H:i:s' );
	}

	public static function weekday_order_for_date( int $user_id, string $date ): int {
		return (int) self::date_for_user( $user_id, $date )->format( 'N' );
	}

	public static function weekday_label_for_date( int $user_id, string $date ): string {
		return self::date_for_user( $user_id, $date )->format( 'D' );
	}

	private static function date_for_user( int $user_id, string $date ): \DateTimeImmutable {
		$datetime = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $date . ' 12:00:00', self::timezone( $user_id ) );
		if ( false === $datetime ) {
			return self::now( $user_id );
		}

		return $datetime;
	}
}