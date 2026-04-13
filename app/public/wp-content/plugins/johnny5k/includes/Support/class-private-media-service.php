<?php
namespace Johnny5k\Support;

defined( 'ABSPATH' ) || exit;

class PrivateMediaService {
	public const PRIVATE_MEDIA_META_KEY = 'jf_private_media_path';
	private const DEFAULT_MAX_BYTES = 8388608;
	private const DEFAULT_MAX_WIDTH = 4096;
	private const DEFAULT_MAX_HEIGHT = 4096;

	public static function validate_uploaded_image( array $file, string $label = 'image' ): true|\WP_Error {
		$error = isset( $file['error'] ) ? (int) $file['error'] : UPLOAD_ERR_OK;
		if ( UPLOAD_ERR_OK !== $error ) {
			return new \WP_Error( 'invalid_upload', sprintf( 'The %s upload could not be processed.', $label ) );
		}

		$size = isset( $file['size'] ) ? (int) $file['size'] : 0;
		if ( $size <= 0 ) {
			return new \WP_Error( 'invalid_upload', sprintf( 'The %s file is empty.', $label ) );
		}
		if ( $size > self::DEFAULT_MAX_BYTES ) {
			return new \WP_Error( 'file_too_large', sprintf( 'The %s file exceeds the 8 MB limit.', $label ) );
		}

		$tmp_name = isset( $file['tmp_name'] ) ? (string) $file['tmp_name'] : '';
		if ( '' === $tmp_name || ! file_exists( $tmp_name ) ) {
			return new \WP_Error( 'invalid_upload', sprintf( 'The %s upload is missing its temporary file.', $label ) );
		}

		$details = self::inspect_image_file( $tmp_name );
		if ( is_wp_error( $details ) ) {
			return $details;
		}

		$mime = (string) $details['mime'];
		if ( ! in_array( $mime, self::allowed_mimes(), true ) ) {
			return new \WP_Error( 'invalid_image_type', sprintf( 'The %s must be a JPEG, PNG, or WebP image.', $label ) );
		}

		if ( (int) $details['width'] > self::DEFAULT_MAX_WIDTH || (int) $details['height'] > self::DEFAULT_MAX_HEIGHT ) {
			return new \WP_Error( 'image_too_large', sprintf( 'The %s dimensions exceed the allowed maximum.', $label ) );
		}

		$extension = strtolower( pathinfo( (string) ( $file['name'] ?? '' ), PATHINFO_EXTENSION ) );
		if ( '' !== $extension && ! self::extension_matches_mime( $extension, $mime ) ) {
			return new \WP_Error( 'invalid_image_extension', sprintf( 'The %s file extension does not match its image type.', $label ) );
		}

		return true;
	}

	public static function ensure_private_attachment( int $attachment_id, int $user_id = 0 ): true|\WP_Error {
		if ( $attachment_id <= 0 ) {
			return new \WP_Error( 'invalid_attachment', 'A valid attachment is required.' );
		}

		$path = self::attached_file_path( $attachment_id );
		if ( is_wp_error( $path ) ) {
			return $path;
		}

		if ( self::is_private_path( $path ) ) {
			self::mark_attachment_private( $attachment_id, $user_id, $path );
			return true;
		}

		$root = self::ensure_private_root();
		if ( is_wp_error( $root ) ) {
			return $root;
		}

		$target_dir = $root . DIRECTORY_SEPARATOR . gmdate( 'Y' ) . DIRECTORY_SEPARATOR . gmdate( 'm' );
		if ( ! file_exists( $target_dir ) && ! wp_mkdir_p( $target_dir ) ) {
			return new \WP_Error( 'private_media_dir_failed', 'The private media directory could not be created.' );
		}

		$filename = self::safe_filename( basename( $path ), $attachment_id );
		$target_path = self::unique_destination( $target_dir, $filename );
		if ( ! self::move_file( $path, $target_path ) ) {
			return new \WP_Error( 'private_media_move_failed', 'The private media file could not be secured.' );
		}

		if ( function_exists( 'update_attached_file' ) ) {
			update_attached_file( $attachment_id, $target_path );
		}
		self::mark_attachment_private( $attachment_id, $user_id, $target_path );

		return true;
	}

	public static function create_private_attachment_from_binary( int $user_id, string $mime_type, string $binary_data, string $filename, string $title = '' ): int|\WP_Error {
		$details = self::inspect_image_binary( $binary_data, $mime_type );
		if ( is_wp_error( $details ) ) {
			return $details;
		}

		$root = self::ensure_private_root();
		if ( is_wp_error( $root ) ) {
			return $root;
		}

		$target_dir = $root . DIRECTORY_SEPARATOR . gmdate( 'Y' ) . DIRECTORY_SEPARATOR . gmdate( 'm' );
		if ( ! file_exists( $target_dir ) && ! wp_mkdir_p( $target_dir ) ) {
			return new \WP_Error( 'private_media_dir_failed', 'The private media directory could not be created.' );
		}

		$extension = self::extension_for_mime( (string) $details['mime'] );
		$filename = self::safe_filename( $filename, $user_id, $extension );
		$target_path = self::unique_destination( $target_dir, $filename );

		if ( false === file_put_contents( $target_path, $binary_data ) ) {
			return new \WP_Error( 'generated_image_upload_failed', 'The generated image could not be written.' );
		}

		$attachment_id = wp_insert_attachment( [
			'post_mime_type' => (string) $details['mime'],
			'post_title'     => '' !== $title ? $title : 'Johnny private image',
			'post_status'    => 'inherit',
		], $target_path );
		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $target_path );
			return $attachment_id;
		}

		if ( function_exists( 'update_attached_file' ) ) {
			update_attached_file( (int) $attachment_id, $target_path );
		}
		if ( function_exists( 'wp_generate_attachment_metadata' ) && function_exists( 'wp_update_attachment_metadata' ) ) {
			$metadata = wp_generate_attachment_metadata( (int) $attachment_id, $target_path );
			wp_update_attachment_metadata( (int) $attachment_id, $metadata );
		}

		self::mark_attachment_private( (int) $attachment_id, $user_id, $target_path );
		return (int) $attachment_id;
	}

	public static function file_path_for_attachment( int $attachment_id ): string|\WP_Error {
		$path = '';
		if ( function_exists( 'get_post_meta' ) ) {
			$stored = get_post_meta( $attachment_id, self::PRIVATE_MEDIA_META_KEY, true );
			if ( is_string( $stored ) && '' !== $stored && file_exists( $stored ) ) {
				return $stored;
			}
		}

		$path = self::attached_file_path( $attachment_id );
		if ( is_wp_error( $path ) ) {
			return $path;
		}

		if ( self::attachment_is_private( $attachment_id ) && ! self::is_private_path( $path ) ) {
			$owner_user_id = function_exists( 'get_post_meta' ) ? (int) get_post_meta( $attachment_id, 'jf_owner_user_id', true ) : 0;
			$migrated = self::ensure_private_attachment( $attachment_id, $owner_user_id );
			if ( is_wp_error( $migrated ) ) {
				return $migrated;
			}
			return self::attached_file_path( $attachment_id );
		}

		return $path;
	}

	public static function attachment_to_data_url( int $attachment_id, string $missing_code, string $missing_message, ?array $allowed_mimes = null ): string|\WP_Error {
		$file_path = self::file_path_for_attachment( $attachment_id );
		if ( is_wp_error( $file_path ) ) {
			return new \WP_Error( $missing_code, $missing_message );
		}

		$size = @filesize( $file_path );
		if ( false === $size || $size <= 0 ) {
			return new \WP_Error( $missing_code, $missing_message );
		}
		if ( $size > self::DEFAULT_MAX_BYTES ) {
			return new \WP_Error( 'image_too_large', 'The image is too large to process safely.' );
		}

		$details = self::inspect_image_file( $file_path );
		if ( is_wp_error( $details ) ) {
			return $details;
		}

		$mime = (string) $details['mime'];
		$allowed_mimes = is_array( $allowed_mimes ) && ! empty( $allowed_mimes ) ? $allowed_mimes : self::allowed_mimes();
		if ( ! in_array( $mime, $allowed_mimes, true ) ) {
			return new \WP_Error( 'image_format_unsupported', 'The image format is not supported.' );
		}

		$contents = file_get_contents( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $contents ) {
			return new \WP_Error( 'attachment_read_failed', 'The image file could not be read.' );
		}

		return 'data:' . $mime . ';base64,' . base64_encode( $contents ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	private static function attached_file_path( int $attachment_id ): string|\WP_Error {
		if ( ! function_exists( 'get_attached_file' ) ) {
			return new \WP_Error( 'attachment_missing', 'The attachment file could not be resolved.' );
		}

		$file_path = get_attached_file( $attachment_id );
		if ( ! is_string( $file_path ) || '' === $file_path || ! file_exists( $file_path ) ) {
			return new \WP_Error( 'attachment_missing', 'The attachment file could not be found.' );
		}

		return $file_path;
	}

	private static function mark_attachment_private( int $attachment_id, int $user_id, string $path ): void {
		update_post_meta( $attachment_id, 'jf_private_photo', 1 );
		update_post_meta( $attachment_id, 'jf_owner_user_id', $user_id );
		update_post_meta( $attachment_id, self::PRIVATE_MEDIA_META_KEY, $path );
	}

	private static function attachment_is_private( int $attachment_id ): bool {
		return function_exists( 'get_post_meta' ) && (bool) get_post_meta( $attachment_id, 'jf_private_photo', true );
	}

	private static function inspect_image_file( string $file_path ): array|\WP_Error {
		$size = @filesize( $file_path );
		if ( false === $size || $size <= 0 ) {
			return new \WP_Error( 'invalid_image', 'The image file is empty.' );
		}

		$dimensions = function_exists( 'getimagesize' ) ? @getimagesize( $file_path ) : false;
		if ( false === $dimensions ) {
			return new \WP_Error( 'invalid_image', 'The uploaded file is not a valid image.' );
		}

		$mime = (string) ( $dimensions['mime'] ?? mime_content_type( $file_path ) ?: '' );
		return [
			'mime'   => $mime,
			'width'  => (int) ( $dimensions[0] ?? 0 ),
			'height' => (int) ( $dimensions[1] ?? 0 ),
			'size'   => (int) $size,
		];
	}

	private static function inspect_image_binary( string $binary_data, string $mime_type ): array|\WP_Error {
		$size = strlen( $binary_data );
		if ( $size <= 0 ) {
			return new \WP_Error( 'invalid_image', 'The generated image is empty.' );
		}
		if ( $size > self::DEFAULT_MAX_BYTES ) {
			return new \WP_Error( 'image_too_large', 'The generated image exceeds the 8 MB limit.' );
		}

		$dimensions = function_exists( 'getimagesizefromstring' ) ? @getimagesizefromstring( $binary_data ) : false;
		if ( false === $dimensions ) {
			return new \WP_Error( 'invalid_image', 'The generated image data is invalid.' );
		}

		$mime = (string) ( $dimensions['mime'] ?? sanitize_text_field( $mime_type ) );
		if ( ! in_array( $mime, self::allowed_mimes(), true ) ) {
			return new \WP_Error( 'invalid_image_type', 'The generated image must be a JPEG, PNG, or WebP image.' );
		}

		if ( (int) ( $dimensions[0] ?? 0 ) > self::DEFAULT_MAX_WIDTH || (int) ( $dimensions[1] ?? 0 ) > self::DEFAULT_MAX_HEIGHT ) {
			return new \WP_Error( 'image_too_large', 'The generated image dimensions exceed the allowed maximum.' );
		}

		return [
			'mime'   => $mime,
			'width'  => (int) ( $dimensions[0] ?? 0 ),
			'height' => (int) ( $dimensions[1] ?? 0 ),
			'size'   => $size,
		];
	}

	private static function ensure_private_root(): string|\WP_Error {
		$root = self::private_root();
		if ( ! file_exists( $root ) && ! wp_mkdir_p( $root ) ) {
			return new \WP_Error( 'private_media_dir_failed', 'The private media directory could not be created.' );
		}

		self::write_guard_files( $root );
		return $root;
	}

	private static function private_root(): string {
		if ( defined( 'JF_PRIVATE_MEDIA_DIR' ) && is_string( JF_PRIVATE_MEDIA_DIR ) && '' !== JF_PRIVATE_MEDIA_DIR ) {
			return rtrim( JF_PRIVATE_MEDIA_DIR, '/\\' );
		}

		return rtrim( dirname( ABSPATH ), '/\\' ) . DIRECTORY_SEPARATOR . 'johnny5k-private-media';
	}

	private static function write_guard_files( string $root ): void {
		$index_file = $root . DIRECTORY_SEPARATOR . 'index.php';
		if ( ! file_exists( $index_file ) ) {
			@file_put_contents( $index_file, "<?php\nhttp_response_code(404);\n" );
		}

		$htaccess_file = $root . DIRECTORY_SEPARATOR . '.htaccess';
		if ( ! file_exists( $htaccess_file ) ) {
			@file_put_contents( $htaccess_file, "Deny from all\n" );
		}
	}

	private static function unique_destination( string $directory, string $filename ): string {
		$filename = self::safe_filename( $filename, time() );
		$destination = $directory . DIRECTORY_SEPARATOR . $filename;
		if ( ! file_exists( $destination ) ) {
			return $destination;
		}

		$extension = pathinfo( $filename, PATHINFO_EXTENSION );
		$stem = pathinfo( $filename, PATHINFO_FILENAME );
		$suffix = 1;

		do {
			$candidate = $stem . '-' . $suffix;
			if ( '' !== $extension ) {
				$candidate .= '.' . $extension;
			}
			$destination = $directory . DIRECTORY_SEPARATOR . $candidate;
			$suffix++;
		} while ( file_exists( $destination ) );

		return $destination;
	}

	private static function safe_filename( string $filename, int $fallback_id, ?string $forced_extension = null ): string {
		$filename = sanitize_file_name( $filename );
		$extension = $forced_extension ?: pathinfo( $filename, PATHINFO_EXTENSION );
		$stem = pathinfo( $filename, PATHINFO_FILENAME );

		if ( '' === $stem ) {
			$stem = 'private-media-' . $fallback_id;
		}

		if ( '' !== $extension ) {
			return $stem . '.' . ltrim( strtolower( $extension ), '.' );
		}

		return $stem;
	}

	private static function move_file( string $source, string $destination ): bool {
		if ( @rename( $source, $destination ) ) {
			return true;
		}

		if ( @copy( $source, $destination ) ) {
			@unlink( $source );
			return true;
		}

		return false;
	}

	private static function is_private_path( string $path ): bool {
		return str_starts_with( $path, self::private_root() . DIRECTORY_SEPARATOR ) || self::private_root() === $path;
	}

	private static function extension_matches_mime( string $extension, string $mime ): bool {
		$extension = strtolower( ltrim( $extension, '.' ) );
		$map = [
			'jpg'  => 'image/jpeg',
			'jpeg' => 'image/jpeg',
			'png'  => 'image/png',
			'webp' => 'image/webp',
		];

		return isset( $map[ $extension ] ) && $map[ $extension ] === $mime;
	}

	private static function extension_for_mime( string $mime ): string {
		return match ( $mime ) {
			'image/jpeg' => 'jpg',
			'image/png'  => 'png',
			'image/webp' => 'webp',
			default      => 'bin',
		};
	}

	private static function allowed_mimes(): array {
		return [ 'image/jpeg', 'image/png', 'image/webp' ];
	}
}
