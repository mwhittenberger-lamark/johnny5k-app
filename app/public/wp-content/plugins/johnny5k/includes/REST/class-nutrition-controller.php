<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

class NutritionController extends AbstractNutritionController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = self::auth_callback();

		register_rest_route( $ns, '/nutrition/meal', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'log_meal' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/meals', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_meals' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/meal/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_meal' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_meal' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
		] );

		register_rest_route( $ns, '/nutrition/summary', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_nutrition_summary' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/beverage-board', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_beverage_board' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/water', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_water_intake' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/saved-foods', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_saved_foods' ], 'permission_callback' => $auth ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_saved_food' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/foods/search', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'search_foods' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/recent-foods', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_recent_foods' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_recent_foods' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/recent-foods/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_recent_food' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_recent_food' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-foods/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_saved_food' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_saved_food' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-foods/(?P<id>\d+)/log', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'log_saved_food' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/pantry', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'add_pantry_item' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_pantry' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/pantry/bulk', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'add_pantry_items_bulk' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/pantry/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_pantry_item' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_pantry_item' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-meals', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_saved_meals' ], 'permission_callback' => $auth ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_saved_meal' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/saved-meals/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_saved_meal' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_saved_meal' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/saved-meals/(?P<id>\d+)/log', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'log_saved_meal' ],
			'permission_callback' => $auth,
		] );

		NutritionRecipeController::register_routes();
	}
}
