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

	public function test_openai_likeness_generation_uses_the_private_headshot_without_unsupported_parameters(): void {
		$this->setOption( 'jf_openai_api_key', 'test-openai-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [ 'data' => [[ 'b64_json' => self::PNG_1X1_BASE64 ]] ] ),
		] );

		$result = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'generate_with_openai',
			[ 'Create a realistic gym portrait of the referenced person.', '3:4', 'data:image/png;base64,' . self::PNG_1X1_BASE64 ]
		);

		$this->assertIsArray( $result );
		$request = $GLOBALS['johnny5k_test_http_log']['post'][0] ?? [];
		$this->assertSame( 'https://api.openai.com/v1/images/edits', $request['url'] ?? '' );
		$this->assertStringContainsString( 'multipart/form-data; boundary=', $request['args']['headers']['Content-Type'] ?? '' );
		$this->assertStringContainsString( 'name="image"; filename="user-headshot.png"', $request['args']['body'] ?? '' );
		$this->assertStringNotContainsString( 'name="input_fidelity"', $request['args']['body'] ?? '' );
		$this->assertStringContainsString( 'name="model"', $request['args']['body'] ?? '' );
		$this->assertStringContainsString( 'gpt-image-2', $request['args']['body'] ?? '' );
	}

	public function test_likeness_generation_requires_an_uploaded_headshot(): void {
		$result = JohnnyGeneratedImageService::generate( 42, [
			'prompt' => 'Create a realistic image of me lifting in a gym.',
			'title' => 'Gym portrait',
			'alt_text' => 'The user lifting in a gym.',
			'category' => 'motivation',
			'use_user_likeness' => true,
		] );

		$this->assertStringContainsString( 'Upload a headshot', $result['error'] ?? '' );
		$this->assertSame( [], $GLOBALS['johnny5k_test_http_log']['post'] ?? [] );
	}

	public function test_johnny_likeness_generation_uses_a_named_character_reference(): void {
		$this->setOption( 'jf_openai_api_key', 'test-openai-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [ 'data' => [[ 'b64_json' => self::PNG_1X1_BASE64 ]] ] ),
		] );

		$result = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'generate_with_openai',
			[ 'Create a celebratory image of Johnny.', '1:1', 'data:image/png;base64,' . self::PNG_1X1_BASE64, 'johnny-reference' ]
		);

		$this->assertIsArray( $result );
		$request = $GLOBALS['johnny5k_test_http_log']['post'][0] ?? [];
		$this->assertSame( 'https://api.openai.com/v1/images/edits', $request['url'] ?? '' );
		$this->assertStringContainsString( 'name="image"; filename="johnny-reference.png"', $request['args']['body'] ?? '' );
	}

	public function test_johnny_likeness_generation_requires_the_official_reference(): void {
		$result = JohnnyGeneratedImageService::generate( 42, [
			'prompt' => 'Create a fun image of Johnny celebrating my workout.',
			'title' => 'Johnny celebrates',
			'alt_text' => 'Johnny celebrating a completed workout.',
			'category' => 'johnny_moment',
			'use_johnny_likeness' => true,
		] );

		$this->assertStringContainsString( 'reference image configured', $result['error'] ?? '' );
		$this->assertSame( [], $GLOBALS['johnny5k_test_http_log']['post'] ?? [] );
	}

	public function test_johnny_prompt_preserves_his_official_identity(): void {
		$prompt = $this->invokePrivateStatic(
			JohnnyGeneratedImageService::class,
			'build_prompt',
			[ 'Johnny cheering at the finish line.', 'johnny_moment', false, true ]
		);

		$this->assertStringContainsString( 'official character reference', $prompt );
		$this->assertStringContainsString( 'immediately recognizable', $prompt );
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

}
