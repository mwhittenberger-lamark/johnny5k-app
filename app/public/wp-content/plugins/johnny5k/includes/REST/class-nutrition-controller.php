<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

class NutritionController {

	public static function register_routes( string $ns, $auth ): void {
		register_rest_route( $ns, '/nutrition/meal', [
			'methods'             => 'POST',
			'callback'            => [ AiController::class, 'log_meal' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/meals', [
			'methods'             => 'GET',
			'callback'            => [ AiController::class, 'get_meals' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/meal/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ AiController::class, 'update_meal' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ AiController::class, 'delete_meal' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
		] );

		register_rest_route( $ns, '/nutrition/summary', [
			'methods'             => 'GET',
			'callback'            => [ AiController::class, 'get_nutrition_summary' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/saved-foods', [
			[ 'methods' => 'GET', 'callback' => [ AiController::class, 'get_saved_foods' ], 'permission_callback' => $auth ],
			[ 'methods' => 'POST', 'callback' => [ AiController::class, 'create_saved_food' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/foods/search', [
			'methods'             => 'GET',
			'callback'            => [ AiController::class, 'search_foods' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/recent-foods', [
			[
				'methods'             => 'GET',
				'callback'            => [ AiController::class, 'get_recent_foods' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ AiController::class, 'delete_recent_foods' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/recent-foods/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ AiController::class, 'update_recent_food' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ AiController::class, 'delete_recent_food' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-foods/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ AiController::class, 'update_saved_food' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ AiController::class, 'delete_saved_food' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-foods/(?P<id>\d+)/log', [
			'methods'             => 'POST',
			'callback'            => [ AiController::class, 'log_saved_food' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/pantry', [
			[ 'methods' => 'POST', 'callback' => [ AiController::class, 'add_pantry_item' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET', 'callback' => [ AiController::class, 'get_pantry' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/pantry/bulk', [
			'methods'             => 'POST',
			'callback'            => [ AiController::class, 'add_pantry_items_bulk' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/pantry/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ AiController::class, 'update_pantry_item' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ AiController::class, 'delete_pantry_item' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-meals', [
			[ 'methods' => 'GET', 'callback' => [ AiController::class, 'get_saved_meals' ], 'permission_callback' => $auth ],
			[ 'methods' => 'POST', 'callback' => [ AiController::class, 'create_saved_meal' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/saved-meals/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ AiController::class, 'update_saved_meal' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ AiController::class, 'delete_saved_meal' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-meals/(?P<id>\d+)/log', [
			'methods'             => 'POST',
			'callback'            => [ AiController::class, 'log_saved_meal' ],
			'permission_callback' => $auth,
		] );

		NutritionRecipeController::register_routes( $ns, $auth );
	}
}
