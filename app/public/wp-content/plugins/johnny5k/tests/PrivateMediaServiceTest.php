<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Support\PrivateMediaService;
use Johnny5k\Tests\Support\ServiceTestCase;

class PrivateMediaServiceTest extends ServiceTestCase {
	private const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0KX8AAAAASUVORK5CYII=';

	protected function setUp(): void {
		parent::setUp();

		if ( ! defined( 'JF_PRIVATE_MEDIA_DIR' ) ) {
			define( 'JF_PRIVATE_MEDIA_DIR', sys_get_temp_dir() . '/johnny5k-private-media-tests' );
		}

		$this->deleteDirectory( JF_PRIVATE_MEDIA_DIR );
	}

	protected function tearDown(): void {
		$this->deleteDirectory( JF_PRIVATE_MEDIA_DIR );
		parent::tearDown();
	}

	public function test_validate_uploaded_image_rejects_non_image_payloads(): void {
		$tmp_file = tempnam( sys_get_temp_dir(), 'jf-invalid-image-' );
		file_put_contents( $tmp_file, 'not an image' );

		$result = PrivateMediaService::validate_uploaded_image( [
			'name' => 'fake.jpg',
			'tmp_name' => $tmp_file,
			'size' => filesize( $tmp_file ),
			'error' => UPLOAD_ERR_OK,
		], 'headshot' );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'invalid_image', $result->get_error_code() );

		@unlink( $tmp_file );
	}

	public function test_private_attachment_is_moved_out_of_public_path_and_remains_readable(): void {
		$public_dir = ABSPATH . 'tmp-private-media-tests';
		if ( ! is_dir( $public_dir ) ) {
			mkdir( $public_dir, 0777, true );
		}

		$public_path = $public_dir . '/progress-photo.png';
		file_put_contents( $public_path, base64_decode( self::PNG_1X1_BASE64 ) );

		$attachment_id = \wp_insert_attachment( [
			'post_mime_type' => 'image/png',
			'post_title' => 'Progress photo',
			'post_status' => 'inherit',
		], $public_path );

		$result = PrivateMediaService::ensure_private_attachment( (int) $attachment_id, 42 );
		$data_url = PrivateMediaService::attachment_to_data_url(
			(int) $attachment_id,
			'photo_missing',
			'Progress photo file not found.',
			[ 'image/png' ]
		);

		$this->assertTrue( $result );
		$this->assertIsString( $data_url );
		$this->assertStringStartsWith( 'data:image/png;base64,', $data_url );

		$private_path = (string) \get_post_meta( (int) $attachment_id, PrivateMediaService::PRIVATE_MEDIA_META_KEY, true );
		$this->assertNotSame( $public_path, $private_path );
		$this->assertStringStartsWith( JF_PRIVATE_MEDIA_DIR, $private_path );
		$this->assertFileExists( $private_path );
		$this->assertFileDoesNotExist( $public_path );
		$this->assertSame( $private_path, \get_attached_file( (int) $attachment_id ) );
		$this->assertSame( 42, (int) \get_post_meta( (int) $attachment_id, 'jf_owner_user_id', true ) );

		\wp_delete_attachment( (int) $attachment_id, true );
		$this->deleteDirectory( $public_dir );
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
