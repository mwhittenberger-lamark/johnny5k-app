<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class RecipeImageService {
	private const CACHE_OPTION = 'jf_recipe_generated_images';

	public static function generate( int $user_id, array $recipe ): array|\WP_Error {
		$name = sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) );
		if ( '' === $name ) {
			return new \WP_Error( 'recipe_name_required', 'A recipe name is required.' );
		}

		$key   = self::cache_key( $recipe );
		$cache = get_option( self::CACHE_OPTION, [] );
		$cache = is_array( $cache ) ? $cache : [];
		if ( ! empty( $cache[ $key ]['image_url'] ) ) {
			return [ 'image_url' => esc_url_raw( (string) $cache[ $key ]['image_url'] ), 'cached' => true ];
		}

		$result = GeminiImageService::generate_image( $user_id, self::prompt( $recipe ), [], [
			'aspect_ratio' => '1:1',
			'image_size'   => '1K',
		] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$upload = wp_upload_dir();
		$dir    = trailingslashit( (string) ( $upload['basedir'] ?? '' ) ) . 'johnny5k-recipe-images';
		$url    = trailingslashit( (string) ( $upload['baseurl'] ?? '' ) ) . 'johnny5k-recipe-images';
		if ( empty( $upload['basedir'] ) || empty( $upload['baseurl'] ) || ( ! file_exists( $dir ) && ! wp_mkdir_p( $dir ) ) ) {
			return new \WP_Error( 'recipe_image_upload_failed', 'The recipe image directory is unavailable.' );
		}

		$extensions = [ 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/png' => 'png' ];
		$extension  = $extensions[ (string) ( $result['mime_type'] ?? '' ) ] ?? 'png';
		$filename   = sanitize_file_name( sanitize_title( $name ) . '-' . substr( $key, 0, 10 ) . '.' . $extension );
		if ( false === file_put_contents( trailingslashit( $dir ) . $filename, (string) ( $result['data'] ?? '' ) ) ) {
			return new \WP_Error( 'recipe_image_upload_failed', 'The generated recipe image could not be saved.' );
		}

		$image_url       = trailingslashit( $url ) . $filename;
		$cache[ $key ]   = [ 'image_url' => $image_url, 'generated_at' => current_time( 'mysql', true ) ];
		update_option( self::CACHE_OPTION, $cache, false );

		return [ 'image_url' => $image_url, 'cached' => false ];
	}

	private static function cache_key( array $recipe ): string {
		return md5( wp_json_encode( [
			'name'        => sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) ),
			'meal_type'   => sanitize_key( (string) ( $recipe['meal_type'] ?? 'meal' ) ),
			'ingredients' => array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ), 0, 8 ),
		] ) );
	}

	private static function prompt( array $recipe ): string {
		$name        = sanitize_text_field( (string) $recipe['recipe_name'] );
		$meal_type   = sanitize_text_field( (string) ( $recipe['meal_type'] ?? 'meal' ) );
		$ingredients = array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ), 0, 8 );

		return sprintf(
			'Create a polished square editorial food photograph of %1$s, a %2$s recipe. %3$s Use realistic texture, natural directional light, refined dark tableware, and an inviting modern fitness-lifestyle aesthetic. No text, labels, watermarks, hands, people, or packaging.',
			$name,
			$meal_type,
			$ingredients ? 'Show these key ingredients clearly: ' . implode( ', ', $ingredients ) . '.' : ''
		);
	}
}
