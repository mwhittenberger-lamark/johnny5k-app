<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\RecipeImageService;
use Johnny5k\Tests\Support\ServiceTestCase;

class RecipeImageServiceTest extends ServiceTestCase {
	public function test_cached_image_is_returned_and_persisted_to_recipe_row(): void {
		$recipe = [
			'key' => 'generated-dinner-chicken-rice-bowl',
			'recipe_name' => 'Chicken Rice Bowl',
			'meal_type' => 'dinner',
			'ingredients' => [ 'Chicken', 'Rice' ],
		];
		$cache_key = md5( wp_json_encode( [
			'name' => 'Chicken Rice Bowl',
			'meal_type' => 'dinner',
			'ingredients' => [ 'Chicken', 'Rice' ],
		] ) );
		$this->setOption( 'jf_recipe_generated_images', [
			$cache_key => [ 'image_url' => 'https://example.test/recipe.jpg' ],
		] );

		$result = RecipeImageService::generate( 7, $recipe );

		self::assertSame( 'https://example.test/recipe.jpg', $result['image_url'] );
		self::assertTrue( $result['cached'] );
		self::assertSame( [
			'table' => 'wp_fit_recipe_suggestions',
			'data' => [ 'image_url' => 'https://example.test/recipe.jpg' ],
			'where' => [ 'user_id' => 7, 'recipe_key' => 'generated-dinner-chicken-rice-bowl' ],
		], $this->wpdb()->updated[0] );
	}

	public function test_existing_image_url_reads_generation_cache(): void {
		$recipe = [
			'recipe_name' => 'Berry Oats',
			'meal_type' => 'breakfast',
			'ingredients' => [ 'Oats', 'Berries' ],
		];
		$cache_key = md5( wp_json_encode( [
			'name' => 'Berry Oats',
			'meal_type' => 'breakfast',
			'ingredients' => [ 'Oats', 'Berries' ],
		] ) );
		$this->setOption( 'jf_recipe_generated_images', [
			$cache_key => [ 'image_url' => 'https://example.test/berry-oats.jpg' ],
		] );

		self::assertSame( 'https://example.test/berry-oats.jpg', RecipeImageService::existing_image_url( $recipe ) );
	}
}
