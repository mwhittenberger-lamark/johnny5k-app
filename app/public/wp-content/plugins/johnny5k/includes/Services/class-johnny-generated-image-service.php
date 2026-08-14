<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\PrivateMediaService;

class JohnnyGeneratedImageService {
	private const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
	private const OPENAI_IMAGE_MODEL = 'gpt-image-2';
	private const IMAGE_META_KEY = 'jf_user_gemini_generated_images';
	private const DAILY_USAGE_META_KEY = 'jf_user_openai_generated_images_daily_usage';
	private const DAILY_LIMIT_EXEMPT_META_KEY = 'jf_openai_image_daily_limit_exempt';
	private const DAILY_LIMIT = 2;

	public static function generate( int $user_id, array $arguments ): array {
		$remaining = self::remaining_today( $user_id );
		if ( $remaining <= 0 ) {
			return [ 'error' => sprintf( 'Johnny has reached the app limit of %d OpenAI-generated images for you today. Try again tomorrow.', self::DAILY_LIMIT ) ];
		}

		$prompt = sanitize_textarea_field( (string) ( $arguments['prompt'] ?? '' ) );
		if ( '' === $prompt ) {
			return [ 'error' => 'Describe the image you want Johnny to create.' ];
		}

		$category = sanitize_key( (string) ( $arguments['category'] ?? 'other' ) );
		$allowed_categories = [ 'exercise_illustration', 'workout_poster', 'meal_concept', 'motivation', 'share_card', 'other' ];
		if ( ! in_array( $category, $allowed_categories, true ) ) {
			$category = 'other';
		}

		$aspect_ratio = (string) ( $arguments['aspect_ratio'] ?? '1:1' );
		if ( ! in_array( $aspect_ratio, [ '1:1', '4:3', '3:4', '16:9', '9:16' ], true ) ) {
			$aspect_ratio = '1:1';
		}

		$title = sanitize_text_field( (string) ( $arguments['title'] ?? 'Johnny image' ) );
		$alt_text = sanitize_text_field( (string) ( $arguments['alt_text'] ?? $title ) );
		$generation_prompt = self::build_prompt( $prompt, $category );
		$result = self::generate_with_openai( $generation_prompt, $aspect_ratio );

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
		];

		$existing = get_user_meta( $user_id, self::IMAGE_META_KEY, true );
		$existing = is_array( $existing ) ? $existing : [];
		update_user_meta( $user_id, self::IMAGE_META_KEY, array_merge( [ $entry ], array_slice( $existing, 0, 24 ) ) );
		self::increment_usage( $user_id );

		return [
			'action'       => 'generate_image',
			'image_id'     => $image_id,
			'category'     => $category,
			'title'        => $title,
			'alt_text'     => $alt_text,
			'aspect_ratio' => $aspect_ratio,
			'model'        => self::OPENAI_IMAGE_MODEL,
			'summary'      => sprintf( 'Created %s.', $title ),
		];
	}

	private static function generate_with_openai( string $prompt, string $aspect_ratio ): array|\WP_Error {
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

		$response = wp_remote_post( self::OPENAI_IMAGE_ENDPOINT, [
			'headers' => [
				'Authorization' => 'Bearer ' . $api_key,
				'Content-Type'  => 'application/json',
			],
			'body'    => wp_json_encode( $payload ),
			'timeout' => 150,
		] );

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

	private static function size_for_aspect_ratio( string $aspect_ratio ): string {
		return match ( $aspect_ratio ) {
			'4:3'  => '1344x1008',
			'3:4'  => '1008x1344',
			'16:9' => '1536x864',
			'9:16' => '864x1536',
			default => '1024x1024',
		};
	}

	private static function build_prompt( string $prompt, string $category ): string {
		return implode( "\n\n", [
			'Create a polished ' . str_replace( '_', ' ', $category ) . ' for the Johnny5k fitness coaching app.',
			$prompt,
			'Visual direction: premium athletic editorial art, charcoal and deep forest palette, chalk highlights, restrained whistle yellow and rust accents. Strong composition, legible focal subject, no app chrome, no watermark.',
			'Do not invent or render precise health statistics, progress measurements, nutrition totals, medical claims, or chart data. Those are rendered separately by the application.',
		] );
	}

	private static function remaining_today( int $user_id ): int {
		if ( rest_sanitize_boolean( get_user_meta( $user_id, self::DAILY_LIMIT_EXEMPT_META_KEY, true ) ) ) {
			return PHP_INT_MAX;
		}

		$usage = get_user_meta( $user_id, self::DAILY_USAGE_META_KEY, true );
		$usage = is_array( $usage ) ? $usage : [];
		$used = max( 0, (int) ( $usage[ current_time( 'Y-m-d' ) ] ?? 0 ) );
		return max( 0, self::DAILY_LIMIT - $used );
	}

	private static function increment_usage( int $user_id ): void {
		$usage = get_user_meta( $user_id, self::DAILY_USAGE_META_KEY, true );
		$usage = is_array( $usage ) ? $usage : [];
		$today = current_time( 'Y-m-d' );
		$usage[ $today ] = max( 0, (int) ( $usage[ $today ] ?? 0 ) ) + 1;
		update_user_meta( $user_id, self::DAILY_USAGE_META_KEY, $usage );
	}
}
