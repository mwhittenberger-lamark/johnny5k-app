<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

require_once dirname(__DIR__) . '/includes/REST/class-nutrition-recipe-controller.php';

use Johnny5k\REST\NutritionRecipeController;
use Johnny5k\Tests\Support\ServiceTestCase;

class NutritionRecipeControllerTest extends ServiceTestCase {
	public function test_update_recipe_cookbook_persists_missing_cookbook_ingredients_into_grocery_gap(): void {
		\wp_set_current_user( 7 );
		\update_user_meta( 7, 'jf_nutrition_grocery_gap_items', [
			[
				'item_name' => 'Greek Yogurt',
				'quantity' => null,
				'unit' => null,
				'notes' => null,
			],
		] );

		$db = $this->wpdb();
		$db->expectGetVar( 'SELECT id FROM wp_fit_recipe_suggestions WHERE user_id = 7 AND recipe_key =', 0 );
		$db->expectGetResults( 'SELECT item_name FROM wp_fit_pantry_items WHERE user_id = 7 ORDER BY item_name', [
			(object) [ 'item_name' => 'Chicken' ],
		] );

		$request = new \WP_REST_Request( 'PUT', '/fit/v1/nutrition/recipe-cookbook' );
		$request->set_param( 'recipes', [
			[
				'key' => 'dinner-bowl',
				'recipe_name' => 'Chicken Rice Bowl',
				'meal_type' => 'dinner',
				'ingredients' => [ 'Chicken', 'Rice' ],
				'missing_ingredients' => [ 'Chicken', 'Rice' ],
				'dietary_tags' => [ 'high_protein', 'dash', 'high_protein' ],
				'image_url' => 'https://example.com/chicken-rice-bowl.png',
			],
		] );

		$response = NutritionRecipeController::update_recipe_cookbook( $request );
		$data = $response->get_data();
		$stored_gap = \get_user_meta( 7, 'jf_nutrition_grocery_gap_items', true );

		self::assertSame( 200, $response->get_status() );
		self::assertTrue( $data['updated'] );
		self::assertSame( 'dinner-bowl', $data['recipes'][0]['key'] );
		self::assertSame( [ 'high_protein', 'dash' ], $data['recipes'][0]['dietary_tags'] );
		self::assertSame( 'https://example.com/chicken-rice-bowl.png', $data['recipes'][0]['image_url'] );
		self::assertSame(
			[ 'Greek Yogurt', 'Rice' ],
			array_map(
				static fn( array $item ): string => (string) ( $item['item_name'] ?? '' ),
				is_array( $stored_gap ) ? array_values( $stored_gap ) : []
			)
		);
	}
}
