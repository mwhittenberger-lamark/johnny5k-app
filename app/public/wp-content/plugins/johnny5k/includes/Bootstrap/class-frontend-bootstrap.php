<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

class FrontendBootstrap {

	private const STATIC_FILE_MAP = [
		'/manifest.webmanifest' => 'manifest.webmanifest',
		'/sw.js'                => 'sw.js',
		'/favicon.svg'          => 'favicon.svg',
		'/brandmark.png'        => 'brandmark.png',
	];

	private const APP_ROUTE_PREFIXES = [
		'/login',
		'/register',
		'/forgot-password',
		'/reset-password',
		'/onboarding',
		'/dashboard',
		'/workout',
		'/nutrition',
		'/body',
		'/activity-log',
		'/progress-photos',
		'/rewards',
		'/ironquest',
		'/ai',
		'/settings',
		'/admin',
	];

	public static function init(): void {
		add_action( 'template_redirect', [ __CLASS__, 'maybe_serve_pwa_request' ], 0 );
	}

	public static function maybe_serve_pwa_request(): void {
		if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$request_path = wp_parse_url( $request_uri, PHP_URL_PATH );
		$request_path = is_string( $request_path ) ? self::normalize_request_path( $request_path ) : '/';

		if ( self::maybe_serve_static_asset( $request_path ) ) {
			exit;
		}

		if ( ! self::is_pwa_route_request( $request_path ) ) {
			return;
		}

		$index_file = self::dist_path( 'index.html' );
		if ( ! file_exists( $index_file ) ) {
			return;
		}

		status_header( 200 );
		nocache_headers();
		header( 'Content-Type: text/html; charset=UTF-8' );
		readfile( $index_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}

	private static function maybe_serve_static_asset( string $request_path ): bool {
		if ( isset( self::STATIC_FILE_MAP[ $request_path ] ) ) {
			return self::stream_file( self::dist_path( self::STATIC_FILE_MAP[ $request_path ] ), false );
		}

		if ( str_starts_with( $request_path, '/assets/' ) || str_starts_with( $request_path, '/icons/' ) ) {
			$relative_path = ltrim( $request_path, '/' );
			return self::stream_file( self::dist_path( $relative_path ), true );
		}

		return false;
	}

	private static function is_pwa_route_request( string $request_path ): bool {
		if ( '/' === $request_path ) {
			return true;
		}

		foreach ( self::APP_ROUTE_PREFIXES as $prefix ) {
			if ( $request_path === $prefix || str_starts_with( $request_path, $prefix . '/' ) ) {
				return true;
			}
		}

		return false;
	}

	private static function stream_file( string $file_path, bool $public_cache ): bool {
		if ( ! file_exists( $file_path ) || ! is_readable( $file_path ) ) {
			return false;
		}

		$mime_type = self::mime_type_for_path( $file_path );
		status_header( 200 );
		if ( $public_cache ) {
			header( 'Cache-Control: public, max-age=31536000, immutable' );
		} else {
			header( 'Cache-Control: no-cache, must-revalidate, max-age=0' );
		}

		header( 'Content-Type: ' . $mime_type );
		header( 'Content-Length: ' . (string) filesize( $file_path ) );
		readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		return true;
	}

	private static function mime_type_for_path( string $file_path ): string {
		$extension = strtolower( pathinfo( $file_path, PATHINFO_EXTENSION ) );

		return match ( $extension ) {
			'js', 'mjs'   => 'text/javascript; charset=UTF-8',
			'css'         => 'text/css; charset=UTF-8',
			'json', 'map' => 'application/json; charset=UTF-8',
			'webmanifest' => 'application/manifest+json; charset=UTF-8',
			'png'         => 'image/png',
			'jpg', 'jpeg' => 'image/jpeg',
			'webp'        => 'image/webp',
			'svg'         => 'image/svg+xml',
			'ico'         => 'image/x-icon',
			default       => 'application/octet-stream',
		};
	}

	private static function dist_path( string $relative_path ): string {
		return JF_PLUGIN_DIR . 'pwa/dist/' . ltrim( $relative_path, '/' );
	}

	private static function normalize_request_path( string $request_path ): string {
		$normalized = '/' . ltrim( $request_path, '/' );
		if ( '/' !== $normalized ) {
			$normalized = rtrim( $normalized, '/' );
		}

		return $normalized;
	}
}
