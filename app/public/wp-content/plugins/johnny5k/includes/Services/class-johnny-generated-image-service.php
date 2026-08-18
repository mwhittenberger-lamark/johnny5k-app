<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\PrivateMediaService;

class JohnnyGeneratedImageService {
	private const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
	private const OPENAI_IMAGE_EDIT_ENDPOINT = 'https://api.openai.com/v1/images/edits';
	private const OPENAI_IMAGE_MODEL = 'gpt-image-2';
	private const HEADSHOT_META_KEY = 'jf_user_headshot_attachment_id';
	private const JOHNNY_REFERENCE_OPTION = 'jf_johnny_reference_attachment_id';
	private const IMAGE_META_KEY = 'jf_user_gemini_generated_images';

	public static function generate( int $user_id, array $arguments ): array {
		$prompt = sanitize_textarea_field( (string) ( $arguments['prompt'] ?? '' ) );
		if ( '' === $prompt ) {
			return [ 'error' => 'Describe the image you want Johnny to create.' ];
		}

		$category = sanitize_key( (string) ( $arguments['category'] ?? 'other' ) );
		$allowed_categories = [ 'exercise_illustration', 'workout_poster', 'meal_concept', 'motivation', 'share_card', 'johnny_moment', 'other' ];
		if ( ! in_array( $category, $allowed_categories, true ) ) {
			$category = 'other';
		}

		$aspect_ratio = (string) ( $arguments['aspect_ratio'] ?? '1:1' );
		if ( ! in_array( $aspect_ratio, [ '1:1', '4:3', '3:4', '16:9', '9:16' ], true ) ) {
			$aspect_ratio = '1:1';
		}

		$title = sanitize_text_field( (string) ( $arguments['title'] ?? 'Johnny image' ) );
		$alt_text = sanitize_text_field( (string) ( $arguments['alt_text'] ?? $title ) );
		$use_user_likeness = rest_sanitize_boolean( $arguments['use_user_likeness'] ?? false );
		$use_johnny_likeness = rest_sanitize_boolean( $arguments['use_johnny_likeness'] ?? false );
		if ( $use_user_likeness && $use_johnny_likeness ) {
			return [ 'error' => 'Choose either the user likeness or Johnny likeness for this image, not both.' ];
		}
		$reference_image = '';
		$reference_filename = 'reference-image';
		if ( $use_user_likeness ) {
			$headshot_attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
			if ( $headshot_attachment_id <= 0 ) return [ 'error' => 'Upload a headshot in Profile & Settings before asking Johnny to create an image of you.' ];
			$reference_image = PrivateMediaService::attachment_to_data_url( $headshot_attachment_id, 'johnny_image_headshot_missing', 'The saved headshot could not be loaded.' );
			if ( is_wp_error( $reference_image ) ) return [ 'error' => $reference_image->get_error_message() ];
			$reference_filename = 'user-headshot';
		}
		if ( $use_johnny_likeness ) {
			$johnny_attachment_id = (int) get_option( self::JOHNNY_REFERENCE_OPTION, 0 );
			if ( $johnny_attachment_id <= 0 ) return [ 'error' => 'Johnny needs a reference image configured before creating an image of himself.' ];
			$reference_image = PrivateMediaService::attachment_to_data_url( $johnny_attachment_id, 'johnny_image_reference_missing', 'Johnny’s saved reference image could not be loaded.' );
			if ( is_wp_error( $reference_image ) ) return [ 'error' => $reference_image->get_error_message() ];
			$reference_filename = 'johnny-reference';
		}
		$generation_prompt = self::build_prompt( $prompt, $category, $use_user_likeness, $use_johnny_likeness );
		$result = self::generate_with_openai( $generation_prompt, $aspect_ratio, $reference_image, $reference_filename );

		if ( is_wp_error( $result ) ) {
			return [ 'error' => $result->get_error_message() ];
		}

		$image_id = wp_generate_uuid4();
		$attachment_id = PrivateMediaService::create_private_attachment_from_binary(
			$user_id,
			(string) ( $result['mime_type'] ?? 'image/png' ),
			(string) ( $result['data'] ?? '' ),
			'johnny-' . $category . '-' . $image_id . '.png',
			$title
		);

		if ( is_wp_error( $attachment_id ) ) {
			return [ 'error' => $attachment_id->get_error_message() ];
		}

		$entry = [
			'id'            => $image_id,
			'attachment_id' => (int) $attachment_id,
			'scenario'      => $title,
			'prompt'        => $generation_prompt,
			'created_at'    => current_time( 'mysql' ),
			'favorited'     => false,
			'type'          => 'johnny_' . $category,
			'alt_text'      => $alt_text,
			'provider'      => 'openai',
			'model'         => self::OPENAI_IMAGE_MODEL,
			'uses_user_likeness' => $use_user_likeness,
			'uses_johnny_likeness' => $use_johnny_likeness,
		];

		$existing = get_user_meta( $user_id, self::IMAGE_META_KEY, true );
		$existing = is_array( $existing ) ? $existing : [];
		update_user_meta( $user_id, self::IMAGE_META_KEY, array_merge( [ $entry ], array_slice( $existing, 0, 24 ) ) );

		return [
			'action'       => 'generate_image',
			'image_id'     => $image_id,
			'category'     => $category,
			'title'        => $title,
			'alt_text'     => $alt_text,
			'aspect_ratio' => $aspect_ratio,
			'model'        => self::OPENAI_IMAGE_MODEL,
			'uses_user_likeness' => $use_user_likeness,
			'uses_johnny_likeness' => $use_johnny_likeness,
			'summary'      => sprintf( 'Created %s.', $title ),
		];
	}

	private static function generate_with_openai( string $prompt, string $aspect_ratio, string $reference_image = '', string $reference_filename = 'user-headshot' ): array|\WP_Error {
		$api_key = trim( (string) get_option( 'jf_openai_api_key', '' ) );
		if ( '' === $api_key ) {
			return new \WP_Error( 'no_openai_api_key', 'OpenAI API key not configured.' );
		}

		$payload = [
			'model'      => self::OPENAI_IMAGE_MODEL,
			'prompt'     => $prompt,
			'n'          => 1,
			'size'       => self::size_for_aspect_ratio( $aspect_ratio ),
			'quality'    => 'medium',
			'background' => 'opaque',
			'moderation' => 'auto',
		];

		$endpoint = self::OPENAI_IMAGE_ENDPOINT;
		$request_args = [
			'headers' => [
				'Authorization' => 'Bearer ' . $api_key,
				'Content-Type'  => 'application/json',
			],
			'body'    => wp_json_encode( $payload ),
			'timeout' => 150,
		];
		if ( '' !== $reference_image ) {
			$multipart = self::build_image_edit_multipart( $payload, $reference_image, $reference_filename );
			if ( is_wp_error( $multipart ) ) return $multipart;
			$endpoint = self::OPENAI_IMAGE_EDIT_ENDPOINT;
			$request_args['headers']['Content-Type'] = 'multipart/form-data; boundary=' . $multipart['boundary'];
			$request_args['body'] = $multipart['body'];
		}
		$response = wp_remote_post( $endpoint, $request_args );

		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'openai_image_http_error', $response->get_error_message() );
		}

		$status = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( 200 !== $status ) {
			$error = is_array( $body['error'] ?? null ) ? $body['error'] : [];
			$code = sanitize_key( (string) ( $error['code'] ?? 'openai_image_api_error' ) );
			$message = 'OpenAI could not generate that image.';
			if ( 'moderation_blocked' === $code ) {
				$message = 'That image request was blocked by a safety check. Try revising the visual description.';
			} elseif ( ! empty( $error['message'] ) ) {
				$message = sanitize_text_field( (string) $error['message'] );
			}
			return new \WP_Error( $code ?: 'openai_image_api_error', $message );
		}

		$encoded = (string) ( $body['data'][0]['b64_json'] ?? '' );
		$binary = '' !== $encoded ? base64_decode( $encoded, true ) : false;
		if ( false === $binary || '' === $binary ) {
			return new \WP_Error( 'openai_image_missing_data', 'OpenAI did not return image data for this request.' );
		}

		return [
			'mime_type' => 'image/png',
			'data'      => $binary,
		];
	}

	private static function build_image_edit_multipart( array $payload, string $reference_image, string $reference_filename = 'user-headshot' ): array|\WP_Error {
		if ( ! preg_match( '#^data:(image/(?:png|jpeg|webp));base64,(.+)$#s', $reference_image, $matches ) ) return new \WP_Error( 'invalid_headshot_data', 'The saved headshot is not a supported image.' );
		$binary = base64_decode( preg_replace( '/\s+/', '', $matches[2] ), true );
		if ( false === $binary || '' === $binary ) return new \WP_Error( 'invalid_headshot_data', 'The saved headshot could not be read.' );
		$mime_type = $matches[1];
		$extension = 'image/jpeg' === $mime_type ? 'jpg' : substr( $mime_type, 6 );
		$boundary = '----Johnny5kImage' . wp_generate_password( 24, false, false );
		$eol = "\r\n";
		$body = '';
		foreach ( $payload as $name => $value ) $body .= '--' . $boundary . $eol . 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol . $value . $eol;
		$filename = sanitize_file_name( $reference_filename ) ?: 'reference-image';
		$body .= '--' . $boundary . $eol . 'Content-Disposition: form-data; name="image"; filename="' . $filename . '.' . $extension . '"' . $eol . 'Content-Type: ' . $mime_type . $eol . $eol . $binary . $eol . '--' . $boundary . '--' . $eol;
		return [ 'boundary' => $boundary, 'body' => $body ];
	}

	private static function size_for_aspect_ratio( string $aspect_ratio ): string {
		return match ( $aspect_ratio ) {
			'4:3'  => '1344x1008',
			'3:4'  => '1008x1344',
			'16:9' => '1536x864',
			'9:16' => '864x1536',
			default => '1024x1024',
		};
	}

	private static function build_prompt( string $prompt, string $category, bool $use_user_likeness = false, bool $use_johnny_likeness = false ): string {
		$parts = [
			'Create a polished ' . str_replace( '_', ' ', $category ) . ' for the Johnny5k fitness coaching app.',
			$prompt,
			'Visual direction: premium athletic editorial art, charcoal and deep forest palette, chalk highlights, restrained whistle yellow and rust accents. Strong composition, legible focal subject, no app chrome, no watermark.',
			'Do not invent or render precise health statistics, progress measurements, nutrition totals, medical claims, or chart data. Those are rendered separately by the application.',
		];
		if ( $use_user_likeness ) $parts[] = 'The input image is the user’s private likeness reference. Keep the same recognizable adult person, facial structure, skin tone, hair, and distinguishing features. Render realistic anatomy, natural skin texture, believable lighting, and photographic detail. Change only the scene, wardrobe, pose, and environment requested by the user.';
		if ( $use_johnny_likeness ) $parts[] = 'The input image is Johnny’s official character reference. Keep Johnny immediately recognizable: preserve his face, build, hair, age, signature styling, and established visual identity. Johnny is the sole likeness subject unless the prompt explicitly includes a separate non-identifiable background crowd. Change only the scene, wardrobe details, pose, expression, and environment requested. Keep the result warm, fun, confident, and coach-like rather than corporate or cartoonish.';
		return implode( "\n\n", $parts );
	}

}
