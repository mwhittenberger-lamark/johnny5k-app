<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;
use Johnny5k\Services\UserTime;

/**
 * REST Controller: AI / Johnny 5000
 *
 * POST /fit/v1/ai/chat              — general chat
 * POST /fit/v1/ai/analyse/meal      — send meal photo for nutrition analysis
 * POST /fit/v1/ai/analyse/label     — send food label photo for extraction
 * GET  /fit/v1/ai/thread/{key}      — get conversation history for a thread
 * DELETE /fit/v1/ai/thread/{key}    — clear a thread's history
 *
 * REST Controller: Nutrition
 *
 * POST /fit/v1/nutrition/meal       — log a meal (manual)
 * GET  /fit/v1/nutrition/meals      — get meals for a date range
 * DELETE /fit/v1/nutrition/meal/{id} — delete a meal
 * GET  /fit/v1/nutrition/summary    — daily summary for given date
 * POST /fit/v1/nutrition/pantry     — add pantry item
 * GET  /fit/v1/nutrition/pantry     — list pantry items
 */
class AiController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		// ── AI / Chat ─────────────────────────────────────────────────────────
		register_rest_route( $ns, '/ai/chat', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'chat' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/analyse/meal', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'analyse_meal' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/analyse/label', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'analyse_label' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/thread/(?P<key>[a-z0-9_\-]+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_thread' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'clear_thread' ],
				'permission_callback' => $auth,
			],
		] );

		// ── Nutrition ─────────────────────────────────────────────────────────
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
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_meal' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/nutrition/summary', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_nutrition_summary' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/pantry', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'add_pantry_item' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_pantry' ],      'permission_callback' => $auth ],
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
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_saved_meals' ],   'permission_callback' => $auth ],
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

		register_rest_route( $ns, '/nutrition/recipes', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_recipe_suggestions' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/grocery-gap', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_grocery_gap' ],
			'permission_callback' => $auth,
		] );
	}

	// ── POST /ai/chat ─────────────────────────────────────────────────────────

	public static function chat( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$message    = sanitize_textarea_field( $req->get_param( 'message' ) ?: '' );
		$thread_key = sanitize_text_field( $req->get_param( 'thread_key' ) ?: 'main' );
		$mode       = sanitize_text_field( $req->get_param( 'mode' ) ?: 'general' );

		if ( ! $message ) {
			return new \WP_REST_Response( [ 'message' => 'No message provided.' ], 400 );
		}

		$thread_key = 'u' . $user_id . '_' . $thread_key;
		$result     = AiService::chat( $user_id, $thread_key, $message, $mode );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [
			'reply'           => $result['reply'],
			'actions'         => $result['actions'] ?? [],
			'sources'         => $result['sources'] ?? [],
			'used_web_search' => (bool) ( $result['used_web_search'] ?? false ),
		] );
	}

	// ── POST /ai/analyse/meal ─────────────────────────────────────────────────

	public static function analyse_meal( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$image   = $req->get_param( 'image_base64' ); // data:image/jpeg;base64,...

		if ( ! $image ) {
			return new \WP_REST_Response( [ 'message' => 'No image provided.' ], 400 );
		}

		$result = AiService::analyse_food_image( $user_id, $image, 'meal_photo' );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	// ── POST /ai/analyse/label ────────────────────────────────────────────────

	public static function analyse_label( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$image   = $req->get_param( 'image_base64' );

		if ( ! $image ) {
			return new \WP_REST_Response( [ 'message' => 'No image provided.' ], 400 );
		}

		$result = AiService::analyse_food_image( $user_id, $image, 'food_label' );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	// ── GET /ai/thread/{key} ──────────────────────────────────────────────────

	public static function get_thread( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id    = get_current_user_id();
		$key        = 'u' . $user_id . '_' . sanitize_text_field( $req->get_param( 'key' ) );

		$thread = $wpdb->get_row( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_ai_threads WHERE thread_key = %s AND user_id = %d",
			$key, $user_id
		) );

		if ( ! $thread ) {
			return new \WP_REST_Response( [ 'messages' => [] ] );
		}

		$messages = $wpdb->get_results( $wpdb->prepare(
			"SELECT role, message_text, created_at FROM {$wpdb->prefix}fit_ai_messages
			 WHERE thread_id = %d AND role IN ('user','assistant') ORDER BY id ASC",
			$thread->id
		) );

		return new \WP_REST_Response( [ 'messages' => $messages ] );
	}

	// ── DELETE /ai/thread/{key} ───────────────────────────────────────────────

	public static function clear_thread( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$key     = 'u' . $user_id . '_' . sanitize_text_field( $req->get_param( 'key' ) );

		$thread_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_ai_threads WHERE thread_key = %s AND user_id = %d",
			$key, $user_id
		) );

		if ( $thread_id ) {
			$wpdb->delete( $p . 'fit_ai_messages', [ 'thread_id' => $thread_id ] );
			$wpdb->delete( $p . 'fit_ai_threads',  [ 'id'        => $thread_id ] );
		}

		return new \WP_REST_Response( [ 'cleared' => true ] );
	}

	// ── POST /nutrition/meal ──────────────────────────────────────────────────

	public static function log_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$meal_dt = sanitize_text_field( $req->get_param( 'meal_datetime' ) ?: UserTime::mysql( $user_id ) );
		$type    = sanitize_text_field( $req->get_param( 'meal_type' )    ?: 'lunch' );
		$source  = sanitize_text_field( $req->get_param( 'source' )       ?: 'manual' );
		$items   = $req->get_param( 'items' ); // array of item objects

		$wpdb->insert( $p . 'fit_meals', [
			'user_id'       => $user_id,
			'meal_datetime' => $meal_dt,
			'meal_type'     => $type,
			'source'        => $source,
			'confirmed'     => 1,
		] );
		$meal_id = (int) $wpdb->insert_id;

		if ( is_array( $items ) ) {
			foreach ( $items as $item ) {
				$item = (array) $item;
				$wpdb->insert( $p . 'fit_meal_items', array_filter( [
					'meal_id'        => $meal_id,
					'food_name'      => sanitize_text_field( $item['food_name']     ?? '' ),
					'serving_amount' => (float) ( $item['serving_amount'] ?? 1 ),
					'serving_unit'   => sanitize_text_field( $item['serving_unit']  ?? 'serving' ),
					'calories'       => (int)   ( $item['calories']   ?? 0 ),
					'protein_g'      => (float) ( $item['protein_g']  ?? 0 ),
					'carbs_g'        => (float) ( $item['carbs_g']    ?? 0 ),
					'fat_g'          => (float) ( $item['fat_g']      ?? 0 ),
					'fiber_g'        => isset( $item['fiber_g'] )    ? (float) $item['fiber_g']    : null,
					'sugar_g'        => isset( $item['sugar_g'] )    ? (float) $item['sugar_g']    : null,
					'sodium_mg'      => isset( $item['sodium_mg'] )  ? (float) $item['sodium_mg']  : null,
				], fn( $v ) => $v !== null ) );
			}
		}

		\Johnny5k\Services\AwardEngine::grant( $user_id, 'first_meal_logged' );

		return new \WP_REST_Response( [ 'meal_id' => $meal_id ], 201 );
	}

	// ── GET /nutrition/meals ──────────────────────────────────────────────────

	public static function get_meals( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$date    = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		$meals = $wpdb->get_results( $wpdb->prepare(
			"SELECT m.id, m.meal_type, m.meal_datetime, m.source, m.confirmed
			 FROM {$p}fit_meals m
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1
			 ORDER BY m.meal_datetime",
			$user_id, $date
		) );

		foreach ( $meals as $meal ) {
			$meal->items = $wpdb->get_results( $wpdb->prepare(
				"SELECT food_name, serving_amount, serving_unit, calories, protein_g, carbs_g, fat_g
				 FROM {$p}fit_meal_items WHERE meal_id = %d",
				$meal->id
			) );
		}

		return new \WP_REST_Response( $meals );
	}

	// ── DELETE /nutrition/meal/{id} ───────────────────────────────────────────

	public static function delete_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$meal_id = (int) $req->get_param( 'id' );

		$owner = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$p}fit_meals WHERE id = %d",
			$meal_id
		) );

		if ( $owner !== $user_id ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$wpdb->delete( $p . 'fit_meal_items', [ 'meal_id' => $meal_id ] );
		$wpdb->delete( $p . 'fit_meals',      [ 'id'      => $meal_id ] );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	// ── GET /nutrition/summary ────────────────────────────────────────────────

	public static function get_nutrition_summary( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$date    = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		$totals = $wpdb->get_row( $wpdb->prepare(
			"SELECT SUM(mi.calories)  AS calories,
			        SUM(mi.protein_g) AS protein_g,
			        SUM(mi.carbs_g)   AS carbs_g,
			        SUM(mi.fat_g)     AS fat_g,
			        SUM(mi.fiber_g)   AS fiber_g,
			        SUM(mi.sodium_mg) AS sodium_mg
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
			$user_id, $date
		) );

		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		return new \WP_REST_Response( [
			'date'   => $date,
			'totals' => $totals,
			'targets' => $goal,
		] );
	}

	// ── POST /nutrition/pantry ────────────────────────────────────────────────

	public static function add_pantry_item( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$wpdb->insert( $wpdb->prefix . 'fit_pantry_items', array_filter( [
			'user_id'    => $user_id,
			'item_name'  => sanitize_text_field( $req->get_param( 'item_name' ) ?: '' ),
			'quantity'   => $req->get_param( 'quantity' ) ? (float) $req->get_param( 'quantity' ) : null,
			'unit'       => sanitize_text_field( $req->get_param( 'unit' ) ?: '' ) ?: null,
			'expires_on' => sanitize_text_field( $req->get_param( 'expires_on' ) ?: '' ) ?: null,
		], fn( $v ) => $v !== null ) );

		return new \WP_REST_Response( [ 'id' => $wpdb->insert_id ], 201 );
	}

	// ── GET /nutrition/pantry ─────────────────────────────────────────────────

	public static function get_pantry( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();

		$items = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_pantry_items WHERE user_id = %d ORDER BY item_name",
			$user_id
		) );

		return new \WP_REST_Response( $items );
	}

	public static function update_pantry_item( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$item_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_row( $wpdb->prefix . 'fit_pantry_items', $item_id, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$update = array_filter( [
			'item_name'  => $req->get_param( 'item_name' ) !== null ? sanitize_text_field( $req->get_param( 'item_name' ) ) : null,
			'quantity'   => $req->get_param( 'quantity' ) !== null ? (float) $req->get_param( 'quantity' ) : null,
			'unit'       => $req->get_param( 'unit' ) !== null ? sanitize_text_field( $req->get_param( 'unit' ) ) : null,
			'expires_on' => $req->get_param( 'expires_on' ) !== null ? sanitize_text_field( $req->get_param( 'expires_on' ) ) : null,
		], fn( $value ) => $value !== null );

		if ( $update ) {
			$wpdb->update( $wpdb->prefix . 'fit_pantry_items', $update, [ 'id' => $item_id ] );
		}

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function delete_pantry_item( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$item_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_row( $wpdb->prefix . 'fit_pantry_items', $item_id, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$wpdb->delete( $wpdb->prefix . 'fit_pantry_items', [ 'id' => $item_id ] );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function get_saved_meals( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_saved_meals WHERE user_id = %d ORDER BY updated_at DESC, id DESC",
			$user_id
		) );

		foreach ( $rows as $row ) {
			$row->items = self::decode_json_list( $row->items_json );
			$row->micros = self::decode_json_list( $row->micros_json );
		}

		return new \WP_REST_Response( $rows );
	}

	public static function create_saved_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$payload = self::build_saved_meal_payload( $req );

		$wpdb->insert( $p . 'fit_saved_meals', [
			'user_id'     => $user_id,
			'name'        => $payload['name'],
			'meal_type'   => $payload['meal_type'],
			'items_json'  => wp_json_encode( $payload['items'] ),
			'calories'    => $payload['calories'],
			'protein_g'   => $payload['protein_g'],
			'carbs_g'     => $payload['carbs_g'],
			'fat_g'       => $payload['fat_g'],
			'micros_json' => wp_json_encode( $payload['micros'] ),
		] );

		return new \WP_REST_Response( [ 'id' => (int) $wpdb->insert_id ], 201 );
	}

	public static function update_saved_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$meal_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_row( $p . 'fit_saved_meals', $meal_id, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$payload = self::build_saved_meal_payload( $req );
		$wpdb->update( $p . 'fit_saved_meals', [
			'name'        => $payload['name'],
			'meal_type'   => $payload['meal_type'],
			'items_json'  => wp_json_encode( $payload['items'] ),
			'calories'    => $payload['calories'],
			'protein_g'   => $payload['protein_g'],
			'carbs_g'     => $payload['carbs_g'],
			'fat_g'       => $payload['fat_g'],
			'micros_json' => wp_json_encode( $payload['micros'] ),
		], [ 'id' => $meal_id ] );

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function delete_saved_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$meal_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_row( $p . 'fit_saved_meals', $meal_id, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$wpdb->delete( $p . 'fit_saved_meals', [ 'id' => $meal_id ] );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function log_saved_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$meal_id = (int) $req->get_param( 'id' );

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_saved_meals WHERE id = %d AND user_id = %d",
			$meal_id,
			$user_id
		) );

		if ( ! $row ) {
			return new \WP_REST_Response( [ 'message' => 'Saved meal not found.' ], 404 );
		}

		$req->set_param( 'meal_type', $row->meal_type );
		$req->set_param( 'source', 'saved_meal' );
		$req->set_param( 'items', self::decode_json_list( $row->items_json ) );

		return self::log_meal( $req );
	}

	public static function get_recipe_suggestions( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$pantry_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT item_name FROM {$p}fit_pantry_items WHERE user_id = %d ORDER BY updated_at DESC, id DESC LIMIT 12",
			$user_id
		) );
		$prefs = self::get_user_food_preferences( $user_id );
		$suggestions = self::build_recipe_suggestions( $pantry_rows, $prefs );

		$wpdb->delete( $p . 'fit_recipe_suggestions', [ 'user_id' => $user_id ] );
		foreach ( $suggestions as $suggestion ) {
			$wpdb->insert( $p . 'fit_recipe_suggestions', [
				'user_id'                => $user_id,
				'recipe_name'            => $suggestion['recipe_name'],
				'ingredients_json'       => wp_json_encode( $suggestion['ingredients'] ),
				'instructions_json'      => wp_json_encode( $suggestion['instructions'] ),
				'estimated_calories'     => $suggestion['estimated_calories'],
				'estimated_protein_g'    => $suggestion['estimated_protein_g'],
				'estimated_carbs_g'      => $suggestion['estimated_carbs_g'],
				'estimated_fat_g'        => $suggestion['estimated_fat_g'],
				'fits_goal'              => 1,
			] );
		}

		return new \WP_REST_Response( $suggestions );
	}

	public static function get_grocery_gap( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$pantry_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT item_name FROM {$p}fit_pantry_items WHERE user_id = %d ORDER BY item_name",
			$user_id
		) );
		$prefs = self::get_user_food_preferences( $user_id );
		$gaps = self::build_grocery_gap( $pantry_rows, $prefs );

		return new \WP_REST_Response( $gaps );
	}

	private static function user_owns_row( string $table, int $row_id, int $user_id ): bool {
		global $wpdb;

		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$table} WHERE id = %d",
			$row_id
		) ) === $user_id;
	}

	private static function decode_json_list( $value ): array {
		if ( ! $value ) {
			return [];
		}

		$decoded = json_decode( (string) $value, true );
		return is_array( $decoded ) ? $decoded : [];
	}

	private static function build_saved_meal_payload( \WP_REST_Request $req ): array {
		$items = $req->get_param( 'items' );
		$items = is_array( $items ) ? array_values( array_map( static function( $item ) {
			$item = (array) $item;
			return [
				'food_name'      => sanitize_text_field( $item['food_name'] ?? '' ),
				'serving_amount' => (float) ( $item['serving_amount'] ?? 1 ),
				'serving_unit'   => sanitize_text_field( $item['serving_unit'] ?? 'serving' ),
				'calories'       => (int) ( $item['calories'] ?? 0 ),
				'protein_g'      => (float) ( $item['protein_g'] ?? 0 ),
				'carbs_g'        => (float) ( $item['carbs_g'] ?? 0 ),
				'fat_g'          => (float) ( $item['fat_g'] ?? 0 ),
			];
		}, $items ) ) : [];

		$totals = [ 'calories' => 0, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 0.0 ];
		foreach ( $items as $item ) {
			$totals['calories'] += (int) $item['calories'];
			$totals['protein_g'] += (float) $item['protein_g'];
			$totals['carbs_g'] += (float) $item['carbs_g'];
			$totals['fat_g'] += (float) $item['fat_g'];
		}

		return [
			'name'      => sanitize_text_field( $req->get_param( 'name' ) ?: 'Saved meal' ),
			'meal_type' => sanitize_text_field( $req->get_param( 'meal_type' ) ?: 'lunch' ),
			'items'     => $items,
			'calories'  => $totals['calories'],
			'protein_g' => round( $totals['protein_g'], 2 ),
			'carbs_g'   => round( $totals['carbs_g'], 2 ),
			'fat_g'     => round( $totals['fat_g'], 2 ),
			'micros'    => [],
		];
	}

	private static function get_user_food_preferences( int $user_id ): array {
		global $wpdb;
		$prefs = $wpdb->get_row( $wpdb->prepare(
			"SELECT food_preferences_json, food_dislikes_json, common_breakfasts_json
			 FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d",
			$user_id
		), ARRAY_A );

		return [
			'food_preferences' => self::decode_json_list( $prefs['food_preferences_json'] ?? null ),
			'food_dislikes'    => self::decode_json_list( $prefs['food_dislikes_json'] ?? null ),
			'common_meals'     => self::decode_json_list( $prefs['common_breakfasts_json'] ?? null ),
		];
	}

	private static function build_recipe_suggestions( array $pantry_rows, array $prefs ): array {
		$pantry = array_values( array_filter( array_map( static fn( $row ) => strtolower( trim( (string) $row->item_name ) ), $pantry_rows ) ) );
		$preferred_foods = strtolower( trim( (string) ( $prefs['food_preferences']['preferred_foods'] ?? '' ) ) );
		$dislikes = array_map( 'strtolower', array_map( 'trim', $prefs['food_dislikes'] ?? [] ) );

		$protein_base = in_array( 'chicken', $pantry, true ) ? 'chicken' : ( in_array( 'eggs', $pantry, true ) ? 'eggs' : 'greek yogurt' );
		$carb_base = in_array( 'rice', $pantry, true ) ? 'rice' : ( in_array( 'oats', $pantry, true ) ? 'oats' : 'potatoes' );
		$veg_base = in_array( 'spinach', $pantry, true ) ? 'spinach' : ( in_array( 'broccoli', $pantry, true ) ? 'broccoli' : 'mixed vegetables' );

		$suggestions = [
			[
				'recipe_name' => ucfirst( $protein_base ) . ' Power Bowl',
				'ingredients' => [ $protein_base, $carb_base, $veg_base, 'olive oil', 'salt', 'pepper' ],
				'instructions' => [ 'Cook the protein until done.', 'Prepare the carb base.', 'Saute the vegetables and combine everything in one bowl.' ],
				'estimated_calories' => 620,
				'estimated_protein_g' => 44,
				'estimated_carbs_g' => 52,
				'estimated_fat_g' => 18,
			],
			[
				'recipe_name' => 'Fast Recovery Scramble',
				'ingredients' => [ 'eggs', $veg_base, 'toast', 'fruit' ],
				'instructions' => [ 'Scramble the eggs.', 'Add vegetables during the last minute.', 'Serve with toast and fruit.' ],
				'estimated_calories' => 510,
				'estimated_protein_g' => 33,
				'estimated_carbs_g' => 39,
				'estimated_fat_g' => 21,
			],
			[
				'recipe_name' => 'Goal-Friendly Yogurt Oats',
				'ingredients' => [ 'greek yogurt', 'oats', 'berries', 'peanut butter' ],
				'instructions' => [ 'Mix yogurt and oats.', 'Top with berries.', 'Add a spoon of peanut butter before serving.' ],
				'estimated_calories' => 470,
				'estimated_protein_g' => 32,
				'estimated_carbs_g' => 46,
				'estimated_fat_g' => 14,
			],
		];

		return array_values( array_filter( $suggestions, static function( $suggestion ) use ( $dislikes, $preferred_foods ) {
			$text = strtolower( implode( ' ', $suggestion['ingredients'] ) . ' ' . $suggestion['recipe_name'] );
			foreach ( $dislikes as $dislike ) {
				if ( $dislike && str_contains( $text, $dislike ) ) {
					return false;
				}
			}
			if ( ! $preferred_foods ) {
				return true;
			}

			$first_preference = trim( strtok( $preferred_foods, ',' ) ?: '' );
			return ! $first_preference || str_contains( $text, $first_preference );
		} ) );
	}

	private static function build_grocery_gap( array $pantry_rows, array $prefs ): array {
		$pantry = array_map( static fn( $row ) => strtolower( trim( (string) $row->item_name ) ), $pantry_rows );
		$preferred_foods = array_filter( array_map( 'trim', explode( ',', (string) ( $prefs['food_preferences']['preferred_foods'] ?? '' ) ) ) );
		$common_meals = array_filter( array_map( 'trim', [
			(string) ( $prefs['common_meals']['breakfasts'] ?? '' ),
			(string) ( $prefs['common_meals']['lunches'] ?? '' ),
		] ) );

		$staples = array_unique( array_filter( array_merge( [ 'chicken', 'eggs', 'rice', 'oats', 'berries', 'greek yogurt', 'spinach' ], $preferred_foods ) ) );
		$missing = array_values( array_filter( $staples, static fn( $item ) => ! in_array( strtolower( $item ), $pantry, true ) ) );

		return [
			'missing_items' => array_slice( $missing, 0, 8 ),
			'pantry_count'  => count( $pantry ),
			'context'       => [
				'preferred_foods' => array_slice( $preferred_foods, 0, 5 ),
				'common_meals'    => array_slice( $common_meals, 0, 4 ),
			],
		];
	}
}
