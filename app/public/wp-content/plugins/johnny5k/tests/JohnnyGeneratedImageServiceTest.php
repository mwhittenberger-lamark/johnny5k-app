<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\JohnnyGeneratedImageService;
use Johnny5k\Tests\Support\ServiceTestCase;

class JohnnyGeneratedImageServiceTest extends ServiceTestCase {
	private const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

	public function test_openai_image_generation_uses_gpt_image_2_and_preserves_aspect_ratio(): void {
		$this->setOption( 'jf_openai_api_key', 'test-openai-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'data' => [[ 'b64_json' => self::PNG_1X1_BASE64 ]],
			] ),
		] );

		$result = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'generate_with_openai',
			[ 'A premium athletic workout poster.', '16:9' ]
		);

		$this->assertIsArray( $result );
		$this->assertSame( 'image/png', $result['mime_type'] ?? '' );
		$this->assertSame( base64_decode( self::PNG_1X1_BASE64 ), $result['data'] ?? '' );

		$request = $GLOBALS['johnny5k_test_http_log']['post'][0] ?? [];
		$this->assertSame( 'https://api.openai.com/v1/images/generations', $request['url'] ?? '' );
		$this->assertSame( 'Bearer test-openai-key', $request['args']['headers']['Authorization'] ?? '' );
		$payload = json_decode( (string) ( $request['args']['body'] ?? '' ), true );
		$this->assertSame( 'gpt-image-2', $payload['model'] ?? '' );
		$this->assertSame( '1536x864', $payload['size'] ?? '' );
		$this->assertSame( 'medium', $payload['quality'] ?? '' );
	}

	public function test_openai_image_generation_surfaces_moderation_blocks_cleanly(): void {
		$this->setOption( 'jf_openai_api_key', 'test-openai-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 400 ],
			'body' => wp_json_encode( [
				'error' => [
					'type' => 'image_generation_user_error',
					'code' => 'moderation_blocked',
					'message' => 'Blocked.',
				],
			] ),
		] );

		$result = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'generate_with_openai',
			[ 'Blocked request.', '1:1' ]
		);

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'moderation_blocked', $result->get_error_code() );
		$this->assertStringContainsString( 'safety check', $result->get_error_message() );
	}

	public function test_openai_image_generation_requires_the_existing_openai_key(): void {
		$result = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'generate_with_openai',
			[ 'A workout image.', '1:1' ]
		);

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_openai_api_key', $result->get_error_code() );
	}

	public function test_openai_daily_limit_does_not_inherit_legacy_gemini_usage(): void {
		update_user_meta( 42, 'jf_user_gemini_generated_images_daily_usage', [ current_time( 'Y-m-d' ) => 2 ] );

		$remaining = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'remaining_today',
			[ 42 ]
		);

		$this->assertSame( 2, $remaining );
	}

	public function test_openai_daily_limit_tracks_only_successful_openai_usage(): void {
		update_user_meta( 42, 'jf_user_openai_generated_images_daily_usage', [ current_time( 'Y-m-d' ) => 1 ] );

		$remaining = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'remaining_today',
			[ 42 ]
		);

		$this->assertSame( 1, $remaining );
	}

	public function test_openai_daily_limit_can_be_lifted_for_one_user(): void {
		update_user_meta( 42, 'jf_user_openai_generated_images_daily_usage', [ current_time( 'Y-m-d' ) => 2 ] );
		update_user_meta( 42, 'jf_openai_image_daily_limit_exempt', true );

		$remaining = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'remaining_today',
			[ 42 ]
		);

		$this->assertSame( PHP_INT_MAX, $remaining );
	}
}
