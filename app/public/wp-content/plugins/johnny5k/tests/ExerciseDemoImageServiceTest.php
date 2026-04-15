<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\ExerciseDemoImageService;
use Johnny5k\Tests\Support\ServiceTestCase;

class ExerciseDemoImageServiceTest extends ServiceTestCase {
	private const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0KX8AAAAASUVORK5CYII=';

	private string $upload_dir;

	protected function setUp(): void {
		parent::setUp();

		$this->upload_dir = sys_get_temp_dir() . '/johnny5k-test-uploads';
		$this->deleteDirectory( $this->upload_dir );
	}

	protected function tearDown(): void {
		$this->deleteDirectory( $this->upload_dir );
		parent::tearDown();
	}

	public function test_generate_demo_image_saves_public_image_and_metadata(): void {
		$this->setOption( 'jf_gemini_api_key', 'test-key' );

		$reference_path = tempnam( sys_get_temp_dir(), 'jf-johnny-ref-' );
		file_put_contents( $reference_path, base64_decode( self::PNG_1X1_BASE64 ) );
		$reference_attachment_id = \wp_insert_attachment( [
			'post_mime_type' => 'image/png',
			'post_title'     => 'Johnny Reference',
			'post_status'    => 'inherit',
		], $reference_path );
		$this->setOption( 'jf_johnny_reference_attachment_id', $reference_attachment_id );

		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body'     => json_encode( [
				'candidates' => [
					[
						'content' => [
							'parts' => [
								[
									'inlineData' => [
										'mimeType' => 'image/png',
										'data'     => self::PNG_1X1_BASE64,
									],
								],
							],
						],
					],
				],
				'usageMetadata' => [
					'promptTokenCount'     => 120,
					'candidatesTokenCount' => 34,
				],
			] ),
		] );

		$meta = ExerciseDemoImageService::generate_demo_image( 7, [
			'id'                => 44,
			'name'              => 'Incline Dumbbell Press',
			'description'       => 'Upper chest focused press on an incline bench.',
			'movement_pattern'  => 'incline_press',
			'primary_muscle'    => 'chest',
			'secondary_muscles' => [ 'shoulders', 'triceps' ],
			'equipment'         => 'dumbbells and incline bench',
			'coaching_cues'     => [ 'elbows slightly tucked', 'control the lowering phase' ],
			'difficulty'        => 'intermediate',
		] );

		$this->assertIsArray( $meta );
		$this->assertSame( 44, $meta['exercise_id'] );
		$this->assertSame( 'Incline Dumbbell Press', $meta['exercise_name'] );
		$this->assertStringContainsString( 'Incline Dumbbell Press', $meta['prompt'] );
		$this->assertStringContainsString( 'dumbbells and incline bench', $meta['prompt'] );
		$this->assertStringContainsString( 'same coach and person', $meta['prompt'] );
		$this->assertStringStartsWith( 'https://example.test/wp-content/uploads/johnny5k-exercise-demo-images/', $meta['image_url'] );
		$this->assertFileExists( $this->upload_dir . '/johnny5k-exercise-demo-images/' . basename( $meta['image_url'] ) );

		$stored = ExerciseDemoImageService::get_demo_image( 44 );
		$this->assertSame( $meta['image_url'], $stored['image_url'] );
		$this->assertSame( $reference_attachment_id, $stored['reference_attachment_id'] );
		$this->assertFileExists( (string) $stored['image_path'] );

		$http_log = $GLOBALS['johnny5k_test_http_log']['post'][0] ?? null;
		$this->assertIsArray( $http_log );
		$this->assertStringContainsString( 'gemini-3-pro-image-preview:generateContent', (string) $http_log['url'] );
		$this->assertStringContainsString( 'inlineData', (string) ( $http_log['args']['body'] ?? '' ) );

		@unlink( $reference_path );
	}

	public function test_generate_demo_image_requires_reference_image(): void {
		$this->setOption( 'jf_gemini_api_key', 'test-key' );

		$result = ExerciseDemoImageService::generate_demo_image( 7, [
			'id'   => 44,
			'name' => 'Goblet Squat',
		] );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'exercise_demo_image_missing_reference', $result->get_error_code() );
	}

	public function test_delete_demo_image_removes_file_and_metadata(): void {
		$this->setOption( 'jf_exercise_demo_images', [
			44 => [
				'exercise_id'   => 44,
				'exercise_name' => 'Goblet Squat',
				'image_url'     => 'https://example.test/wp-content/uploads/johnny5k-exercise-demo-images/goblet-squat.png',
				'image_path'    => $this->createDemoImageFile( 'goblet-squat.png' ),
			],
		] );

		$deleted = ExerciseDemoImageService::delete_demo_image( 44 );

		$this->assertTrue( $deleted );
		$this->assertSame( '', ExerciseDemoImageService::get_demo_image( 44 )['image_url'] );
		$this->assertSame( [], ExerciseDemoImageService::get_demo_images() );
	}

	private function createDemoImageFile( string $filename ): string {
		$dir = $this->upload_dir . '/johnny5k-exercise-demo-images';
		if ( ! is_dir( $dir ) ) {
			mkdir( $dir, 0777, true );
		}

		$path = $dir . '/' . $filename;
		file_put_contents( $path, base64_decode( self::PNG_1X1_BASE64 ) );
		return $path;
	}

	private function deleteDirectory( string $path ): void {
		if ( ! is_dir( $path ) ) {
			return;
		}

		$items = scandir( $path );
		if ( false === $items ) {
			return;
		}

		foreach ( $items as $item ) {
			if ( '.' === $item || '..' === $item ) {
				continue;
			}

			$item_path = $path . '/' . $item;
			if ( is_dir( $item_path ) ) {
				$this->deleteDirectory( $item_path );
				continue;
			}

			@unlink( $item_path );
		}

		@rmdir( $path );
	}
}