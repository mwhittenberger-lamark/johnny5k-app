<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\PrivateMediaService;

class ExerciseDemoImageService {
	private const OPTION_KEY = 'jf_exercise_demo_images';

	public static function get_demo_images(): array {
		$stored = get_option( self::OPTION_KEY, [] );
		if ( ! is_array( $stored ) ) {
			return [];
		}

		$images = [];
		foreach ( $stored as $exercise_id => $meta ) {
			$id = (int) $exercise_id;
			if ( $id <= 0 || ! is_array( $meta ) ) {
				continue;
			}

			$normalised = self::normalise_demo_image( $meta + [ 'exercise_id' => $id ] );
			if ( '' === $normalised['image_url'] ) {
				continue;
			}

			$images[ $id ] = $normalised;
		}

		return $images;
	}

	public static function get_demo_image( int $exercise_id ): array {
		$images = self::get_demo_images();
		return $images[ $exercise_id ] ?? self::normalise_demo_image( [ 'exercise_id' => $exercise_id ] );
	}

	public static function generate_demo_image( int $user_id, array $exercise ): array|\WP_Error {
		$exercise = self::normalise_exercise( $exercise );
		if ( $exercise['id'] <= 0 ) {
			return new \WP_Error( 'exercise_demo_image_invalid_exercise', 'Save the exercise before generating a demo image.' );
		}

		$reference_attachment_id = (int) get_option( 'jf_johnny_reference_attachment_id', 0 );
		if ( $reference_attachment_id <= 0 ) {
			return new \WP_Error( 'exercise_demo_image_missing_reference', 'Set a Johnny reference image in Settings before generating an exercise demo.' );
		}

		$reference_image = PrivateMediaService::attachment_to_data_url(
			$reference_attachment_id,
			'exercise_demo_image_reference_missing',
			'The Johnny reference image could not be found.',
			[ 'image/jpeg', 'image/png', 'image/webp' ]
		);
		if ( is_wp_error( $reference_image ) ) {
			return $reference_image;
		}

		$prompt = self::build_prompt( $exercise );
		$result = GeminiImageService::generate_image( $user_id, $prompt, [ $reference_image ], [
			'aspect_ratio' => '1:1',
			'image_size'   => '2K',
		] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$image = self::save_generated_image( $exercise, $result );
		if ( is_wp_error( $image ) ) {
			return $image;
		}

		self::delete_demo_image( $exercise['id'], false );

		$meta = self::normalise_demo_image( [
			'exercise_id'              => $exercise['id'],
			'exercise_name'            => $exercise['name'],
			'image_url'                => $image['image_url'],
			'image_path'               => $image['image_path'],
			'prompt'                   => $prompt,
			'mime_type'                => (string) ( $result['mime_type'] ?? 'image/png' ),
			'generated_at'             => gmdate( 'c' ),
			'reference_attachment_id'  => $reference_attachment_id,
		] );

		$images = self::get_demo_images();
		$images[ $exercise['id'] ] = $meta;
		update_option( self::OPTION_KEY, $images, false );

		return $meta;
	}

	public static function delete_demo_image( int $exercise_id, bool $persist = true ): bool {
		if ( $exercise_id <= 0 ) {
			return false;
		}

		$images = self::get_demo_images();
		if ( empty( $images[ $exercise_id ] ) ) {
			return false;
		}

		$image = self::normalise_demo_image( $images[ $exercise_id ] );
		$path  = (string) ( $image['image_path'] ?? '' );
		if ( '' !== $path && file_exists( $path ) ) {
			@unlink( $path );
		}

		unset( $images[ $exercise_id ] );
		if ( $persist ) {
			update_option( self::OPTION_KEY, $images, false );
		}

		return true;
	}

	private static function normalise_exercise( array $exercise ): array {
		return [
			'id'                => (int) ( $exercise['id'] ?? 0 ),
			'name'              => sanitize_text_field( (string) ( $exercise['name'] ?? '' ) ),
			'description'       => sanitize_textarea_field( (string) ( $exercise['description'] ?? '' ) ),
			'movement_pattern'  => sanitize_text_field( (string) ( $exercise['movement_pattern'] ?? '' ) ),
			'primary_muscle'    => sanitize_text_field( (string) ( $exercise['primary_muscle'] ?? '' ) ),
			'secondary_muscles' => self::normalise_list( $exercise['secondary_muscles'] ?? [] ),
			'equipment'         => sanitize_text_field( (string) ( $exercise['equipment'] ?? '' ) ),
			'coaching_cues'     => self::normalise_list( $exercise['coaching_cues'] ?? [] ),
			'difficulty'        => sanitize_key( (string) ( $exercise['difficulty'] ?? '' ) ),
		];
	}

	private static function normalise_demo_image( array $meta ): array {
		return [
			'exercise_id'             => (int) ( $meta['exercise_id'] ?? 0 ),
			'exercise_name'           => sanitize_text_field( (string) ( $meta['exercise_name'] ?? '' ) ),
			'image_url'               => esc_url_raw( (string) ( $meta['image_url'] ?? '' ) ),
			'image_path'              => sanitize_text_field( (string) ( $meta['image_path'] ?? '' ) ),
			'prompt'                  => sanitize_textarea_field( (string) ( $meta['prompt'] ?? '' ) ),
			'mime_type'               => sanitize_text_field( (string) ( $meta['mime_type'] ?? '' ) ),
			'generated_at'            => sanitize_text_field( (string) ( $meta['generated_at'] ?? '' ) ),
			'reference_attachment_id' => (int) ( $meta['reference_attachment_id'] ?? 0 ),
		];
	}

	private static function normalise_list( mixed $items ): array {
		if ( is_string( $items ) ) {
			$decoded = json_decode( $items, true );
			$items = is_array( $decoded ) ? $decoded : preg_split( '/[\r\n,]+/', $items );
		}

		if ( ! is_array( $items ) ) {
			return [];
		}

		return array_values( array_filter( array_map( static fn( $item ): string => sanitize_text_field( (string) $item ), $items ) ) );
	}

	private static function build_prompt( array $exercise ): string {
		$name = $exercise['name'] ?: 'the exercise';
		$primary_muscle = '' !== $exercise['primary_muscle'] ? $exercise['primary_muscle'] : 'full body';
		$secondary = array_slice( $exercise['secondary_muscles'], 0, 3 );
		$cues = array_slice( $exercise['coaching_cues'], 0, 3 );

		$parts = [
			sprintf( 'Create a single square action image of Johnny demonstrating %s in a gym.', $name ),
			'Use the reference image to keep Johnny consistent as the same coach and person.',
			sprintf( 'Capture one clear mid-rep moment with realistic anatomy, believable joint positions, and accurate %s technique.', $name ),
			sprintf( 'Make the movement visibly emphasize %s%s.', $primary_muscle, $secondary ? ' with support from ' . implode( ', ', $secondary ) : '' ),
			'' !== $exercise['equipment'] ? 'Show the correct equipment: ' . $exercise['equipment'] . '.' : 'Show only the equipment required for the exercise.',
			'' !== $exercise['movement_pattern'] ? 'Movement pattern: ' . $exercise['movement_pattern'] . '.' : '',
			'' !== $exercise['description'] ? 'Exercise context: ' . $exercise['description'] . '.' : '',
			$cues ? 'Technique cues to reflect visually: ' . implode( '; ', $cues ) . '.' : '',
			'Use a clean training environment, natural lighting, and a professional coaching look.',
			'Avoid text overlays, labels, watermarks, split screens, multiple poses, motion trails, extra limbs, anatomical errors, or collage layouts.',
		];

		return trim( implode( ' ', array_filter( $parts ) ) );
	}

	private static function save_generated_image( array $exercise, array $result ): array|\WP_Error {
		if ( ! function_exists( 'wp_upload_dir' ) ) {
			return new \WP_Error( 'exercise_demo_image_upload_unavailable', 'The uploads directory is unavailable.' );
		}

		$upload_dir = wp_upload_dir();
		$base_dir   = (string) ( $upload_dir['basedir'] ?? '' );
		$base_url   = (string) ( $upload_dir['baseurl'] ?? '' );
		if ( '' === $base_dir || '' === $base_url ) {
			return new \WP_Error( 'exercise_demo_image_upload_unavailable', 'The uploads directory is unavailable.' );
		}

		$target_dir = trailingslashit( $base_dir ) . 'johnny5k-exercise-demo-images';
		if ( ! file_exists( $target_dir ) && ! wp_mkdir_p( $target_dir ) ) {
			return new \WP_Error( 'exercise_demo_image_upload_failed', 'The exercise demo image directory could not be created.' );
		}

		$mime_type = (string) ( $result['mime_type'] ?? 'image/png' );
		$extension = 'png';
		if ( 'image/jpeg' === $mime_type ) {
			$extension = 'jpg';
		} elseif ( 'image/webp' === $mime_type ) {
			$extension = 'webp';
		}

		$filename = sanitize_file_name(
			sanitize_title( (string) ( $exercise['name'] ?? 'exercise-demo' ) ) . '-johnny-demo-' . time() . '.' . $extension
		);
		$target_path = trailingslashit( $target_dir ) . $filename;
		if ( false === file_put_contents( $target_path, (string) ( $result['data'] ?? '' ) ) ) {
			return new \WP_Error( 'exercise_demo_image_upload_failed', 'The generated exercise demo image could not be saved.' );
		}

		return [
			'image_url'  => trailingslashit( $base_url ) . 'johnny5k-exercise-demo-images/' . $filename,
			'image_path' => $target_path,
		];
	}
}