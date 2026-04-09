<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class GeminiImageService {
	private const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
	private const DEFAULT_MODEL = 'gemini-3-pro-image-preview';

	public static function generate_image( int $user_id, string $prompt, array $reference_images = [], array $options = [] ) {
		$api_key = (string) get_option( 'jf_gemini_api_key', '' );
		if ( '' === $api_key ) {
			return new \WP_Error( 'no_gemini_api_key', 'Gemini API key not configured.' );
		}

		$parts = [ [ 'text' => $prompt ] ];
		foreach ( $reference_images as $image ) {
			$inline_data = self::data_url_to_inline_data( (string) $image );
			if ( ! $inline_data ) {
				continue;
			}
			$parts[] = [ 'inlineData' => $inline_data ];
		}

		$payload = [
			'contents' => [
				[
					'role'  => 'user',
					'parts' => $parts,
				],
			],
			'generationConfig' => [
				'responseModalities' => [ 'IMAGE', 'TEXT' ],
				'candidateCount'     => 1,
				'imageConfig'        => [
					'aspectRatio' => (string) ( $options['aspect_ratio'] ?? '1:1' ),
					'imageSize'   => (string) ( $options['image_size'] ?? '2K' ),
				],
			],
		];

		$response = wp_remote_post(
			self::ENDPOINT_BASE . self::DEFAULT_MODEL . ':generateContent?key=' . rawurlencode( $api_key ),
			[
				'headers' => [ 'Content-Type' => 'application/json' ],
				'body'    => wp_json_encode( $payload ),
				'timeout' => 120,
			]
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'gemini_http_error', $response->get_error_message() );
		}

		$http = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( 200 !== $http ) {
			$message = (string) ( $body['error']['message'] ?? 'Unknown Gemini error.' );
			return new \WP_Error( 'gemini_api_error', $message );
		}

		$candidates = is_array( $body['candidates'] ?? null ) ? $body['candidates'] : [];
		foreach ( $candidates as $candidate ) {
			$parts = is_array( $candidate['content']['parts'] ?? null ) ? $candidate['content']['parts'] : [];
			foreach ( $parts as $part ) {
				if ( ! empty( $part['thought'] ) ) {
					continue;
				}

				$inline_data = $part['inlineData'] ?? null;
				if ( ! is_array( $inline_data ) || empty( $inline_data['data'] ) ) {
					continue;
				}

				$mime_type = sanitize_text_field( (string) ( $inline_data['mimeType'] ?? 'image/png' ) );
				$data = base64_decode( (string) $inline_data['data'], true );
				if ( false === $data || '' === $data ) {
					continue;
				}

				return [
					'mime_type' => $mime_type,
					'data'      => $data,
					'usage'     => $body['usageMetadata'] ?? [],
				];
			}
		}

		return new \WP_Error( 'gemini_no_image', 'Gemini did not return an image for this request.' );
	}

	private static function data_url_to_inline_data( string $data_url ): ?array {
		if ( ! preg_match( '/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/', $data_url, $matches ) ) {
			return null;
		}

		return [
			'mimeType' => $matches[1],
			'data'     => $matches[2],
		];
	}
}