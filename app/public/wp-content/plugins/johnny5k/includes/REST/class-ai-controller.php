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
	private const GROCERY_GAP_ITEMS_META_KEY = 'jf_nutrition_grocery_gap_items';

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

		register_rest_route( $ns, '/ai/analyse/food-text', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'analyse_food_text' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/analyse/pantry-text', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'analyse_pantry_text' ],
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

		register_rest_route( $ns, '/nutrition/saved-foods', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_saved_foods' ],   'permission_callback' => $auth ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_saved_food' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/nutrition/foods/search', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'search_foods' ],
			'permission_callback' => $auth,
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
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_pantry' ],      'permission_callback' => $auth ],
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

		register_rest_route( $ns, '/nutrition/grocery-gap/items', [
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'add_grocery_gap_items' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_grocery_gap_items' ],
				'permission_callback' => $auth,
			],
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
			'used_tools'      => $result['used_tools'] ?? [],
			'action_results'  => $result['action_results'] ?? [],
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

	public static function analyse_food_text( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$food_text = sanitize_text_field( (string) ( $req->get_param( 'food_text' ) ?: '' ) );

		if ( ! $food_text ) {
			return new \WP_REST_Response( [ 'message' => 'No food text provided.' ], 400 );
		}

		$result = AiService::analyse_food_text( $user_id, $food_text );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function analyse_pantry_text( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$pantry_text = sanitize_textarea_field( (string) ( $req->get_param( 'pantry_text' ) ?: '' ) );

		if ( ! $pantry_text ) {
			return new \WP_REST_Response( [ 'message' => 'No pantry text provided.' ], 400 );
		}

		$result = AiService::analyse_pantry_text( $user_id, $pantry_text );
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
		$items   = self::enrich_meal_items_with_micros( $user_id, is_array( $items ) ? $items : [] );

		$wpdb->insert( $p . 'fit_meals', [
			'user_id'       => $user_id,
			'meal_datetime' => $meal_dt,
			'meal_type'     => $type,
			'source'        => $source,
			'confirmed'     => 1,
		] );
		$meal_id = (int) $wpdb->insert_id;

		self::replace_meal_items( $meal_id, $items );

		\Johnny5k\Services\AwardEngine::grant( $user_id, 'first_meal_logged' );

		return new \WP_REST_Response( [ 'meal_id' => $meal_id ], 201 );
	}

	public static function update_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$meal_id = (int) $req->get_param( 'id' );

		$meal = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, user_id, meal_datetime, source FROM {$p}fit_meals WHERE id = %d",
			$meal_id
		) );

		if ( ! $meal || (int) $meal->user_id !== $user_id ) {
			return new \WP_REST_Response( [ 'message' => 'Meal not found.' ], 404 );
		}

		$meal_type = sanitize_text_field( (string) ( $req->get_param( 'meal_type' ) ?: 'lunch' ) );
		$meal_datetime = sanitize_text_field( (string) ( $req->get_param( 'meal_datetime' ) ?: $meal->meal_datetime ) );
		$source = sanitize_text_field( (string) ( $req->get_param( 'source' ) ?: $meal->source ?: 'manual' ) );
		$items = $req->get_param( 'items' );
		$items = self::enrich_meal_items_with_micros( $user_id, is_array( $items ) ? $items : [] );

		$wpdb->update( $p . 'fit_meals', [
			'meal_datetime' => $meal_datetime,
			'meal_type' => $meal_type,
			'source'    => $source,
			'confirmed' => 1,
		], [ 'id' => $meal_id ] );

		self::replace_meal_items( $meal_id, $items );

		return new \WP_REST_Response( [ 'updated' => true ] );
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
			 ORDER BY m.meal_datetime DESC",
			$user_id, $date
		) );

		foreach ( $meals as $meal ) {
			$meal->items = $wpdb->get_results( $wpdb->prepare(
				"SELECT food_id, food_name, serving_amount, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, source_json
				 FROM {$p}fit_meal_items WHERE meal_id = %d",
				$meal->id
			) );

			foreach ( $meal->items as $item ) {
				$item->micros = $item->micros_json ? self::decode_json_list( $item->micros_json ) : [];
				$item->source = $item->source_json ? json_decode( (string) $item->source_json, true ) : null;
				unset( $item->micros_json, $item->source_json );
			}
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

		self::backfill_missing_meal_item_micros_for_date( $user_id, $date );

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

		$micro_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT mi.micros_json, mi.serving_amount, f.micros_json AS saved_food_micros_json
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 LEFT JOIN {$p}fit_foods f ON f.id = mi.food_id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
			$user_id,
			$date
		) );

		$micros = [];
		foreach ( $micro_rows as $micro_row ) {
			$scaled_saved_food_micros = [];
			if ( empty( $micro_row->micros_json ) && ! empty( $micro_row->saved_food_micros_json ) ) {
				$scaled_saved_food_micros = self::scale_micros(
					self::decode_json_list( $micro_row->saved_food_micros_json ),
					max( 0.1, (float) ( $micro_row->serving_amount ?? 1 ) )
				);
			}

			$micros = self::merge_micros(
				$micros,
				! empty( $micro_row->micros_json )
					? self::decode_json_list( $micro_row->micros_json )
					: $scaled_saved_food_micros
			);
		}

		return new \WP_REST_Response( [
			'date'   => $date,
			'totals' => $totals,
			'targets' => $goal,
			'micros' => array_values( $micros ),
		] );
	}

	public static function get_saved_foods( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, canonical_name, brand, serving_size, serving_grams, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, source, label_json
			 FROM {$p}fit_foods
			 WHERE user_id = %d AND active = 1
			 ORDER BY updated_at DESC, id DESC",
			$user_id
		) );

		foreach ( $rows as $row ) {
			$row->micros = $row->micros_json ? self::decode_json_list( $row->micros_json ) : [];
			$row->label = $row->label_json ? json_decode( (string) $row->label_json, true ) : null;
			unset( $row->micros_json );
			unset( $row->label_json );
		}

		return new \WP_REST_Response( $rows );
	}

	public static function create_saved_food( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$payload = self::build_saved_food_payload( $req );
		$payload = self::enrich_saved_food_payload_with_micros( $user_id, $payload );

		$wpdb->insert( $p . 'fit_foods', array_filter( [
			'user_id'       => $user_id,
			'canonical_name'=> $payload['canonical_name'],
			'brand'         => $payload['brand'],
			'serving_size'  => $payload['serving_size'],
			'serving_grams' => $payload['serving_grams'],
			'calories'      => $payload['calories'],
			'protein_g'     => $payload['protein_g'],
			'carbs_g'       => $payload['carbs_g'],
			'fat_g'         => $payload['fat_g'],
			'fiber_g'       => $payload['fiber_g'],
			'sugar_g'       => $payload['sugar_g'],
			'sodium_mg'     => $payload['sodium_mg'],
			'micros_json'   => $payload['micros_json'],
			'source'        => $payload['source'],
			'label_json'    => $payload['label_json'],
		], static fn( $value ) => null !== $value ) );

		return new \WP_REST_Response( [ 'id' => (int) $wpdb->insert_id ], 201 );
	}

	public static function update_saved_food( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$food_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_row( $p . 'fit_foods', $food_id, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Saved food not found.' ], 404 );
		}

		$payload = self::build_saved_food_payload( $req );
		$payload = self::enrich_saved_food_payload_with_micros( $user_id, $payload );
		$wpdb->update( $p . 'fit_foods', array_filter( [
			'canonical_name'=> $payload['canonical_name'],
			'brand'         => $payload['brand'],
			'serving_size'  => $payload['serving_size'],
			'serving_grams' => $payload['serving_grams'],
			'calories'      => $payload['calories'],
			'protein_g'     => $payload['protein_g'],
			'carbs_g'       => $payload['carbs_g'],
			'fat_g'         => $payload['fat_g'],
			'fiber_g'       => $payload['fiber_g'],
			'sugar_g'       => $payload['sugar_g'],
			'sodium_mg'     => $payload['sodium_mg'],
			'micros_json'   => $payload['micros_json'],
			'source'        => $payload['source'],
			'label_json'    => $payload['label_json'],
		], static fn( $value ) => null !== $value ), [ 'id' => $food_id ] );

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function delete_saved_food( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$food_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_row( $p . 'fit_foods', $food_id, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Saved food not found.' ], 404 );
		}

		$wpdb->update( $p . 'fit_foods', [ 'active' => 0 ], [ 'id' => $food_id ] );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function log_saved_food( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$food_id = (int) $req->get_param( 'id' );

		$food = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_foods WHERE id = %d AND user_id = %d AND active = 1",
			$food_id,
			$user_id
		) );

		if ( ! $food ) {
			return new \WP_REST_Response( [ 'message' => 'Saved food not found.' ], 404 );
		}

		$food_micros = self::decode_json_list( $food->micros_json );
		if ( empty( $food_micros ) ) {
			$enriched_food_micros = self::estimate_food_micros(
				$user_id,
				self::build_food_analysis_text(
					$food->canonical_name,
					1,
					$food->serving_size ?: 'serving'
				)
			);

			if ( ! empty( $enriched_food_micros ) ) {
				$food_micros = $enriched_food_micros;
				$food->micros_json = wp_json_encode( $food_micros );
				$wpdb->update(
					$p . 'fit_foods',
					[ 'micros_json' => $food->micros_json ],
					[ 'id' => (int) $food->id ]
				);
			}
		}

		$serving_amount = max( 0.1, (float) ( $req->get_param( 'serving_amount' ) ?: 1 ) );
		$req->set_param( 'meal_type', sanitize_text_field( (string) ( $req->get_param( 'meal_type' ) ?: 'snack' ) ) );
		$req->set_param( 'source', 'label' === $food->source ? 'label' : 'manual' );
		$req->set_param( 'items', [
			[
				'food_id'        => (int) $food->id,
				'food_name'      => $food->canonical_name,
				'serving_amount' => $serving_amount,
				'serving_unit'   => $food->serving_size ?: 'serving',
				'calories'       => (int) round( (float) $food->calories * $serving_amount ),
				'protein_g'      => round( (float) $food->protein_g * $serving_amount, 2 ),
				'carbs_g'        => round( (float) $food->carbs_g * $serving_amount, 2 ),
				'fat_g'          => round( (float) $food->fat_g * $serving_amount, 2 ),
				'fiber_g'        => null !== $food->fiber_g ? round( (float) $food->fiber_g * $serving_amount, 2 ) : null,
				'sugar_g'        => null !== $food->sugar_g ? round( (float) $food->sugar_g * $serving_amount, 2 ) : null,
				'sodium_mg'      => null !== $food->sodium_mg ? round( (float) $food->sodium_mg * $serving_amount, 2 ) : null,
				'micros'         => self::scale_micros( $food_micros, $serving_amount ),
				'source'         => [ 'type' => 'saved_food', 'food_id' => (int) $food->id ],
			],
		] );

		return self::log_meal( $req );
	}

	// ── POST /nutrition/pantry ────────────────────────────────────────────────

	public static function add_pantry_item( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$payload = self::sanitise_pantry_payload( [
			'item_name'  => $req->get_param( 'item_name' ),
			'quantity'   => $req->get_param( 'quantity' ),
			'unit'       => $req->get_param( 'unit' ),
			'expires_on' => $req->get_param( 'expires_on' ),
		] );

		if ( '' === $payload['item_name'] ) {
			return new \WP_REST_Response( [ 'message' => 'Item name is required.' ], 400 );
		}

		$result = self::upsert_pantry_item( $user_id, $payload );
		$status = ! empty( $result['created'] ) ? 201 : 200;

		return new \WP_REST_Response( $result, $status );
	}

	public static function add_pantry_items_bulk( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) ) {
			return new \WP_REST_Response( [ 'message' => 'Items array is required.' ], 400 );
		}

		$results = [];
		$created_count = 0;
		$merged_count = 0;
		$updated_count = 0;

		foreach ( $items as $item ) {
			$payload = self::sanitise_pantry_payload( (array) $item );
			if ( '' === $payload['item_name'] ) {
				continue;
			}

			$result = self::upsert_pantry_item( $user_id, $payload );
			$results[] = $result;

			if ( ! empty( $result['created'] ) ) {
				$created_count++;
			}
			if ( ! empty( $result['merged'] ) ) {
				$merged_count++;
			} elseif ( ! empty( $result['updated'] ) ) {
				$updated_count++;
			}
		}

		if ( empty( $results ) ) {
			return new \WP_REST_Response( [ 'message' => 'No valid pantry items were provided.' ], 400 );
		}

		return new \WP_REST_Response( [
			'items'         => $results,
			'created_count' => $created_count,
			'merged_count'  => $merged_count,
			'updated_count' => $updated_count,
		] );
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

		$current = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_pantry_items WHERE id = %d",
			$item_id
		), ARRAY_A );

		if ( ! $current ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$payload = self::sanitise_pantry_payload( [
			'item_name'  => $req->get_param( 'item_name' ) !== null ? $req->get_param( 'item_name' ) : $current['item_name'],
			'quantity'   => $req->get_param( 'quantity' ) !== null ? $req->get_param( 'quantity' ) : $current['quantity'],
			'unit'       => $req->get_param( 'unit' ) !== null ? $req->get_param( 'unit' ) : $current['unit'],
			'expires_on' => $req->get_param( 'expires_on' ) !== null ? $req->get_param( 'expires_on' ) : $current['expires_on'],
		] );

		if ( '' === $payload['item_name'] ) {
			return new \WP_REST_Response( [ 'message' => 'Item name is required.' ], 400 );
		}

		$result = self::upsert_pantry_item( $user_id, $payload, $item_id );

		return new \WP_REST_Response( $result );
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

		$serving_multiplier = max( 0.1, (float) ( $req->get_param( 'serving_multiplier' ) ?: 1 ) );
		$items = self::decode_json_list( $row->items_json );
		$items = array_values( array_map( static function( $item ) use ( $serving_multiplier, $meal_id ) {
			$item = is_array( $item ) ? $item : [];
			$item['serving_amount'] = round( (float) ( $item['serving_amount'] ?? 1 ) * $serving_multiplier, 2 );
			$item['calories'] = (int) round( (float) ( $item['calories'] ?? 0 ) * $serving_multiplier );
			$item['protein_g'] = round( (float) ( $item['protein_g'] ?? 0 ) * $serving_multiplier, 2 );
			$item['carbs_g'] = round( (float) ( $item['carbs_g'] ?? 0 ) * $serving_multiplier, 2 );
			$item['fat_g'] = round( (float) ( $item['fat_g'] ?? 0 ) * $serving_multiplier, 2 );
			$item['fiber_g'] = isset( $item['fiber_g'] ) ? round( (float) $item['fiber_g'] * $serving_multiplier, 2 ) : null;
			$item['sugar_g'] = isset( $item['sugar_g'] ) ? round( (float) $item['sugar_g'] * $serving_multiplier, 2 ) : null;
			$item['sodium_mg'] = isset( $item['sodium_mg'] ) ? round( (float) $item['sodium_mg'] * $serving_multiplier, 2 ) : null;
			$item['micros'] = self::scale_micros( is_array( $item['micros'] ?? null ) ? $item['micros'] : [], $serving_multiplier );
			$item['source'] = [
				'type' => 'saved_meal',
				'saved_meal_id' => $meal_id,
				'serving_multiplier' => $serving_multiplier,
			];

			return $item;
		}, $items ) );

		$req->set_param( 'meal_type', $row->meal_type );
		$req->set_param( 'source', 'saved_meal' );
		$req->set_param( 'items', $items );

		return self::log_meal( $req );
	}

	public static function get_recipe_suggestions( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$refresh_token = sanitize_text_field( (string) ( $req->get_param( 'refresh_token' ) ?: '' ) );

		$pantry_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT item_name FROM {$p}fit_pantry_items WHERE user_id = %d ORDER BY updated_at DESC, id DESC LIMIT 12",
			$user_id
		) );
		$prefs = self::get_user_food_preferences( $user_id );
		$suggestions = self::build_recipe_suggestions( $pantry_rows, $prefs, $refresh_token );

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
		$manual_items = self::get_manual_grocery_gap_items( $user_id );
		$gaps = self::build_grocery_gap( $pantry_rows, $prefs, $manual_items );

		return new \WP_REST_Response( $gaps );
	}

	public static function add_grocery_gap_items( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) ) {
			$items = [
				[
					'item_name' => $req->get_param( 'item_name' ),
					'quantity'  => $req->get_param( 'quantity' ),
					'unit'      => $req->get_param( 'unit' ),
					'notes'     => $req->get_param( 'notes' ),
				],
			];
		}

		$current_items = self::get_manual_grocery_gap_items( $user_id );
		$items_by_key = [];
		$results = [];
		$created_count = 0;
		$merged_count = 0;

		foreach ( $current_items as $item ) {
			$key = self::normalise_food_name( (string) ( $item['item_name'] ?? '' ) );
			if ( '' === $key ) {
				continue;
			}

			$items_by_key[ $key ] = $item;
		}

		foreach ( $items as $item ) {
			$payload = self::sanitise_grocery_gap_payload( (array) $item );
			$key = self::normalise_food_name( (string) $payload['item_name'] );

			if ( '' === $key ) {
				continue;
			}

			if ( isset( $items_by_key[ $key ] ) ) {
				$items_by_key[ $key ] = self::merge_grocery_gap_item_values( $items_by_key[ $key ], $payload );
				$merged_count++;
				$results[] = [
					'created' => false,
					'merged'  => true,
					'item'    => $items_by_key[ $key ],
				];
				continue;
			}

			$items_by_key[ $key ] = $payload;
			$created_count++;
			$results[] = [
				'created' => true,
				'merged'  => false,
				'item'    => $payload,
			];
		}

		if ( empty( $results ) ) {
			return new \WP_REST_Response( [ 'message' => 'No valid grocery gap items were provided.' ], 400 );
		}

		self::save_manual_grocery_gap_items( $user_id, array_values( $items_by_key ) );

		return new \WP_REST_Response( [
			'items'         => $results,
			'created_count' => $created_count,
			'merged_count'  => $merged_count,
		] );
	}

	public static function delete_grocery_gap_items( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) ) {
			return new \WP_REST_Response( [ 'message' => 'Items array is required.' ], 400 );
		}

		$keys_to_remove = [];
		foreach ( $items as $item ) {
			$value = is_array( $item ) ? ( $item['item_name'] ?? '' ) : $item;
			$key = self::normalise_food_name( sanitize_text_field( (string) $value ) );
			if ( '' !== $key ) {
				$keys_to_remove[ $key ] = true;
			}
		}

		if ( empty( $keys_to_remove ) ) {
			return new \WP_REST_Response( [ 'message' => 'No valid grocery gap items were provided.' ], 400 );
		}

		$current_items = self::get_manual_grocery_gap_items( $user_id );
		$remaining_items = [];
		$deleted_count = 0;

		foreach ( $current_items as $item ) {
			$key = self::normalise_food_name( (string) ( $item['item_name'] ?? '' ) );
			if ( '' !== $key && isset( $keys_to_remove[ $key ] ) ) {
				$deleted_count++;
				continue;
			}

			$remaining_items[] = $item;
		}

		self::save_manual_grocery_gap_items( $user_id, $remaining_items );

		return new \WP_REST_Response( [
			'deleted'       => true,
			'deleted_count' => $deleted_count,
		] );
	}

	public static function search_foods( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$query   = trim( sanitize_text_field( (string) ( $req->get_param( 'q' ) ?: '' ) ) );

		if ( '' === $query ) {
			return new \WP_REST_Response( [] );
		}

		$like = '%' . $wpdb->esc_like( $query ) . '%';

		$saved_foods = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, canonical_name, brand, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, 'saved_food' AS match_type
			 FROM {$p}fit_foods
			 WHERE user_id = %d AND active = 1 AND (canonical_name LIKE %s OR brand LIKE %s)
			 ORDER BY CASE WHEN canonical_name LIKE %s THEN 0 ELSE 1 END, updated_at DESC
			 LIMIT 8",
			$user_id,
			$like,
			$like,
			$like
		) );

		$recent_items = $wpdb->get_results( $wpdb->prepare(
			"SELECT 0 AS id, mi.food_name AS canonical_name, '' AS brand, mi.serving_unit AS serving_size,
				ROUND(AVG(mi.calories)) AS calories,
				ROUND(AVG(mi.protein_g), 2) AS protein_g,
				ROUND(AVG(mi.carbs_g), 2) AS carbs_g,
				ROUND(AVG(mi.fat_g), 2) AS fat_g,
				ROUND(AVG(COALESCE(mi.fiber_g, 0)), 2) AS fiber_g,
				ROUND(AVG(COALESCE(mi.sugar_g, 0)), 2) AS sugar_g,
				ROUND(AVG(COALESCE(mi.sodium_mg, 0)), 2) AS sodium_mg,
				MAX(mi.micros_json) AS micros_json,
				'recent_item' AS match_type
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d AND mi.food_name LIKE %s
			 GROUP BY mi.food_name, mi.serving_unit
			 ORDER BY MAX(m.meal_datetime) DESC
			 LIMIT 8",
			$user_id,
			$like
		) );

		$merged = [];
		$seen = [];
		foreach ( array_merge( $saved_foods ?: [], $recent_items ?: [] ) as $row ) {
			$key = strtolower( trim( (string) $row->canonical_name ) . '|' . trim( (string) $row->brand ) . '|' . trim( (string) $row->serving_size ) );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$merged[] = [
				'id'           => (int) $row->id,
				'canonical_name'=> (string) $row->canonical_name,
				'brand'        => (string) $row->brand,
				'serving_size' => (string) $row->serving_size,
				'calories'     => (int) round( (float) $row->calories ),
				'protein_g'    => round( (float) $row->protein_g, 2 ),
				'carbs_g'      => round( (float) $row->carbs_g, 2 ),
				'fat_g'        => round( (float) $row->fat_g, 2 ),
				'fiber_g'      => round( (float) $row->fiber_g, 2 ),
				'sugar_g'      => round( (float) $row->sugar_g, 2 ),
				'sodium_mg'    => round( (float) $row->sodium_mg, 2 ),
				'micros'       => $row->micros_json ? self::decode_json_list( $row->micros_json ) : [],
				'match_type'   => (string) $row->match_type,
			];
		}

		return new \WP_REST_Response( array_slice( $merged, 0, 10 ) );
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

	private static function replace_meal_items( int $meal_id, array $items ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$wpdb->delete( $p . 'fit_meal_items', [ 'meal_id' => $meal_id ] );

		foreach ( $items as $item ) {
			$item = (array) $item;
			$wpdb->insert( $p . 'fit_meal_items', array_filter( [
				'meal_id'        => $meal_id,
				'food_id'        => isset( $item['food_id'] ) ? (int) $item['food_id'] : null,
				'food_name'      => sanitize_text_field( $item['food_name'] ?? '' ),
				'serving_amount' => (float) ( $item['serving_amount'] ?? 1 ),
				'serving_unit'   => sanitize_text_field( $item['serving_unit'] ?? 'serving' ),
				'calories'       => (int) ( $item['calories'] ?? 0 ),
				'protein_g'      => (float) ( $item['protein_g'] ?? 0 ),
				'carbs_g'        => (float) ( $item['carbs_g'] ?? 0 ),
				'fat_g'          => (float) ( $item['fat_g'] ?? 0 ),
				'fiber_g'        => isset( $item['fiber_g'] ) ? (float) $item['fiber_g'] : null,
				'sugar_g'        => isset( $item['sugar_g'] ) ? (float) $item['sugar_g'] : null,
				'sodium_mg'      => isset( $item['sodium_mg'] ) ? (float) $item['sodium_mg'] : null,
				'micros_json'    => ! empty( $item['micros'] ) && is_array( $item['micros'] ) ? wp_json_encode( $item['micros'] ) : null,
				'source_json'    => ! empty( $item['source'] ) ? wp_json_encode( $item['source'] ) : null,
			], static fn( $value ) => null !== $value ) );
		}
	}

	private static function build_saved_meal_payload( \WP_REST_Request $req ): array {
		$user_id = get_current_user_id();
		$items = $req->get_param( 'items' );
		$items = is_array( $items ) ? array_values( array_map( static function( $item ) {
			$item = (array) $item;
			return [
				'food_id'        => isset( $item['food_id'] ) ? (int) $item['food_id'] : null,
				'food_name'      => sanitize_text_field( $item['food_name'] ?? '' ),
				'serving_amount' => (float) ( $item['serving_amount'] ?? 1 ),
				'serving_unit'   => sanitize_text_field( $item['serving_unit'] ?? 'serving' ),
				'calories'       => (int) ( $item['calories'] ?? 0 ),
				'protein_g'      => (float) ( $item['protein_g'] ?? 0 ),
				'carbs_g'        => (float) ( $item['carbs_g'] ?? 0 ),
				'fat_g'          => (float) ( $item['fat_g'] ?? 0 ),
				'fiber_g'        => isset( $item['fiber_g'] ) ? (float) $item['fiber_g'] : null,
				'sugar_g'        => isset( $item['sugar_g'] ) ? (float) $item['sugar_g'] : null,
				'sodium_mg'      => isset( $item['sodium_mg'] ) ? (float) $item['sodium_mg'] : null,
				'micros'         => ! empty( $item['micros'] ) && is_array( $item['micros'] ) ? array_values( $item['micros'] ) : [],
			];
		}, $items ) ) : [];
		$items = self::enrich_meal_items_with_micros( $user_id, $items );

		$totals = [ 'calories' => 0, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 0.0 ];
		$micros = [];
		foreach ( $items as $item ) {
			$totals['calories'] += (int) $item['calories'];
			$totals['protein_g'] += (float) $item['protein_g'];
			$totals['carbs_g'] += (float) $item['carbs_g'];
			$totals['fat_g'] += (float) $item['fat_g'];
			$micros = self::merge_micros( $micros, (array) ( $item['micros'] ?? [] ) );
		}

		return [
			'name'      => sanitize_text_field( $req->get_param( 'name' ) ?: 'Saved meal' ),
			'meal_type' => sanitize_text_field( $req->get_param( 'meal_type' ) ?: 'lunch' ),
			'items'     => $items,
			'calories'  => $totals['calories'],
			'protein_g' => round( $totals['protein_g'], 2 ),
			'carbs_g'   => round( $totals['carbs_g'], 2 ),
			'fat_g'     => round( $totals['fat_g'], 2 ),
			'micros'    => array_values( $micros ),
		];
	}

	private static function build_saved_food_payload( \WP_REST_Request $req ): array {
		$label = $req->get_param( 'label' );
		$label = is_array( $label ) ? $label : [];
		$micros = $req->get_param( 'micros' );
		$micros = is_array( $micros ) ? array_values( $micros ) : [];

		return [
			'canonical_name' => sanitize_text_field( (string) ( $req->get_param( 'canonical_name' ) ?: $req->get_param( 'food_name' ) ?: 'Saved food' ) ),
			'brand'          => sanitize_text_field( (string) ( $req->get_param( 'brand' ) ?: '' ) ) ?: null,
			'serving_size'   => sanitize_text_field( (string) ( $req->get_param( 'serving_size' ) ?: '1 serving' ) ),
			'serving_grams'  => $req->get_param( 'serving_grams' ) !== null ? (float) $req->get_param( 'serving_grams' ) : null,
			'calories'       => (int) ( $req->get_param( 'calories' ) ?: 0 ),
			'protein_g'      => round( (float) ( $req->get_param( 'protein_g' ) ?: 0 ), 2 ),
			'carbs_g'        => round( (float) ( $req->get_param( 'carbs_g' ) ?: 0 ), 2 ),
			'fat_g'          => round( (float) ( $req->get_param( 'fat_g' ) ?: 0 ), 2 ),
			'fiber_g'        => $req->get_param( 'fiber_g' ) !== null ? round( (float) $req->get_param( 'fiber_g' ), 2 ) : null,
			'sugar_g'        => $req->get_param( 'sugar_g' ) !== null ? round( (float) $req->get_param( 'sugar_g' ), 2 ) : null,
			'sodium_mg'      => $req->get_param( 'sodium_mg' ) !== null ? round( (float) $req->get_param( 'sodium_mg' ), 2 ) : null,
			'micros_json'    => ! empty( $micros ) ? wp_json_encode( $micros ) : null,
			'source'         => sanitize_text_field( (string) ( $req->get_param( 'source' ) ?: 'manual' ) ),
			'label_json'     => ! empty( $label ) ? wp_json_encode( $label ) : null,
		];
	}

	private static function enrich_meal_items_with_micros( int $user_id, array $items ): array {
		return array_values( array_map( static function( $item ) use ( $user_id ) {
			$item = (array) $item;
			$micros = ! empty( $item['micros'] ) && is_array( $item['micros'] ) ? array_values( $item['micros'] ) : [];
			if ( ! empty( $micros ) ) {
				$item['micros'] = $micros;
				return $item;
			}

			$serving_amount = max( 0.1, (float) ( $item['serving_amount'] ?? 1 ) );
			$serving_unit = sanitize_text_field( (string) ( $item['serving_unit'] ?? 'serving' ) );
			$food_name = sanitize_text_field( (string) ( $item['food_name'] ?? '' ) );
			$estimated_micros = self::estimate_food_micros(
				$user_id,
				self::build_food_analysis_text( $food_name, $serving_amount, $serving_unit )
			);

			$item['micros'] = $estimated_micros;
			return $item;
		}, $items ) );
	}

	private static function enrich_saved_food_payload_with_micros( int $user_id, array $payload ): array {
		if ( ! empty( $payload['micros_json'] ) ) {
			return $payload;
		}

		$micros = self::estimate_food_micros(
			$user_id,
			self::build_food_analysis_text(
				(string) ( $payload['canonical_name'] ?? '' ),
				1,
				(string) ( $payload['serving_size'] ?? 'serving' )
			)
		);

		if ( empty( $micros ) ) {
			return $payload;
		}

		$payload['micros_json'] = wp_json_encode( $micros );
		return $payload;
	}

	private static function backfill_missing_meal_item_micros_for_date( int $user_id, string $date ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT mi.id, mi.food_id, mi.food_name, mi.serving_amount, mi.serving_unit, mi.micros_json,
			        f.canonical_name, f.serving_size, f.micros_json AS food_micros_json
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 LEFT JOIN {$p}fit_foods f ON f.id = mi.food_id
			 WHERE m.user_id = %d
			   AND DATE(m.meal_datetime) = %s
			   AND m.confirmed = 1
			   AND (mi.micros_json IS NULL OR mi.micros_json = '' OR mi.micros_json = '[]')",
			$user_id,
			$date
		) );

		foreach ( $rows as $row ) {
			$base_food_micros = self::decode_json_list( $row->food_micros_json );
			if ( ! empty( $base_food_micros ) ) {
				$scaled_micros = self::scale_micros( $base_food_micros, max( 0.1, (float) ( $row->serving_amount ?? 1 ) ) );
				if ( ! empty( $scaled_micros ) ) {
					$wpdb->update(
						$p . 'fit_meal_items',
						[ 'micros_json' => wp_json_encode( $scaled_micros ) ],
						[ 'id' => (int) $row->id ]
					);
					continue;
				}
			}

			$estimated_micros = self::estimate_food_micros(
				$user_id,
				self::build_food_analysis_text(
					(string) ( $row->food_name ?: $row->canonical_name ?: '' ),
					(float) ( $row->serving_amount ?? 1 ),
					(string) ( $row->serving_unit ?: $row->serving_size ?: 'serving' )
				)
			);

			if ( empty( $estimated_micros ) ) {
				continue;
			}

			$wpdb->update(
				$p . 'fit_meal_items',
				[ 'micros_json' => wp_json_encode( $estimated_micros ) ],
				[ 'id' => (int) $row->id ]
			);

			if ( ! empty( $row->food_id ) && empty( $base_food_micros ) ) {
				$wpdb->update(
					$p . 'fit_foods',
					[ 'micros_json' => wp_json_encode( self::scale_micros( $estimated_micros, 1 / max( 0.1, (float) ( $row->serving_amount ?? 1 ) ) ) ) ],
					[ 'id' => (int) $row->food_id ]
				);
			}
		}
	}

	private static function estimate_food_micros( int $user_id, string $food_text ): array {
		$food_text = trim( $food_text );
		if ( '' === $food_text ) {
			return [];
		}

		$analysis = AiService::analyse_food_text( $user_id, $food_text );
		if ( is_wp_error( $analysis ) ) {
			return [];
		}

		return is_array( $analysis['micros'] ?? null ) ? array_values( $analysis['micros'] ) : [];
	}

	private static function build_food_analysis_text( string $food_name, float $serving_amount, string $serving_unit ): string {
		$food_name = sanitize_text_field( $food_name );
		if ( '' === $food_name ) {
			return '';
		}

		$serving_amount = max( 0.1, $serving_amount );
		$serving_unit = sanitize_text_field( $serving_unit ?: 'serving' );

		return trim( sprintf( '%s %s %s', rtrim( rtrim( (string) $serving_amount, '0' ), '.' ), $serving_unit, $food_name ) );
	}

	private static function scale_micros( array $micros, float $multiplier ): array {
		return array_values( array_filter( array_map( static function( $micro ) use ( $multiplier ) {
			if ( ! is_array( $micro ) || ! isset( $micro['amount'] ) ) {
				return null;
			}

			return [
				'key'    => sanitize_key( (string) ( $micro['key'] ?? $micro['label'] ?? '' ) ),
				'label'  => sanitize_text_field( (string) ( $micro['label'] ?? $micro['key'] ?? '' ) ),
				'amount' => round( (float) $micro['amount'] * $multiplier, 2 ),
				'unit'   => sanitize_text_field( (string) ( $micro['unit'] ?? '' ) ),
			];
		}, $micros ) ) );
	}

	private static function merge_micros( array $carry, array $micros ): array {
		foreach ( $micros as $micro ) {
			if ( ! is_array( $micro ) ) {
				continue;
			}

			$key = sanitize_key( (string) ( $micro['key'] ?? $micro['label'] ?? '' ) );
			if ( '' === $key ) {
				continue;
			}

			if ( ! isset( $carry[ $key ] ) ) {
				$carry[ $key ] = [
					'key'    => $key,
					'label'  => sanitize_text_field( (string) ( $micro['label'] ?? $micro['key'] ?? '' ) ),
					'amount' => 0.0,
					'unit'   => sanitize_text_field( (string) ( $micro['unit'] ?? '' ) ),
				];
			}

			$carry[ $key ]['amount'] += (float) ( $micro['amount'] ?? 0 );
		}

		return array_map( static function( array $micro ): array {
			$micro['amount'] = round( (float) $micro['amount'], 2 );
			return $micro;
		}, $carry );
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

	private static function build_recipe_suggestions( array $pantry_rows, array $prefs, string $refresh_token = '' ): array {
		$pantry = array_values( array_filter( array_map( static fn( $row ) => self::normalise_food_name( (string) $row->item_name ), $pantry_rows ) ) );
		$preferred_foods = array_values( array_filter( array_map( 'trim', explode( ',', strtolower( trim( (string) ( $prefs['food_preferences']['preferred_foods'] ?? '' ) ) ) ) ) ) );
		$dislikes = array_map( 'strtolower', array_map( 'trim', $prefs['food_dislikes'] ?? [] ) );
		$token = $refresh_token ?: gmdate( 'Y-m-d' );
		$pools = self::build_recipe_ingredient_pools( $pantry, $token );

		$library = get_option( 'jf_recipe_library', [] );
		$suggestions = [];
		foreach ( [ 'breakfast', 'lunch', 'dinner', 'snack' ] as $meal_type ) {
			$suggestions = array_merge( $suggestions, self::generate_recipe_batch_for_meal_type( $meal_type, $pools, 20 ) );
		}

		if ( is_array( $library ) ) {
			foreach ( $library as $recipe ) {
				if ( empty( $recipe['recipe_name'] ) ) {
					continue;
				}

				$suggestions[] = [
					'meal_type'            => sanitize_key( (string) ( $recipe['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
					'recipe_name'          => sanitize_text_field( (string) $recipe['recipe_name'] ),
					'ingredients'          => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ),
					'instructions'         => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['instructions'] ?? [] ) ) ) ),
					'estimated_calories'   => (int) ( $recipe['estimated_calories'] ?? 0 ),
					'estimated_protein_g'  => (float) ( $recipe['estimated_protein_g'] ?? 0 ),
					'estimated_carbs_g'    => (float) ( $recipe['estimated_carbs_g'] ?? 0 ),
					'estimated_fat_g'      => (float) ( $recipe['estimated_fat_g'] ?? 0 ),
					'why_this_works'       => sanitize_text_field( (string) ( $recipe['why_this_works'] ?? 'Added from your recipe library.' ) ),
				];
			}
		}

		$suggestions = array_values( array_filter( $suggestions, static function( $suggestion ) use ( $dislikes ) {
			$text = strtolower( implode( ' ', $suggestion['ingredients'] ) . ' ' . $suggestion['recipe_name'] );
			foreach ( $dislikes as $dislike ) {
				if ( $dislike && str_contains( $text, $dislike ) ) {
					return false;
				}
			}
			return true;
		} ) );

		$suggestions = array_map( static function( array $suggestion ) use ( $pantry, $preferred_foods ): array {
			$ingredients = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $suggestion['ingredients'] ?? [] ) ) ) );
			$on_hand = [];
			$missing = [];

			foreach ( $ingredients as $ingredient ) {
				if ( self::pantry_has_ingredient( $pantry, $ingredient ) ) {
					$on_hand[] = $ingredient;
				} else {
					$missing[] = $ingredient;
				}
			}

			$text = strtolower( implode( ' ', $ingredients ) . ' ' . (string) ( $suggestion['recipe_name'] ?? '' ) );
			$preferred_matches = 0;
			foreach ( $preferred_foods as $preferred_food ) {
				if ( $preferred_food && str_contains( $text, strtolower( $preferred_food ) ) ) {
					$preferred_matches++;
				}
			}

			$suggestion['key'] = sanitize_title( (string) ( $suggestion['meal_type'] ?? 'meal' ) . '-' . (string) ( $suggestion['recipe_name'] ?? '' ) );
			$suggestion['ingredients'] = $ingredients;
			$suggestion['on_hand_ingredients'] = array_values( array_unique( $on_hand ) );
			$suggestion['missing_ingredients'] = array_values( array_unique( $missing ) );
			$suggestion['pantry_match_count'] = count( $suggestion['on_hand_ingredients'] );
			$suggestion['pantry_missing_count'] = count( $suggestion['missing_ingredients'] );
			$suggestion['preferred_match_count'] = $preferred_matches;
			return $suggestion;
		}, $suggestions );

		usort( $suggestions, static function( array $left, array $right ) use ( $token ): int {
			$meal_cmp = strcmp( (string) ( $left['meal_type'] ?? '' ), (string) ( $right['meal_type'] ?? '' ) );
			if ( 0 !== $meal_cmp ) {
				return $meal_cmp;
			}

			$preferred_cmp = ( $right['preferred_match_count'] <=> $left['preferred_match_count'] );
			if ( 0 !== $preferred_cmp ) {
				return $preferred_cmp;
			}

			$score_cmp = ( $right['pantry_match_count'] <=> $left['pantry_match_count'] );
			if ( 0 !== $score_cmp ) {
				return $score_cmp;
			}

			$left_hash = md5( $token . '|' . (string) ( $left['recipe_name'] ?? '' ) );
			$right_hash = md5( $token . '|' . (string) ( $right['recipe_name'] ?? '' ) );
			return strcmp( $left_hash, $right_hash );
		} );

		return $suggestions;
	}

	private static function build_recipe_ingredient_pools( array $pantry, string $token ): array {
		return [
			'breakfast_proteins' => self::rank_recipe_candidates( [ 'eggs', 'egg whites', 'greek yogurt', 'cottage cheese', 'turkey sausage', 'protein powder' ], $pantry, $token . '|breakfast_protein' ),
			'lunch_proteins'     => self::rank_recipe_candidates( [ 'chicken', 'ground turkey', 'tuna', 'tofu', 'shrimp', 'lean beef' ], $pantry, $token . '|lunch_protein' ),
			'dinner_proteins'    => self::rank_recipe_candidates( [ 'salmon', 'chicken thighs', 'ground turkey', 'steak', 'tofu', 'pork tenderloin' ], $pantry, $token . '|dinner_protein' ),
			'snack_proteins'     => self::rank_recipe_candidates( [ 'greek yogurt', 'cottage cheese', 'turkey slices', 'protein powder', 'string cheese', 'hard boiled eggs' ], $pantry, $token . '|snack_protein' ),
			'breakfast_carbs'    => self::rank_recipe_candidates( [ 'oats', 'toast', 'bagel thin', 'granola', 'berries', 'banana' ], $pantry, $token . '|breakfast_carb' ),
			'lunch_carbs'        => self::rank_recipe_candidates( [ 'rice', 'quinoa', 'wrap', 'pasta', 'potatoes', 'sourdough' ], $pantry, $token . '|lunch_carb' ),
			'dinner_carbs'       => self::rank_recipe_candidates( [ 'potatoes', 'rice', 'pasta', 'couscous', 'quinoa', 'beans' ], $pantry, $token . '|dinner_carb' ),
			'snack_carbs'        => self::rank_recipe_candidates( [ 'apple', 'banana', 'berries', 'rice cakes', 'trail mix', 'crackers' ], $pantry, $token . '|snack_carb' ),
			'vegetables'         => self::rank_recipe_candidates( [ 'spinach', 'broccoli', 'peppers', 'mixed vegetables', 'kale', 'mushrooms', 'zucchini', 'cucumber' ], $pantry, $token . '|veg' ),
			'flavors'            => self::rank_recipe_candidates( [ 'olive oil', 'hot sauce', 'pesto', 'salsa', 'soy sauce', 'lemon', 'honey mustard', 'garlic yogurt sauce' ], $pantry, $token . '|flavor' ),
			'toppers'            => self::rank_recipe_candidates( [ 'peanut butter', 'chia seeds', 'almonds', 'walnuts', 'parmesan', 'feta' ], $pantry, $token . '|topper' ),
		];
	}

	private static function generate_recipe_batch_for_meal_type( string $meal_type, array $pools, int $count ): array {
		$recipes = [];
		for ( $index = 0; $index < $count; $index++ ) {
			$recipes[] = self::build_recipe_variant( $meal_type, $pools, $index );
		}

		return array_values( array_filter( $recipes ) );
	}

	private static function build_recipe_variant( string $meal_type, array $pools, int $index ): array {
		$variant = intdiv( $index, 5 );
		$pattern = $index % 5;

		$breakfast_protein = self::pool_item( $pools['breakfast_proteins'] ?? [], $variant, 'eggs' );
		$breakfast_carb = self::pool_item( $pools['breakfast_carbs'] ?? [], $variant + $pattern, 'oats' );
		$lunch_protein = self::pool_item( $pools['lunch_proteins'] ?? [], $variant + $pattern, 'chicken' );
		$lunch_carb = self::pool_item( $pools['lunch_carbs'] ?? [], $variant, 'rice' );
		$dinner_protein = self::pool_item( $pools['dinner_proteins'] ?? [], $variant + $pattern, 'salmon' );
		$dinner_carb = self::pool_item( $pools['dinner_carbs'] ?? [], $variant, 'potatoes' );
		$snack_protein = self::pool_item( $pools['snack_proteins'] ?? [], $variant + $pattern, 'greek yogurt' );
		$snack_carb = self::pool_item( $pools['snack_carbs'] ?? [], $variant, 'apple' );
		$veg_a = self::pool_item( $pools['vegetables'] ?? [], $variant + $pattern, 'spinach' );
		$veg_b = self::pool_item( $pools['vegetables'] ?? [], $variant + $pattern + 1, 'broccoli' );
		$flavor = self::pool_item( $pools['flavors'] ?? [], $variant + $pattern, 'olive oil' );
		$topper = self::pool_item( $pools['toppers'] ?? [], $variant + $pattern, 'chia seeds' );

		switch ( $meal_type ) {
			case 'breakfast':
				return match ( $pattern ) {
					0 => self::recipe_payload( 'breakfast', ucfirst( $breakfast_protein ) . ' ' . ucfirst( $breakfast_carb ) . ' Bowl', [ $breakfast_protein, $breakfast_carb, $topper, 'berries' ], [ 'Cook the base if needed.', 'Fold in the protein source.', 'Finish with berries and the topper.' ], 430, 31, 39, 14, 'Fast breakfast with enough protein to keep the morning stable.' ),
					1 => self::recipe_payload( 'breakfast', ucfirst( $breakfast_protein ) . ' Breakfast Wrap', [ $breakfast_protein, 'wrap', $veg_a, $flavor ], [ 'Cook the protein and vegetables.', 'Warm the wrap.', 'Roll everything together with the sauce.' ], 470, 34, 32, 18, 'Portable and easy to repeat on busy mornings.' ),
					2 => self::recipe_payload( 'breakfast', ucfirst( $breakfast_carb ) . ' Parfait Stack', [ 'greek yogurt', $breakfast_carb, 'berries', $topper ], [ 'Layer the yogurt and carb base.', 'Add fruit between layers.', 'Top with crunch before serving.' ], 410, 29, 42, 11, 'Sweet-leaning breakfast without losing protein.' ),
					3 => self::recipe_payload( 'breakfast', ucfirst( $veg_a ) . ' Scramble Plate', [ $breakfast_protein, $veg_a, 'toast', $flavor ], [ 'Cook the vegetables first.', 'Scramble in the protein.', 'Serve with toast and flavor on the side.' ], 450, 30, 28, 19, 'A savory breakfast that still lands clean on macros.' ),
					default => self::recipe_payload( 'breakfast', ucfirst( $breakfast_protein ) . ' Recovery Toast', [ $breakfast_protein, 'toast', $veg_b, $topper ], [ 'Toast the bread.', 'Pile on the protein and vegetables.', 'Add the topper to finish.' ], 440, 32, 30, 16, 'Useful when you want breakfast to feel more like a meal.' ),
				};
			case 'lunch':
				return match ( $pattern ) {
					0 => self::recipe_payload( 'lunch', ucfirst( $lunch_protein ) . ' Grain Bowl', [ $lunch_protein, $lunch_carb, $veg_a, $flavor ], [ 'Cook the protein until browned.', 'Prep the grain base.', 'Combine with vegetables and finish with the sauce.' ], 590, 42, 49, 17, 'Balanced lunch with enough volume to carry the afternoon.' ),
					1 => self::recipe_payload( 'lunch', ucfirst( $lunch_protein ) . ' Wrap Box', [ $lunch_protein, 'wrap', $veg_b, $flavor ], [ 'Cook or slice the protein.', 'Build the wrap with vegetables.', 'Pack the extra vegetables on the side.' ], 520, 38, 34, 16, 'Easy lunch prep that works hot or cold.' ),
					2 => self::recipe_payload( 'lunch', ucfirst( $lunch_carb ) . ' Protein Skillet', [ $lunch_protein, $lunch_carb, $veg_a, $veg_b ], [ 'Brown the protein in one pan.', 'Add the carb and vegetables.', 'Cook until everything is hot and coated.' ], 610, 41, 52, 18, 'One-pan lunch with enough carbs for training days.' ),
					3 => self::recipe_payload( 'lunch', ucfirst( $lunch_protein ) . ' Chopped Salad Bowl', [ $lunch_protein, $veg_a, $veg_b, $topper, $flavor ], [ 'Cook the protein and let it rest.', 'Chop the vegetables finely.', 'Toss with the topper and dressing.' ], 480, 39, 22, 19, 'Lighter lunch option that still keeps protein high.' ),
					default => self::recipe_payload( 'lunch', ucfirst( $lunch_protein ) . ' Sandwich Plate', [ $lunch_protein, 'sourdough', $veg_a, $flavor ], [ 'Cook or slice the protein.', 'Toast the bread if you want more texture.', 'Build the sandwich and serve with extra vegetables.' ], 530, 36, 41, 15, 'Simple lunch build that does not require much prep.' ),
				};
			case 'dinner':
				return match ( $pattern ) {
					0 => self::recipe_payload( 'dinner', ucfirst( $dinner_protein ) . ' Sheet Pan Dinner', [ $dinner_protein, $dinner_carb, $veg_a, $flavor ], [ 'Spread everything on a sheet pan.', 'Roast until the vegetables color up.', 'Serve with the pan juices or sauce.' ], 640, 44, 46, 22, 'Dinner that feels substantial without getting complicated.' ),
					1 => self::recipe_payload( 'dinner', ucfirst( $dinner_protein ) . ' Pasta Toss', [ $dinner_protein, 'pasta', $veg_b, $flavor ], [ 'Cook the pasta first.', 'Sear the protein and vegetables.', 'Toss everything together with the sauce.' ], 670, 43, 57, 19, 'High-satisfaction dinner with a predictable macro structure.' ),
					2 => self::recipe_payload( 'dinner', ucfirst( $dinner_protein ) . ' Roasted Bowl', [ $dinner_protein, $dinner_carb, $veg_a, $veg_b ], [ 'Roast the vegetables and carb base.', 'Cook the protein in parallel.', 'Stack everything into a bowl and finish hot.' ], 620, 45, 43, 20, 'Good default dinner when you want leftovers and simplicity.' ),
					3 => self::recipe_payload( 'dinner', ucfirst( $dinner_protein ) . ' Stir-Fry Plate', [ $dinner_protein, $dinner_carb, $veg_b, 'soy sauce' ], [ 'Cook the protein in a hot pan.', 'Add the vegetables and sauce.', 'Serve over the carb base.' ], 600, 40, 50, 16, 'Fast dinner build when you want more volume than cleanup.' ),
					default => self::recipe_payload( 'dinner', ucfirst( $dinner_protein ) . ' Loaded Potato Plate', [ $dinner_protein, 'potatoes', $veg_a, $topper ], [ 'Cook the potatoes until crisp outside.', 'Prep the protein while they cook.', 'Finish with vegetables and the topper.' ], 630, 42, 48, 18, 'Dinner that reads comforting without blowing the day up.' ),
				};
			case 'snack':
				return match ( $pattern ) {
					0 => self::recipe_payload( 'snack', ucfirst( $snack_protein ) . ' Crunch Cup', [ $snack_protein, $snack_carb, $topper ], [ 'Portion the protein into a bowl or cup.', 'Add the carb for texture or sweetness.', 'Top and eat immediately.' ], 280, 21, 22, 9, 'Quick snack with enough protein to matter.' ),
					1 => self::recipe_payload( 'snack', ucfirst( $snack_protein ) . ' Fruit Plate', [ $snack_protein, $snack_carb, 'berries' ], [ 'Slice the fruit if needed.', 'Pair it with the protein source.', 'Keep it simple and portable.' ], 240, 19, 20, 7, 'Easy snack when calories need to stay tight.' ),
					2 => self::recipe_payload( 'snack', ucfirst( $snack_protein ) . ' Rice Cake Stack', [ $snack_protein, 'rice cakes', $topper ], [ 'Lay out the rice cakes.', 'Add the protein layer.', 'Finish with the topper for texture.' ], 260, 20, 24, 8, 'High-compliance snack that comes together in under two minutes.' ),
					3 => self::recipe_payload( 'snack', ucfirst( $snack_carb ) . ' Recovery Shake Side', [ 'protein powder', $snack_carb, 'milk' ], [ 'Blend the shake ingredients.', 'Pair with the side item if you need more carbs.', 'Use this around training or when protein is behind.' ], 300, 27, 25, 6, 'Useful when you need a snack to fix the day quickly.' ),
					default => self::recipe_payload( 'snack', ucfirst( $snack_protein ) . ' Grab-and-Go Box', [ $snack_protein, $snack_carb, $veg_a ], [ 'Pack the protein, produce, and crunch item together.', 'Keep the box ready in the fridge.', 'Use it when hunger shows up between meals.' ], 250, 18, 19, 8, 'Good bridge snack when dinner is still a while away.' ),
				};
			default:
				return [];
		}
	}

	private static function recipe_payload( string $meal_type, string $recipe_name, array $ingredients, array $instructions, int $estimated_calories, float $estimated_protein_g, float $estimated_carbs_g, float $estimated_fat_g, string $why_this_works ): array {
		return [
			'meal_type'           => $meal_type,
			'recipe_name'         => $recipe_name,
			'ingredients'         => $ingredients,
			'instructions'        => $instructions,
			'estimated_calories'  => $estimated_calories,
			'estimated_protein_g' => $estimated_protein_g,
			'estimated_carbs_g'   => $estimated_carbs_g,
			'estimated_fat_g'     => $estimated_fat_g,
			'why_this_works'      => $why_this_works,
		];
	}

	private static function pool_item( array $pool, int $index, string $fallback ): string {
		if ( empty( $pool ) ) {
			return $fallback;
		}

		return (string) $pool[ $index % count( $pool ) ];
	}

	private static function build_grocery_gap( array $pantry_rows, array $prefs, array $manual_items = [] ): array {
		$pantry = array_map( static fn( $row ) => self::normalise_food_name( (string) $row->item_name ), $pantry_rows );
		$preferred_foods = array_filter( array_map( 'trim', explode( ',', (string) ( $prefs['food_preferences']['preferred_foods'] ?? '' ) ) ) );
		$common_meals = array_filter( array_map( 'trim', [
			(string) ( $prefs['common_meals']['breakfasts'] ?? '' ),
			(string) ( $prefs['common_meals']['lunches'] ?? '' ),
		] ) );

		$staples = array_unique( array_filter( array_merge( [ 'chicken', 'eggs', 'rice', 'oats', 'berries', 'greek yogurt', 'spinach' ], $preferred_foods ) ) );
		$missing = array_values( array_filter( $staples, fn( $item ) => ! self::pantry_has_ingredient( $pantry, (string) $item ) ) );
		$manual_missing = array_values( array_filter( self::merge_grocery_gap_items( $manual_items ), static function( array $item ) use ( $pantry ): bool {
			return ! self::pantry_has_ingredient( $pantry, (string) ( $item['item_name'] ?? '' ) );
		} ) );

		return [
			'missing_items' => array_slice( $missing, 0, 8 ),
			'manual_items'  => $manual_missing,
			'pantry_count'  => count( $pantry ),
			'context'       => [
				'preferred_foods' => array_slice( $preferred_foods, 0, 5 ),
				'common_meals'    => array_slice( $common_meals, 0, 4 ),
			],
		];
	}

	private static function normalise_food_name( string $value ): string {
		$value = strtolower( trim( $value ) );
		$value = preg_replace( '/[^a-z0-9]+/', ' ', $value ) ?: '';
		return trim( $value );
	}

	private static function sanitise_pantry_payload( array $input ): array {
		$item_name = sanitize_text_field( (string) ( $input['item_name'] ?? '' ) );
		$unit = sanitize_text_field( (string) ( $input['unit'] ?? '' ) );
		$expires_on = sanitize_text_field( (string) ( $input['expires_on'] ?? '' ) );
		$quantity = null;

		if ( array_key_exists( 'quantity', $input ) && '' !== (string) $input['quantity'] && null !== $input['quantity'] ) {
			$quantity = round( (float) $input['quantity'], 2 );
		}

		return [
			'item_name'  => trim( $item_name ),
			'quantity'   => $quantity,
			'unit'       => '' !== trim( $unit ) ? trim( $unit ) : null,
			'expires_on' => '' !== trim( $expires_on ) ? trim( $expires_on ) : null,
		];
	}

	private static function sanitise_grocery_gap_payload( array $input ): array {
		$payload = self::sanitise_pantry_payload( $input );
		$notes = sanitize_text_field( (string) ( $input['notes'] ?? '' ) );

		$payload['notes'] = '' !== trim( $notes ) ? trim( $notes ) : null;

		return $payload;
	}

	private static function upsert_pantry_item( int $user_id, array $payload, int $existing_item_id = 0 ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_pantry_items';

		$matching_item = self::find_matching_pantry_item( $user_id, (string) $payload['item_name'], $existing_item_id );

		if ( $matching_item ) {
			$merged_payload = self::merge_pantry_values( (array) $matching_item, $payload );
			$wpdb->update( $table, $merged_payload, [ 'id' => (int) $matching_item['id'] ] );

			if ( $existing_item_id > 0 ) {
				$wpdb->delete( $table, [ 'id' => $existing_item_id ] );
			}

			$item = self::get_pantry_item_by_id( (int) $matching_item['id'] );

			return [
				'id'         => (int) $matching_item['id'],
				'created'    => false,
				'updated'    => true,
				'merged'     => true,
				'deleted_id' => $existing_item_id > 0 ? $existing_item_id : null,
				'item'       => $item,
			];
		}

		if ( $existing_item_id > 0 ) {
			$wpdb->update( $table, $payload, [ 'id' => $existing_item_id ] );
			$item = self::get_pantry_item_by_id( $existing_item_id );

			return [
				'id'      => $existing_item_id,
				'created' => false,
				'updated' => true,
				'merged'  => false,
				'item'    => $item,
			];
		}

		$wpdb->insert( $table, array_filter( [
			'user_id'    => $user_id,
			'item_name'  => $payload['item_name'],
			'quantity'   => $payload['quantity'],
			'unit'       => $payload['unit'],
			'expires_on' => $payload['expires_on'],
		], static fn( $value ) => null !== $value ) );

		$item_id = (int) $wpdb->insert_id;

		return [
			'id'      => $item_id,
			'created' => true,
			'updated' => false,
			'merged'  => false,
			'item'    => self::get_pantry_item_by_id( $item_id ),
		];
	}

	private static function find_matching_pantry_item( int $user_id, string $item_name, int $exclude_id = 0 ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_pantry_items';
		$normalised_name = self::normalise_food_name( $item_name );

		if ( '' === $normalised_name ) {
			return null;
		}

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$table} WHERE user_id = %d ORDER BY updated_at DESC, id DESC",
			$user_id
		), ARRAY_A );

		foreach ( $rows as $row ) {
			if ( $exclude_id > 0 && (int) $row['id'] === $exclude_id ) {
				continue;
			}

			if ( self::normalise_food_name( (string) $row['item_name'] ) === $normalised_name ) {
				return $row;
			}
		}

		return null;
	}

	private static function merge_pantry_values( array $existing, array $incoming ): array {
		$existing_unit = isset( $existing['unit'] ) ? trim( (string) $existing['unit'] ) : '';
		$incoming_unit = isset( $incoming['unit'] ) && null !== $incoming['unit'] ? trim( (string) $incoming['unit'] ) : '';
		$existing_quantity = isset( $existing['quantity'] ) && '' !== (string) $existing['quantity'] ? (float) $existing['quantity'] : null;
		$incoming_quantity = isset( $incoming['quantity'] ) && null !== $incoming['quantity'] ? (float) $incoming['quantity'] : null;
		$unit_pair = self::resolve_pantry_units_and_quantity( $existing_quantity, $existing_unit, $incoming_quantity, $incoming_unit );

		return [
			'item_name'  => $incoming['item_name'] ?: (string) $existing['item_name'],
			'quantity'   => $unit_pair['quantity'],
			'unit'       => $unit_pair['unit'],
			'expires_on' => self::merge_pantry_expiry( $existing['expires_on'] ?? null, $incoming['expires_on'] ?? null ),
		];
	}

	private static function merge_grocery_gap_item_values( array $existing, array $incoming ): array {
		$merged = self::merge_pantry_values( $existing, $incoming );
		$merged['notes'] = ! empty( $incoming['notes'] ) ? $incoming['notes'] : ( $existing['notes'] ?? null );

		return $merged;
	}

	private static function get_manual_grocery_gap_items( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::GROCERY_GAP_ITEMS_META_KEY, true );
		$stored_items = is_array( $stored ) ? $stored : [];

		return self::merge_grocery_gap_items( $stored_items );
	}

	private static function save_manual_grocery_gap_items( int $user_id, array $items ): void {
		$items = self::merge_grocery_gap_items( $items );

		if ( empty( $items ) ) {
			delete_user_meta( $user_id, self::GROCERY_GAP_ITEMS_META_KEY );
			return;
		}

		update_user_meta( $user_id, self::GROCERY_GAP_ITEMS_META_KEY, array_values( $items ) );
	}

	private static function merge_grocery_gap_items( array $items ): array {
		$items_by_key = [];

		foreach ( $items as $item ) {
			$payload = self::sanitise_grocery_gap_payload( (array) $item );
			$key = self::normalise_food_name( (string) $payload['item_name'] );

			if ( '' === $key ) {
				continue;
			}

			if ( isset( $items_by_key[ $key ] ) ) {
				$items_by_key[ $key ] = self::merge_grocery_gap_item_values( $items_by_key[ $key ], $payload );
				continue;
			}

			$items_by_key[ $key ] = $payload;
		}

		return array_values( $items_by_key );
	}

	private static function resolve_pantry_units_and_quantity( ?float $existing_quantity, string $existing_unit, ?float $incoming_quantity, string $incoming_unit ): array {
		$normalised_existing_unit = self::normalise_food_name( $existing_unit );
		$normalised_incoming_unit = self::normalise_food_name( $incoming_unit );

		if ( null !== $existing_quantity && null !== $incoming_quantity ) {
			if ( '' === $normalised_existing_unit || '' === $normalised_incoming_unit || $normalised_existing_unit === $normalised_incoming_unit ) {
				return [
					'quantity' => round( $existing_quantity + $incoming_quantity, 2 ),
					'unit'     => '' !== $incoming_unit ? $incoming_unit : ( '' !== $existing_unit ? $existing_unit : null ),
				];
			}

			return [
				'quantity' => $incoming_quantity,
				'unit'     => '' !== $incoming_unit ? $incoming_unit : ( '' !== $existing_unit ? $existing_unit : null ),
			];
		}

		if ( null !== $incoming_quantity ) {
			return [
				'quantity' => $incoming_quantity,
				'unit'     => '' !== $incoming_unit ? $incoming_unit : ( '' !== $existing_unit ? $existing_unit : null ),
			];
		}

		if ( null !== $existing_quantity ) {
			return [
				'quantity' => $existing_quantity,
				'unit'     => '' !== $existing_unit ? $existing_unit : ( '' !== $incoming_unit ? $incoming_unit : null ),
			];
		}

		return [
			'quantity' => null,
			'unit'     => '' !== $incoming_unit ? $incoming_unit : ( '' !== $existing_unit ? $existing_unit : null ),
		];
	}

	private static function merge_pantry_expiry( ?string $existing_expiry, ?string $incoming_expiry ): ?string {
		$existing_expiry = $existing_expiry ? trim( $existing_expiry ) : '';
		$incoming_expiry = $incoming_expiry ? trim( $incoming_expiry ) : '';

		if ( '' === $existing_expiry ) {
			return '' !== $incoming_expiry ? $incoming_expiry : null;
		}

		if ( '' === $incoming_expiry ) {
			return $existing_expiry;
		}

		return strcmp( $existing_expiry, $incoming_expiry ) <= 0 ? $existing_expiry : $incoming_expiry;
	}

	private static function get_pantry_item_by_id( int $item_id ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_pantry_items';
		$item = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$table} WHERE id = %d",
			$item_id
		), ARRAY_A );

		return $item ?: null;
	}

	private static function pantry_has_ingredient( array $pantry, string $ingredient ): bool {
		$needle = self::normalise_food_name( $ingredient );
		if ( '' === $needle ) {
			return false;
		}

		foreach ( $pantry as $item ) {
			$item = self::normalise_food_name( (string) $item );
			if ( '' === $item ) {
				continue;
			}

			if ( $item === $needle || str_contains( $item, $needle ) || str_contains( $needle, $item ) ) {
				return true;
			}
		}

		return false;
	}

	private static function rank_recipe_candidates( array $candidates, array $pantry, string $token ): array {
		usort( $candidates, static function( string $left, string $right ) use ( $pantry, $token ): int {
			$left_in_pantry = self::pantry_has_ingredient( $pantry, $left );
			$right_in_pantry = self::pantry_has_ingredient( $pantry, $right );

			if ( $left_in_pantry !== $right_in_pantry ) {
				return $left_in_pantry ? -1 : 1;
			}

			return strcmp( md5( $token . '|' . $left ), md5( $token . '|' . $right ) );
		} );

		return array_values( array_unique( $candidates ) );
	}
}
