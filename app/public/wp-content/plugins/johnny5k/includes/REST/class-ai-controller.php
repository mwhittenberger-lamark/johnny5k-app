<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;
use Johnny5k\Services\BehaviorAnalyticsService;
use Johnny5k\Services\UserTime;

/**
 * Shared nutrition endpoint implementation used by NutritionController.
 *
 * POST /fit/v1/nutrition/meal       — log a meal (manual)
 * GET  /fit/v1/nutrition/meals      — get meals for a date range
 * DELETE /fit/v1/nutrition/meal/{id} — delete a meal
 * GET  /fit/v1/nutrition/summary    — daily summary for given date
 * POST /fit/v1/nutrition/pantry     — add pantry item
 * GET  /fit/v1/nutrition/pantry     — list pantry items
 */
abstract class AbstractNutritionController extends RestController {
	private const PANTRY_CATEGORY_OVERRIDES_META_KEY = 'johnny5k_pantry_category_overrides';
	private const HIDDEN_RECENT_FOOD_KEYS_META_KEY = 'johnny5k_hidden_recent_food_keys';
	private const DEFAULT_WATER_GLASSES_TARGET = 6;

	// ── POST /nutrition/meal ──────────────────────────────────────────────────

	public static function log_meal( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$meal_dt = sanitize_text_field( $req->get_param( 'meal_datetime' ) ?: UserTime::mysql( $user_id ) );
		$type    = sanitize_text_field( $req->get_param( 'meal_type' )    ?: 'lunch' );
		$source  = sanitize_text_field( $req->get_param( 'source' )       ?: 'manual' );
		$items   = $req->get_param( 'items' ); // array of item objects

		if ( ! is_array( $items ) || empty( $items ) ) {
			return self::message( 'At least one meal item is required.', 400 );
		}

		$items   = self::enrich_meal_items_with_micros( $user_id, $items );
		$existing_meal = self::consolidate_daily_meals_by_type( $user_id, $meal_dt, $type );

		if ( $existing_meal ) {
			$meal_id      = (int) $existing_meal->id;
			$merged_items = array_merge( self::get_meal_items_payload( $meal_id ), $items );

			$wpdb->update( $p . 'fit_meals', [
				'meal_datetime' => $meal_dt,
				'meal_type'     => $type,
				'source'        => $source,
				'confirmed'     => 1,
			], [ 'id' => $meal_id ] );

			self::replace_meal_items( $meal_id, $merged_items );
			static::sync_user_awards( $user_id );
			BehaviorAnalyticsService::track(
				$user_id,
				'meal_logged',
				'nutrition',
				'merge_existing_meal',
				(float) self::sum_meal_item_calories( $items ),
				[
					'meal_id' => $meal_id,
					'meal_type' => $type,
					'source' => $source,
					'items_added' => count( $items ),
				]
			);

			return self::response( [ 'meal_id' => $meal_id, 'merged' => true ] );
		}

		$wpdb->insert( $p . 'fit_meals', [
			'user_id'       => $user_id,
			'meal_datetime' => $meal_dt,
			'meal_type'     => $type,
			'source'        => $source,
			'confirmed'     => 1,
		] );
		$meal_id = (int) $wpdb->insert_id;

		self::replace_meal_items( $meal_id, $items );
		static::sync_user_awards( $user_id );
		BehaviorAnalyticsService::track(
			$user_id,
			'meal_logged',
			'nutrition',
			'new_meal',
			(float) self::sum_meal_item_calories( $items ),
			[
				'meal_id' => $meal_id,
				'meal_type' => $type,
				'source' => $source,
				'items_count' => count( $items ),
			]
		);

		return self::response( [ 'meal_id' => $meal_id ], 201 );
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
			return self::message( 'Meal not found.', 404 );
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
		static::sync_user_awards( $user_id );

		return self::response( [ 'updated' => true ] );
	}

	// ── GET /nutrition/meals ──────────────────────────────────────────────────

	public static function get_meals( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$date    = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		self::consolidate_daily_meals_for_date( $user_id, $date );

		$meals = $wpdb->get_results( $wpdb->prepare(
			"SELECT m.id, m.meal_type, m.meal_datetime, m.source, m.confirmed
			 FROM {$p}fit_meals m
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1
			 ORDER BY m.meal_datetime DESC",
			$user_id, $date
		) );

		foreach ( $meals as $meal ) {
			$meal->items = $wpdb->get_results( $wpdb->prepare(
				"SELECT food_id, food_name, serving_amount, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, is_beverage, source_json
				 FROM {$p}fit_meal_items WHERE meal_id = %d",
				$meal->id
			) );

			foreach ( $meal->items as $item ) {
				$item->micros = $item->micros_json ? self::decode_json_list( $item->micros_json ) : [];
				$item->is_beverage = ! empty( $item->is_beverage );
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
		static::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	// ── GET /nutrition/summary ────────────────────────────────────────────────

	public static function get_nutrition_summary( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$date    = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		self::consolidate_daily_meals_for_date( $user_id, $date );
		self::backfill_missing_meal_item_micros_for_date( $user_id, $date );
		\Johnny5k\Services\CalorieEngine::refresh_active_goal_targets( $user_id );

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
		$goal = \Johnny5k\Services\ExerciseCalorieService::apply_exercise_calorie_target_adjustment( $user_id, $date, $goal );
		$exercise_calories = \Johnny5k\Services\ExerciseCalorieService::get_daily_exercise_calories( $user_id, $date );

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
			'exercise_calories' => $exercise_calories,
			'micros' => array_values( $micros ),
		] );
	}

	public static function get_beverage_board( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$date = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		return new \WP_REST_Response( self::build_beverage_board_payload( $user_id, $date ) );
	}

	public static function save_water_intake( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p = $wpdb->prefix;
		$user_id = get_current_user_id();
		$date = sanitize_text_field( (string) ( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) ) );
		$glasses = max( 0, min( self::DEFAULT_WATER_GLASSES_TARGET, (int) $req->get_param( 'glasses' ) ) );

		$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_hydration_logs WHERE user_id = %d AND log_date = %s LIMIT 1",
			$user_id,
			$date
		) );

		$data = [
			'glasses' => $glasses,
			'target_glasses' => self::DEFAULT_WATER_GLASSES_TARGET,
		];

		if ( $existing_id > 0 ) {
			$updated = $wpdb->update( $p . 'fit_hydration_logs', $data, [ 'id' => $existing_id ] );
			if ( false === $updated ) {
				return new \WP_REST_Response( [
					'code' => 'hydration_save_failed',
					'message' => 'Could not save water intake right now.',
				], 500 );
			}
		} else {
			$inserted = $wpdb->insert( $p . 'fit_hydration_logs', [
				'user_id' => $user_id,
				'log_date' => $date,
				'glasses' => $glasses,
				'target_glasses' => self::DEFAULT_WATER_GLASSES_TARGET,
			] );
			if ( false === $inserted ) {
				return new \WP_REST_Response( [
					'code' => 'hydration_save_failed',
					'message' => 'Could not save water intake right now.',
				], 500 );
			}
		}

		BehaviorAnalyticsService::track(
			$user_id,
			'water_logged',
			'nutrition',
			'save_water_intake',
			(float) $glasses,
			[
				'log_date' => $date,
				'target_glasses' => self::DEFAULT_WATER_GLASSES_TARGET,
			]
		);

		return new \WP_REST_Response( self::build_beverage_board_payload( $user_id, $date ) );
	}

	public static function get_saved_foods( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, canonical_name, brand, serving_size, serving_grams, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, is_beverage, source, label_json, source_json
			 FROM {$p}fit_foods
			 WHERE user_id = %d AND active = 1
			 ORDER BY updated_at DESC, id DESC",
			$user_id
		) );

		foreach ( $rows as $row ) {
			$row->micros = $row->micros_json ? self::decode_json_list( $row->micros_json ) : [];
			$row->label = $row->label_json ? json_decode( (string) $row->label_json, true ) : null;
			$row->source_details = $row->source_json ? json_decode( (string) $row->source_json, true ) : null;
			$row->source = $row->source_details ?: $row->source;
			$row->is_beverage = ! empty( $row->is_beverage );
			unset( $row->micros_json );
			unset( $row->label_json );
			unset( $row->source_json );
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
			'is_beverage'   => ! empty( $payload['is_beverage'] ) ? 1 : 0,
			'source'        => $payload['source'],
			'label_json'    => $payload['label_json'],
			'source_json'   => $payload['source_json'],
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
			'is_beverage'   => ! empty( $payload['is_beverage'] ) ? 1 : 0,
			'source'        => $payload['source'],
			'label_json'    => $payload['label_json'],
			'source_json'   => $payload['source_json'],
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
		$default_meal_type = ! empty( $food->is_beverage ) ? 'beverage' : 'snack';
		$req->set_param( 'meal_type', sanitize_text_field( (string) ( $req->get_param( 'meal_type' ) ?: $default_meal_type ) ) );
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
				'is_beverage'    => ! empty( $food->is_beverage ),
				'source'         => [ 'type' => 'saved_food', 'food_id' => (int) $food->id, 'is_beverage' => ! empty( $food->is_beverage ) ],
			],
		] );

		return self::log_meal( $req );
	}

	// ── POST /nutrition/pantry ────────────────────────────────────────────────

	public static function add_pantry_item( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$payload = self::sanitise_pantry_payload( [
			'item_name'  => $req->get_param( 'item_name' ),
			'category_override' => $req->get_param( 'category_override' ),
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
        
		$items = array_map(
			static function ( $item ) use ( $user_id ) {
				return (object) self::apply_pantry_category_override_to_item( (array) $item, $user_id );
			},
			is_array( $items ) ? $items : []
		);

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
			'category_override' => $req->get_param( 'category_override' ) !== null ? $req->get_param( 'category_override' ) : ( $current['category_override'] ?? null ),
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
		self::set_pantry_category_override( $user_id, $item_id, null );

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

		if ( empty( $items ) ) {
			return self::message( 'Saved meal has no items. Edit or delete it first.', 400 );
		}

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

		$req->set_param( 'meal_datetime', sanitize_text_field( (string) ( $req->get_param( 'meal_datetime' ) ?: UserTime::mysql( $user_id ) ) ) );
		$req->set_param( 'meal_type', $row->meal_type );
		$req->set_param( 'source', 'saved_meal' );
		$req->set_param( 'items', $items );

		return self::log_meal( $req );
	}

	public static function search_foods( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$query   = trim( sanitize_text_field( (string) ( $req->get_param( 'q' ) ?: '' ) ) );
		$beverage_only = rest_sanitize_boolean( $req->get_param( 'beverage_only' ) );

		if ( '' === $query ) {
			return self::response( [] );
		}

		$like = '%' . $wpdb->esc_like( $query ) . '%';

		$saved_foods = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, canonical_name, brand, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, is_beverage, 'saved_food' AS match_type
			 FROM {$p}fit_foods
			 WHERE user_id = %d AND active = 1 AND (canonical_name LIKE %s OR brand LIKE %s)" . ( $beverage_only ? ' AND is_beverage = 1' : '' ) . "
			 ORDER BY CASE WHEN canonical_name LIKE %s THEN 0 ELSE 1 END, updated_at DESC
			 LIMIT 8",
			$user_id,
			$like,
			$like,
			$like
		) );
		$recent_items = self::get_recent_food_entries( $user_id, $query, 12, $beverage_only );

		$merged = [];
		$seen = [];
		foreach ( $saved_foods ?: [] as $row ) {
			$key = self::build_food_match_dedupe_key( (string) $row->canonical_name, (string) $row->brand, (string) $row->serving_size );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$merged[] = [
				'id'           => (int) $row->id,
				'canonical_name'=> (string) $row->canonical_name,
				'brand'        => (string) $row->brand,
				'serving_amount' => 1,
				'serving_size' => (string) $row->serving_size,
				'calories'     => (int) round( (float) $row->calories ),
				'protein_g'    => round( (float) $row->protein_g, 2 ),
				'carbs_g'      => round( (float) $row->carbs_g, 2 ),
				'fat_g'        => round( (float) $row->fat_g, 2 ),
				'fiber_g'      => round( (float) $row->fiber_g, 2 ),
				'sugar_g'      => round( (float) $row->sugar_g, 2 ),
				'sodium_mg'    => round( (float) $row->sodium_mg, 2 ),
				'micros'       => $row->micros_json ? self::decode_json_list( $row->micros_json ) : [],
				'is_beverage'  => ! empty( $row->is_beverage ),
				'match_type'   => (string) $row->match_type,
			];
		}

		foreach ( $recent_items as $row ) {
			$key = self::build_food_match_dedupe_key( (string) ( $row['canonical_name'] ?? '' ), (string) ( $row['brand'] ?? '' ), (string) ( $row['serving_size'] ?? '' ) );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$merged[] = $row;
		}

		return new \WP_REST_Response( array_slice( $merged, 0, 10 ) );
	}

	public static function get_recent_foods( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$limit = max( 1, min( 50, (int) ( $req->get_param( 'limit' ) ?: 20 ) ) );

		return new \WP_REST_Response( self::get_recent_food_entries( $user_id, '', $limit ) );
	}

	public static function update_recent_food( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$item_id = (int) $req->get_param( 'id' );

		$current = $wpdb->get_row( $wpdb->prepare(
			"SELECT mi.*, m.user_id
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE mi.id = %d",
			$item_id
		), ARRAY_A );

		if ( ! $current || (int) ( $current['user_id'] ?? 0 ) !== $user_id ) {
			return new \WP_REST_Response( [ 'message' => 'Recent food not found.' ], 404 );
		}

		$payload = self::build_recent_food_payload( $req, $current );
		$wpdb->update( $p . 'fit_meal_items', array_filter( [
			'food_name'      => $payload['food_name'],
			'serving_amount' => $payload['serving_amount'],
			'serving_unit'   => $payload['serving_unit'],
			'calories'       => $payload['calories'],
			'protein_g'      => $payload['protein_g'],
			'carbs_g'        => $payload['carbs_g'],
			'fat_g'          => $payload['fat_g'],
			'fiber_g'        => $payload['fiber_g'],
			'sugar_g'        => $payload['sugar_g'],
			'sodium_mg'      => $payload['sodium_mg'],
			'micros_json'    => $payload['micros_json'],
		], static fn( $value ) => null !== $value ), [ 'id' => $item_id ] );

		static::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function delete_recent_food( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$item_id = (int) $req->get_param( 'id' );
		$row = self::get_recent_food_row_by_id( $user_id, $item_id );

		if ( ! $row ) {
			return new \WP_REST_Response( [ 'message' => 'Recent food not found.' ], 404 );
		}

		self::add_hidden_recent_food_keys( $user_id, [ self::build_recent_food_dedupe_key( (string) ( $row['food_name'] ?? '' ), $row['source_json'] ?? null ) ] );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	public static function delete_recent_foods( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$ids = $req->get_param( 'ids' );
		$ids = is_array( $ids ) ? array_values( array_filter( array_map( 'intval', $ids ) ) ) : [];

		if ( empty( $ids ) ) {
			return new \WP_REST_Response( [ 'message' => 'Recent food ids are required.' ], 400 );
		}

		$keys = [];
		foreach ( $ids as $item_id ) {
			$row = self::get_recent_food_row_by_id( $user_id, $item_id );
			if ( ! $row ) {
				continue;
			}

			$keys[] = self::build_recent_food_dedupe_key( (string) ( $row['food_name'] ?? '' ), $row['source_json'] ?? null );
		}

		if ( empty( $keys ) ) {
			return new \WP_REST_Response( [ 'message' => 'Recent foods not found.' ], 404 );
		}

		self::add_hidden_recent_food_keys( $user_id, $keys );

		return new \WP_REST_Response( [ 'deleted' => true, 'count' => count( $keys ) ] );
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

	private static function consolidate_daily_meals_for_date( int $user_id, string $date ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$meal_types = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT meal_type
			 FROM {$p}fit_meals
			 WHERE user_id = %d AND DATE(meal_datetime) = %s AND confirmed = 1",
			$user_id,
			$date
		) );

		foreach ( $meal_types as $meal_type ) {
			self::consolidate_daily_meals_by_type( $user_id, $date, (string) $meal_type );
		}
	}

	private static function consolidate_daily_meals_by_type( int $user_id, string $meal_datetime, string $meal_type ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$meal_date = self::normalize_meal_date( $user_id, $meal_datetime );
		$meals     = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, meal_datetime, source
			 FROM {$p}fit_meals
			 WHERE user_id = %d AND meal_type = %s AND DATE(meal_datetime) = %s AND confirmed = 1
			 ORDER BY meal_datetime DESC, id DESC",
			$user_id,
			$meal_type,
			$meal_date
		) );

		if ( empty( $meals ) ) {
			return null;
		}

		$primary = array_shift( $meals );
		if ( empty( $meals ) ) {
			return $primary;
		}

		$primary_id = (int) $primary->id;
		$merged_items = self::get_meal_items_payload( $primary_id );

		foreach ( $meals as $duplicate_meal ) {
			$duplicate_id = (int) $duplicate_meal->id;
			$merged_items = self::merge_unique_meal_items_payload(
				$merged_items,
				self::get_meal_items_payload( $duplicate_id )
			);
		}

		self::replace_meal_items( $primary_id, $merged_items );

		foreach ( $meals as $duplicate_meal ) {
			$duplicate_id = (int) $duplicate_meal->id;
			$wpdb->delete( $p . 'fit_meal_items', [ 'meal_id' => $duplicate_id ] );
			$wpdb->delete( $p . 'fit_meals', [ 'id' => $duplicate_id ] );
		}

		return $primary;
	}

	private static function find_existing_daily_meal_by_type( int $user_id, string $meal_datetime, string $meal_type ) {
		return self::consolidate_daily_meals_by_type( $user_id, $meal_datetime, $meal_type );
	}

	private static function get_meal_items_payload( int $meal_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$items = $wpdb->get_results( $wpdb->prepare(
			"SELECT food_id, food_name, serving_amount, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros_json, is_beverage, source_json
			 FROM {$p}fit_meal_items WHERE meal_id = %d",
			$meal_id
		), ARRAY_A );

		return array_map( static function( array $item ): array {
			$item['micros'] = ! empty( $item['micros_json'] ) ? self::decode_json_list( $item['micros_json'] ) : [];
			$item['source'] = ! empty( $item['source_json'] ) ? json_decode( (string) $item['source_json'], true ) : null;
			$item['is_beverage'] = ! empty( $item['is_beverage'] );
			unset( $item['micros_json'], $item['source_json'] );
			return $item;
		}, $items );
	}

	private static function merge_unique_meal_items_payload( array $primary_items, array $candidate_items ): array {
		$seen = [];

		foreach ( $primary_items as $item ) {
			$seen[ self::build_meal_item_signature( (array) $item ) ] = true;
		}

		foreach ( $candidate_items as $item ) {
			$signature = self::build_meal_item_signature( (array) $item );
			if ( isset( $seen[ $signature ] ) ) {
				continue;
			}

			$primary_items[] = $item;
			$seen[ $signature ] = true;
		}

		return $primary_items;
	}

	private static function build_meal_item_signature( array $item ): string {
		$micros = $item['micros'] ?? [];
		if ( ! is_array( $micros ) ) {
			$micros = self::decode_json_list( $micros );
		}

		$normalized = [
			'food_id' => isset( $item['food_id'] ) ? (int) $item['food_id'] : 0,
			'food_name' => strtolower( trim( (string) ( $item['food_name'] ?? '' ) ) ),
			'serving_amount' => round( (float) ( $item['serving_amount'] ?? 1 ), 4 ),
			'serving_unit' => strtolower( trim( (string) ( $item['serving_unit'] ?? 'serving' ) ) ),
			'calories' => (int) ( $item['calories'] ?? 0 ),
			'protein_g' => round( (float) ( $item['protein_g'] ?? 0 ), 4 ),
			'carbs_g' => round( (float) ( $item['carbs_g'] ?? 0 ), 4 ),
			'fat_g' => round( (float) ( $item['fat_g'] ?? 0 ), 4 ),
			'fiber_g' => isset( $item['fiber_g'] ) ? round( (float) $item['fiber_g'], 4 ) : null,
			'sugar_g' => isset( $item['sugar_g'] ) ? round( (float) $item['sugar_g'], 4 ) : null,
			'sodium_mg' => isset( $item['sodium_mg'] ) ? round( (float) $item['sodium_mg'], 4 ) : null,
			'is_beverage' => ! empty( $item['is_beverage'] ) ? 1 : 0,
			'micros' => self::normalize_signature_value( $micros ),
			'source' => self::normalize_signature_value( $item['source'] ?? null ),
		];

		return wp_json_encode( $normalized ) ?: '';
	}

	private static function normalize_signature_value( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}

		if ( self::is_associative_array( $value ) ) {
			ksort( $value );
		}

		foreach ( $value as $key => $child_value ) {
			$value[ $key ] = self::normalize_signature_value( $child_value );
		}

		return $value;
	}

	private static function is_associative_array( array $value ): bool {
		if ( [] === $value ) {
			return false;
		}

		return array_keys( $value ) !== range( 0, count( $value ) - 1 );
	}

	private static function normalize_meal_date( int $user_id, string $meal_datetime ): string {
		return preg_match( '/^\d{4}-\d{2}-\d{2}/', $meal_datetime, $matches )
			? $matches[0]
			: UserTime::today( $user_id );
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
				'is_beverage'    => self::is_beverage_item_payload( $item ) ? 1 : 0,
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
				'is_beverage'    => self::is_beverage_item_payload( $item ),
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
		$source_details = $req->get_param( 'source_details' );
		$source_details = is_array( $source_details ) ? $source_details : [];

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
			'is_beverage'    => rest_sanitize_boolean( $req->get_param( 'is_beverage' ) ),
			'source'         => sanitize_text_field( (string) ( $req->get_param( 'source' ) ?: 'manual' ) ),
			'label_json'     => ! empty( $label ) ? wp_json_encode( $label ) : null,
			'source_json'    => ! empty( $source_details ) ? wp_json_encode( $source_details ) : null,
		];
	}

	private static function build_recent_food_payload( \WP_REST_Request $req, array $current ): array {
		$micros = $req->get_param( 'micros' );
		$micros = is_array( $micros ) ? array_values( $micros ) : self::decode_json_list( $current['micros_json'] ?? null );
		$serving_multiplier = max( 0.1, (float) ( $current['serving_amount'] ?? 1 ) );

		return [
			'food_name'      => sanitize_text_field( (string) ( $req->get_param( 'canonical_name' ) ?: $req->get_param( 'food_name' ) ?: ( $current['food_name'] ?? 'Food item' ) ) ),
			'serving_amount' => $serving_multiplier,
			'serving_unit'   => sanitize_text_field( (string) ( $req->get_param( 'serving_unit' ) ?: $req->get_param( 'serving_size' ) ?: ( $current['serving_unit'] ?? 'serving' ) ) ),
			'calories'       => (int) round( (float) ( $req->get_param( 'calories' ) !== null ? $req->get_param( 'calories' ) : ( $current['calories'] ?? 0 ) ) * $serving_multiplier ),
			'protein_g'      => round( (float) ( $req->get_param( 'protein_g' ) !== null ? $req->get_param( 'protein_g' ) : ( $current['protein_g'] ?? 0 ) ) * $serving_multiplier, 2 ),
			'carbs_g'        => round( (float) ( $req->get_param( 'carbs_g' ) !== null ? $req->get_param( 'carbs_g' ) : ( $current['carbs_g'] ?? 0 ) ) * $serving_multiplier, 2 ),
			'fat_g'          => round( (float) ( $req->get_param( 'fat_g' ) !== null ? $req->get_param( 'fat_g' ) : ( $current['fat_g'] ?? 0 ) ) * $serving_multiplier, 2 ),
			'fiber_g'        => $req->get_param( 'fiber_g' ) !== null ? round( (float) $req->get_param( 'fiber_g' ) * $serving_multiplier, 2 ) : ( isset( $current['fiber_g'] ) ? round( (float) $current['fiber_g'], 2 ) : null ),
			'sugar_g'        => $req->get_param( 'sugar_g' ) !== null ? round( (float) $req->get_param( 'sugar_g' ) * $serving_multiplier, 2 ) : ( isset( $current['sugar_g'] ) ? round( (float) $current['sugar_g'], 2 ) : null ),
			'sodium_mg'      => $req->get_param( 'sodium_mg' ) !== null ? round( (float) $req->get_param( 'sodium_mg' ) * $serving_multiplier, 2 ) : ( isset( $current['sodium_mg'] ) ? round( (float) $current['sodium_mg'], 2 ) : null ),
			'micros_json'    => ! empty( $micros ) ? wp_json_encode( self::scale_micros( $micros, $serving_multiplier ) ) : null,
		];
	}

	private static function get_recent_food_entries( int $user_id, string $query = '', int $limit = 20, bool $beverage_only = false ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$hidden_keys = array_fill_keys( self::get_hidden_recent_food_keys( $user_id ), true );

		$limit = max( 1, min( 100, $limit ) );
		$sql = "SELECT mi.id, mi.food_id, mi.food_name, mi.serving_amount, mi.serving_unit, mi.calories, mi.protein_g, mi.carbs_g, mi.fat_g, mi.fiber_g, mi.sugar_g, mi.sodium_mg, mi.micros_json, mi.is_beverage, mi.source_json, m.id AS meal_id, m.meal_datetime
			FROM {$p}fit_meal_items mi
			JOIN {$p}fit_meals m ON m.id = mi.meal_id
			WHERE m.user_id = %d AND m.confirmed = 1";
		$params = [ $user_id ];

		if ( '' !== $query ) {
			$sql .= ' AND mi.food_name LIKE %s';
			$params[] = '%' . $wpdb->esc_like( $query ) . '%';
		}

		if ( $beverage_only ) {
			$sql .= ' AND mi.is_beverage = 1';
		}

		$sql .= ' ORDER BY m.meal_datetime DESC, mi.id DESC LIMIT %d';
		$params[] = $limit * 4;

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );
		$deduped = [];
		$seen = [];

		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			if ( self::recent_food_row_comes_from_saved_food( $row ) ) {
				continue;
			}

			$key = self::build_recent_food_dedupe_key( (string) ( $row['food_name'] ?? '' ), $row['source_json'] ?? null );
			if ( '' === $key || isset( $seen[ $key ] ) || isset( $hidden_keys[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$deduped[] = self::format_recent_food_entry( $row );

			if ( count( $deduped ) >= $limit ) {
				break;
			}
		}

		return $deduped;
	}

	private static function recent_food_row_comes_from_saved_food( array $row ): bool {
		$source_details = ! empty( $row['source_json'] ) ? json_decode( (string) $row['source_json'], true ) : [];
		if ( ! is_array( $source_details ) ) {
			return false;
		}

		return 'saved_food' === sanitize_key( (string) ( $source_details['type'] ?? '' ) );
	}

	private static function get_recent_food_row_by_id( int $user_id, int $item_id ): ?array {
		global $wpdb;
		$p = $wpdb->prefix;

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT mi.*, m.user_id, m.meal_datetime
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE mi.id = %d AND m.user_id = %d AND m.confirmed = 1",
			$item_id,
			$user_id
		), ARRAY_A );

		return is_array( $row ) ? $row : null;
	}

	private static function format_recent_food_entry( array $row ): array {
		$source_details = ! empty( $row['source_json'] ) ? json_decode( (string) $row['source_json'], true ) : [];
		$brand = is_array( $source_details ) && ! empty( $source_details['brand'] ) ? sanitize_text_field( (string) $source_details['brand'] ) : '';
		$serving_multiplier = max( 0.1, (float) ( $row['serving_amount'] ?? 1 ) );
		$per_serving_micros = ! empty( $row['micros_json'] ) ? self::scale_micros( self::decode_json_list( $row['micros_json'] ), 1 / $serving_multiplier ) : [];

		return [
			'id'             => (int) ( $row['id'] ?? 0 ),
			'food_id'        => isset( $row['food_id'] ) ? (int) $row['food_id'] : null,
			'canonical_name' => (string) ( $row['food_name'] ?? '' ),
			'brand'          => $brand,
			'serving_amount' => 1,
			'serving_size'   => (string) ( $row['serving_unit'] ?? 'serving' ),
			'calories'       => (int) round( (float) ( $row['calories'] ?? 0 ) / $serving_multiplier ),
			'protein_g'      => round( (float) ( $row['protein_g'] ?? 0 ) / $serving_multiplier, 2 ),
			'carbs_g'        => round( (float) ( $row['carbs_g'] ?? 0 ) / $serving_multiplier, 2 ),
			'fat_g'          => round( (float) ( $row['fat_g'] ?? 0 ) / $serving_multiplier, 2 ),
			'fiber_g'        => round( (float) ( $row['fiber_g'] ?? 0 ) / $serving_multiplier, 2 ),
			'sugar_g'        => round( (float) ( $row['sugar_g'] ?? 0 ) / $serving_multiplier, 2 ),
			'sodium_mg'      => round( (float) ( $row['sodium_mg'] ?? 0 ) / $serving_multiplier, 2 ),
			'micros'         => $per_serving_micros,
			'is_beverage'    => ! empty( $row['is_beverage'] ),
			'match_type'     => 'recent_item',
			'meal_id'        => isset( $row['meal_id'] ) ? (int) $row['meal_id'] : null,
			'meal_datetime'  => (string) ( $row['meal_datetime'] ?? '' ),
			'source'         => is_array( $source_details ) ? $source_details : null,
		];
	}

	private static function build_recent_food_dedupe_key( string $food_name, $source_json = null ): string {
		$source_details = is_array( $source_json ) ? $source_json : json_decode( (string) $source_json, true );
		$brand = is_array( $source_details ) && ! empty( $source_details['brand'] ) ? sanitize_text_field( (string) $source_details['brand'] ) : '';

		return self::build_food_match_dedupe_key( $food_name, $brand, '' );
	}

	private static function get_hidden_recent_food_keys( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::HIDDEN_RECENT_FOOD_KEYS_META_KEY, true );
		$stored_keys = is_array( $stored ) ? $stored : [];

		return array_values( array_filter( array_unique( array_map( 'strval', $stored_keys ) ) ) );
	}

	private static function save_hidden_recent_food_keys( int $user_id, array $keys ): void {
		$keys = array_values( array_filter( array_unique( array_map( 'strval', $keys ) ) ) );

		if ( empty( $keys ) ) {
			delete_user_meta( $user_id, self::HIDDEN_RECENT_FOOD_KEYS_META_KEY );
			return;
		}

		update_user_meta( $user_id, self::HIDDEN_RECENT_FOOD_KEYS_META_KEY, $keys );
	}

	private static function add_hidden_recent_food_keys( int $user_id, array $keys ): void {
		$current = self::get_hidden_recent_food_keys( $user_id );
		self::save_hidden_recent_food_keys( $user_id, array_merge( $current, $keys ) );
	}

	private static function build_food_match_dedupe_key( string $name, string $brand = '', string $serving_size = '' ): string {
		$normalize = static function( string $value ): string {
			$value = strtolower( trim( $value ) );
			return preg_replace( '/\s+/', ' ', $value ) ?: '';
		};

		return $normalize( $name ) . '|' . $normalize( $brand ) . '|' . $normalize( $serving_size );
	}

	private static function is_beverage_item_payload( array $item ): bool {
		if ( ! empty( $item['is_beverage'] ) ) {
			return true;
		}

		$source = is_array( $item['source'] ?? null ) ? $item['source'] : [];
		if ( ! empty( $source['is_beverage'] ) ) {
			return true;
		}

		return self::looks_like_beverage_text(
			(string) ( $item['food_name'] ?? '' ),
			(string) ( $item['serving_unit'] ?? '' )
		);
	}

	private static function looks_like_beverage_text( string $name, string $unit = '' ): bool {
		$text = strtolower( trim( $name . ' ' . $unit ) );
		if ( '' === $text ) {
			return false;
		}

		foreach ( [
			'coffee',
			'latte',
			'mocha',
			'frapp',
			'tea',
			'soda',
			'cola',
			'juice',
			'water',
			'sparkling water',
			'electrolyte',
			'energy drink',
			'sports drink',
			'lemonade',
			'milk',
			'protein shake',
			'shake',
			'smoothie',
			'kombucha',
			'bottle',
			'can',
			'cup',
			'glass',
			'fl oz',
			'ml',
		] as $keyword ) {
			if ( false !== strpos( $text, $keyword ) ) {
				return true;
			}
		}

		return false;
	}

	private static function build_beverage_board_payload( int $user_id, string $date ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$anchor = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $date . ' 12:00:00', UserTime::timezone( $user_id ) );
		if ( false === $anchor ) {
			$anchor = UserTime::now( $user_id );
			$date = $anchor->format( 'Y-m-d' );
		}

		$period_start = $anchor->modify( '-6 day' )->format( 'Y-m-d' );
		$period_end = $anchor->format( 'Y-m-d' );

		$beverage_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT DATE(m.meal_datetime) AS log_date, mi.food_name, mi.calories, mi.sugar_g
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d
			   AND m.confirmed = 1
			   AND DATE(m.meal_datetime) BETWEEN %s AND %s
			   AND mi.is_beverage = 1
			 ORDER BY m.meal_datetime DESC, mi.id DESC",
			$user_id,
			$period_start,
			$period_end
		), ARRAY_A );

		$hydration_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT log_date, glasses, target_glasses
			 FROM {$p}fit_hydration_logs
			 WHERE user_id = %d AND log_date BETWEEN %s AND %s
			 ORDER BY log_date ASC",
			$user_id,
			$period_start,
			$period_end
		), ARRAY_A );

		$drink_dates = [];
		$total_beverage_calories = 0;
		$drink_count = 0;
		$sugary_drink_count = 0;
		$coffee_drink_count = 0;
		$coffee_beverage_calories = 0;

		foreach ( is_array( $beverage_rows ) ? $beverage_rows : [] as $row ) {
			$drink_count++;
			$drink_date = (string) ( $row['log_date'] ?? '' );
			if ( '' !== $drink_date ) {
				$drink_dates[ $drink_date ] = true;
			}

			$calories = (int) round( (float) ( $row['calories'] ?? 0 ) );
			$total_beverage_calories += $calories;

			$name = strtolower( trim( (string) ( $row['food_name'] ?? '' ) ) );
			$sugar = (float) ( $row['sugar_g'] ?? 0 );
			if ( $sugar >= 10 || preg_match( '/\b(soda|cola|juice|lemonade|frapp|mocha|energy drink|sports drink)\b/', $name ) ) {
				$sugary_drink_count++;
			}

			if ( preg_match( '/\b(coffee|latte|mocha|frapp|cappuccino|macchiato|cold brew)\b/', $name ) ) {
				$coffee_drink_count++;
				$coffee_beverage_calories += $calories;
			}
		}

		$water_today = [
			'glasses' => 0,
			'target_glasses' => self::DEFAULT_WATER_GLASSES_TARGET,
		];
		$seven_day_water_glasses = 0;
		$water_logged_days = 0;

		foreach ( is_array( $hydration_rows ) ? $hydration_rows : [] as $row ) {
			$glasses = max( 0, (int) ( $row['glasses'] ?? 0 ) );
			$target_glasses = max( 1, (int) ( $row['target_glasses'] ?? self::DEFAULT_WATER_GLASSES_TARGET ) );
			$seven_day_water_glasses += $glasses;
			if ( $glasses > 0 ) {
				$water_logged_days++;
			}

			if ( (string) ( $row['log_date'] ?? '' ) === $date ) {
				$water_today = [
					'glasses' => $glasses,
					'target_glasses' => $target_glasses,
				];
			}
		}

		$review = self::build_beverage_board_review( [
			'total_beverage_calories' => $total_beverage_calories,
			'drink_count' => $drink_count,
			'logged_days' => count( $drink_dates ),
			'sugary_drink_count' => $sugary_drink_count,
			'coffee_drink_count' => $coffee_drink_count,
			'coffee_beverage_calories' => $coffee_beverage_calories,
			'water_glasses' => $seven_day_water_glasses,
			'water_logged_days' => $water_logged_days,
			'target_glasses' => $water_today['target_glasses'],
		] );

		return [
			'date' => $date,
			'period_start' => $period_start,
			'period_end' => $period_end,
			'water' => [
				'glasses' => $water_today['glasses'],
				'target_glasses' => $water_today['target_glasses'],
				'seven_day_glasses' => $seven_day_water_glasses,
				'logged_days' => $water_logged_days,
			],
			'review' => $review,
		];
	}

	private static function build_beverage_board_review( array $metrics ): array {
		$total_beverage_calories = (int) ( $metrics['total_beverage_calories'] ?? 0 );
		$drink_count = (int) ( $metrics['drink_count'] ?? 0 );
		$logged_days = (int) ( $metrics['logged_days'] ?? 0 );
		$sugary_drink_count = (int) ( $metrics['sugary_drink_count'] ?? 0 );
		$coffee_drink_count = (int) ( $metrics['coffee_drink_count'] ?? 0 );
		$coffee_beverage_calories = (int) ( $metrics['coffee_beverage_calories'] ?? 0 );
		$water_glasses = (int) ( $metrics['water_glasses'] ?? 0 );
		$water_logged_days = (int) ( $metrics['water_logged_days'] ?? 0 );
		$target_glasses = max( 1, (int) ( $metrics['target_glasses'] ?? self::DEFAULT_WATER_GLASSES_TARGET ) );

		$headline = 'Beverage Board is ready';
		$review = 'Log drinks and tap your water glasses so Johnny can catch hidden calories before they drift.';

		if ( $drink_count <= 0 && $water_glasses <= 0 ) {
			return [
				'period_label' => 'Last 7 days',
				'headline' => $headline,
				'review' => $review,
				'metrics' => $metrics,
			];
		}

		if ( $coffee_drink_count >= 3 && $coffee_beverage_calories >= 300 ) {
			$headline = 'Coffee drinks are carrying more calories than they look';
			$review = sprintf(
				'Johnny: %1$d coffee-style drink%2$s added about %3$d calories in the last 7 days. Tighten the add-ins before you start cutting meals.',
				$coffee_drink_count,
				1 === $coffee_drink_count ? '' : 's',
				$coffee_beverage_calories
			);
		} elseif ( $sugary_drink_count >= 3 && $total_beverage_calories >= 400 ) {
			$headline = sprintf( 'Hidden beverage calories reached %d this week', $total_beverage_calories );
			$review = sprintf(
				'Johnny: %1$d higher-sugar drink%2$s showed up over the last 7 days. Clean up liquid calories first before making the food plan stricter.',
				$sugary_drink_count,
				1 === $sugary_drink_count ? '' : 's'
			);
		} elseif ( $water_logged_days <= 2 ) {
			$headline = 'Hydration logging is not consistent yet';
			$review = sprintf(
				'Johnny: water showed up on %1$d of the last 7 days. Hit the glass tracker earlier in the day so hydration does not become an afterthought.',
				$water_logged_days
			);
		} elseif ( $water_logged_days >= 5 && $water_glasses >= ( $target_glasses * 5 ) ) {
			$headline = 'Hydration has been steady';
			$review = sprintf(
				'Johnny: you logged %1$d water glasses across %2$d of the last 7 days. Keep that rhythm and let the Beverage Board keep liquid calories visible.',
				$water_glasses,
				$water_logged_days
			);
		} elseif ( $drink_count > 0 && $total_beverage_calories <= 250 ) {
			$headline = 'Beverage calories stayed under control';
			$review = sprintf(
				'Johnny: %1$d drink%2$s were logged across %3$d day%4$s with only about %5$d beverage calories total. Keep using the board so the quiet wins stay visible.',
				$drink_count,
				1 === $drink_count ? '' : 's',
				$logged_days,
				1 === $logged_days ? '' : 's',
				$total_beverage_calories
			);
		}

		return [
			'period_label' => 'Last 7 days',
			'headline' => $headline,
			'review' => $review,
			'metrics' => $metrics,
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

	private static function normalise_food_name( string $value ): string {
		$value = strtolower( trim( $value ) );
		$value = preg_replace( '/[^a-z0-9]+/', ' ', $value ) ?: '';
		return trim( $value );
	}

	private static function sanitise_pantry_payload( array $input ): array {
		$item_name = sanitize_text_field( (string) ( $input['item_name'] ?? '' ) );
		$category_override = self::sanitise_pantry_category_override( $input['category_override'] ?? null );
		$unit = sanitize_text_field( (string) ( $input['unit'] ?? '' ) );
		$expires_on = sanitize_text_field( (string) ( $input['expires_on'] ?? '' ) );
		$quantity = null;

		if ( array_key_exists( 'quantity', $input ) && '' !== (string) $input['quantity'] && null !== $input['quantity'] ) {
			$quantity = round( (float) $input['quantity'], 2 );
		}

		return [
			'item_name'  => trim( $item_name ),
			'category_override' => $category_override,
			'quantity'   => $quantity,
			'unit'       => '' !== trim( $unit ) ? trim( $unit ) : null,
			'expires_on' => '' !== trim( $expires_on ) ? trim( $expires_on ) : null,
		];
	}

	private static function sanitise_pantry_category_override( $value ): ?string {
		$category = sanitize_key( (string) ( $value ?? '' ) );
		$allowed = [ 'proteins', 'produce', 'dairy-eggs', 'grains', 'staples', 'frozen', 'snacks', 'drinks', 'other' ];

		if ( '' === $category ) {
			return null;
		}

		return in_array( $category, $allowed, true ) ? $category : null;
	}

	private static function upsert_pantry_item( int $user_id, array $payload, int $existing_item_id = 0 ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_pantry_items';
		$db_payload = self::build_pantry_db_payload( $payload );

		$matching_item = self::find_matching_pantry_item( $user_id, (string) $payload['item_name'], $existing_item_id );

		if ( $matching_item ) {
			$merged_payload = self::merge_pantry_values( (array) $matching_item, $payload );
			$wpdb->update( $table, self::build_pantry_db_payload( $merged_payload ), [ 'id' => (int) $matching_item['id'] ] );
			self::set_pantry_category_override( $user_id, (int) $matching_item['id'], $merged_payload['category_override'] ?? null );

			if ( $existing_item_id > 0 ) {
				$wpdb->delete( $table, [ 'id' => $existing_item_id ] );
				self::set_pantry_category_override( $user_id, $existing_item_id, null );
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
			$wpdb->update( $table, $db_payload, [ 'id' => $existing_item_id ] );
			self::set_pantry_category_override( $user_id, $existing_item_id, $payload['category_override'] ?? null );
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
			...$db_payload,
		], static fn( $value ) => null !== $value ) );

		$item_id = (int) $wpdb->insert_id;
		self::set_pantry_category_override( $user_id, $item_id, $payload['category_override'] ?? null );

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
			'category_override' => array_key_exists( 'category_override', $incoming ) ? $incoming['category_override'] : ( $existing['category_override'] ?? null ),
			'quantity'   => $unit_pair['quantity'],
			'unit'       => $unit_pair['unit'],
			'expires_on' => self::merge_pantry_expiry( $existing['expires_on'] ?? null, $incoming['expires_on'] ?? null ),
		];
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

		if ( ! $item ) {
			return null;
		}

		return self::apply_pantry_category_override_to_item( $item, (int) ( $item['user_id'] ?? 0 ) );
	}

	private static function pantry_category_column_exists(): bool {
		static $exists = null;

		if ( null !== $exists ) {
			return $exists;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'fit_pantry_items';
		$column = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'category_override' ) );
		$exists = ! empty( $column );

		return $exists;
	}

	private static function build_pantry_db_payload( array $payload ): array {
		if ( self::pantry_category_column_exists() ) {
			return $payload;
		}

		unset( $payload['category_override'] );

		return $payload;
	}

	private static function get_pantry_category_overrides( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::PANTRY_CATEGORY_OVERRIDES_META_KEY, true );
		return is_array( $stored ) ? $stored : [];
	}

	private static function set_pantry_category_override( int $user_id, int $item_id, ?string $category_override ): void {
		if ( $user_id <= 0 || $item_id <= 0 ) {
			return;
		}

		$overrides = self::get_pantry_category_overrides( $user_id );
		$key = (string) $item_id;

		if ( null === $category_override || '' === trim( $category_override ) ) {
			unset( $overrides[ $key ] );
		} else {
			$overrides[ $key ] = $category_override;
		}

		if ( empty( $overrides ) ) {
			delete_user_meta( $user_id, self::PANTRY_CATEGORY_OVERRIDES_META_KEY );
			return;
		}

		update_user_meta( $user_id, self::PANTRY_CATEGORY_OVERRIDES_META_KEY, $overrides );
	}

	private static function apply_pantry_category_override_to_item( array $item, int $user_id ): array {
		if ( ! empty( $item['category_override'] ) ) {
			return $item;
		}

		$item_id = (int) ( $item['id'] ?? 0 );
		if ( $user_id <= 0 || $item_id <= 0 ) {
			return $item;
		}

		$overrides = self::get_pantry_category_overrides( $user_id );
		$key = (string) $item_id;
		if ( isset( $overrides[ $key ] ) ) {
			$item['category_override'] = $overrides[ $key ];
		}

		return $item;
	}

	private static function sum_meal_item_calories( array $items ): int {
		$total = 0;
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$total += (int) round( (float) ( $item['calories'] ?? 0 ) );
		}
		return max( 0, $total );
	}

protected static function sync_user_awards( int $user_id ): void {
		\Johnny5k\Services\AwardEngine::sync_user_awards( $user_id );
	}

}

/**
 * REST Controller: AI / Johnny5k
 *
 * POST /fit/v1/ai/chat              — general chat
 * POST /fit/v1/ai/analyse/meal      — send meal photo for nutrition analysis
 * POST /fit/v1/ai/analyse/label     — send food label photo for extraction
 * GET  /fit/v1/ai/thread/{key}      — get conversation history for a thread
 * DELETE /fit/v1/ai/thread/{key}    — clear a thread's history
 */
class AiController extends RestController {

	public static function register_routes(): void {
		AiChatController::register_routes();
	}
}
