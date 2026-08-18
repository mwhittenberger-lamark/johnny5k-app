<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class AnnouncementTickerService {
	public const OPTION_KEY = 'jf_announcement_ticker_messages';
	private const DEFAULT_MESSAGES = [
		[
			'id'        => 'johnny_welcome',
			'label'     => 'Johnny says',
			'message'   => 'Small choices stack up. Pick the next one you’ll be proud of.',
			'url'       => '',
			'active'    => true,
			'starts_at' => '',
			'ends_at'   => '',
			'priority'  => 50,
		],
	];

	/** @return array<int,array<string,mixed>> */
	public static function get_all(): array {
		$missing = '__johnny5k_ticker_option_missing__';
		$messages = get_option( self::OPTION_KEY, $missing );
		if ( $missing === $messages ) return self::DEFAULT_MESSAGES;
		return is_array( $messages ) ? array_values( $messages ) : [];
	}

	/** @return array<int,array<string,mixed>> */
	public static function sanitize_messages( $raw ): array {
		$rows = is_array( $raw ) ? $raw : [];
		$messages = [];
		foreach ( array_slice( $rows, 0, 20 ) as $index => $row ) {
			if ( ! is_array( $row ) ) continue;
			$message = sanitize_text_field( (string) ( $row['message'] ?? '' ) );
			if ( '' === $message ) continue;
			$url = trim( (string) ( $row['url'] ?? '' ) );
			if ( str_starts_with( $url, '//' ) ) {
				$url = '';
			} elseif ( '' !== $url && ! str_starts_with( $url, '/' ) ) {
				$url = str_starts_with( strtolower( $url ), 'https://' ) ? esc_url_raw( $url ) : '';
			}
			$messages[] = [
				'id'        => sanitize_key( (string) ( $row['id'] ?? '' ) ) ?: 'wire_' . ( $index + 1 ),
				'label'     => mb_substr( sanitize_text_field( (string) ( $row['label'] ?? 'Johnny says' ) ), 0, 28 ),
				'message'   => mb_substr( $message, 0, 220 ),
				'url'       => mb_substr( $url, 0, 500 ),
				'active'    => ! empty( $row['active'] ),
				'starts_at' => self::sanitize_datetime( (string) ( $row['starts_at'] ?? '' ) ),
				'ends_at'   => self::sanitize_datetime( (string) ( $row['ends_at'] ?? '' ) ),
				'priority'  => max( 0, min( 100, (int) ( $row['priority'] ?? 50 ) ) ),
			];
		}
		usort( $messages, static fn( array $a, array $b ): int => $b['priority'] <=> $a['priority'] );
		return $messages;
	}

	/** @return array<int,array<string,string|int>> */
	public static function get_active(): array {
		$now = new \DateTimeImmutable( 'now', wp_timezone() );
		$active = [];
		foreach ( self::get_all() as $row ) {
			if ( empty( $row['active'] ) || empty( $row['message'] ) ) continue;
			$starts = ! empty( $row['starts_at'] ) ? new \DateTimeImmutable( (string) $row['starts_at'], wp_timezone() ) : null;
			$ends = ! empty( $row['ends_at'] ) ? new \DateTimeImmutable( (string) $row['ends_at'], wp_timezone() ) : null;
			if ( $starts && $starts > $now ) continue;
			if ( $ends && $ends < $now ) continue;
			$active[] = [
				'id'       => sanitize_key( (string) ( $row['id'] ?? '' ) ),
				'label'    => sanitize_text_field( (string) ( $row['label'] ?? 'Johnny says' ) ),
				'message'  => sanitize_text_field( (string) $row['message'] ),
				'url'      => (string) ( $row['url'] ?? '' ),
				'priority' => (int) ( $row['priority'] ?? 50 ),
			];
		}
		return array_slice( $active, 0, 12 );
	}

	private static function sanitize_datetime( string $value ): string {
		$value = sanitize_text_field( $value );
		if ( '' === $value ) return '';
		$date = \DateTimeImmutable::createFromFormat( 'Y-m-d\TH:i', $value, wp_timezone() );
		return $date ? $date->format( 'Y-m-d H:i:s' ) : '';
	}
}
