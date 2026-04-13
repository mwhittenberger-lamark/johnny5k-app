<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;

class NutritionRecipeController extends RestController {
	private const GROCERY_GAP_ITEMS_META_KEY = 'jf_nutrition_grocery_gap_items';
	private const GROCERY_GAP_HIDDEN_ITEMS_META_KEY = 'jf_nutrition_grocery_gap_hidden_items';
	private const RECIPE_COOKBOOK_META_KEY = 'johnny5k_recipe_cookbook';

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = self::auth_callback();

		register_rest_route( $ns, '/nutrition/recipes', [
			'methods'             => 'GET',
			'callback'            => [ self::class, 'get_recipe_suggestions' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/recipe-cookbook', [
			[
				'methods'             => 'GET',
				'callback'            => [ self::class, 'get_recipe_cookbook' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ self::class, 'update_recipe_cookbook' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/nutrition/grocery-gap', [
			'methods'             => 'GET',
			'callback'            => [ self::class, 'get_grocery_gap' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/nutrition/grocery-gap/items', [
			[
				'methods'             => 'POST',
				'callback'            => [ self::class, 'add_grocery_gap_items' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ self::class, 'delete_grocery_gap_items' ],
				'permission_callback' => $auth,
			],
		] );
	}

	public static function get_recipe_suggestions( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p             = $wpdb->prefix;
		$user_id       = get_current_user_id();
		$refresh_token = sanitize_text_field( (string) ( $req->get_param( 'refresh_token' ) ?: '' ) );

		$pantry_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT item_name FROM {$p}fit_pantry_items WHERE user_id = %d ORDER BY updated_at DESC, id DESC LIMIT 12",
			$user_id
		) );
		$prefs       = self::get_user_food_preferences( $user_id );
		$suggestions = self::build_recipe_suggestions( $pantry_rows, $prefs, $refresh_token );
		$should_discover_online = '' !== $refresh_token || count( $suggestions ) < 4 || count( $pantry_rows ) < 3;

		if ( $should_discover_online ) {
			$discovered = AiService::discover_recipe_library_items( $user_id, [
				'query' => self::build_user_recipe_discovery_query( $pantry_rows, $prefs ),
				'count' => 4,
			] );
			if ( ! is_wp_error( $discovered ) && ! empty( $discovered['recipes'] ) && is_array( $discovered['recipes'] ) ) {
				$suggestions = self::merge_recipe_suggestion_sets( $suggestions, $discovered['recipes'] );
			}
		}

		$wpdb->delete( $p . 'fit_recipe_suggestions', [ 'user_id' => $user_id, 'is_cookbook' => 0 ] );
		foreach ( $suggestions as $suggestion ) {
			$wpdb->insert( $p . 'fit_recipe_suggestions', self::recipe_suggestion_db_payload( $user_id, $suggestion, 0 ) );
		}

		return new \WP_REST_Response( $suggestions );
	}

	public static function get_recipe_cookbook( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		return new \WP_REST_Response( self::get_recipe_cookbook_items( $user_id ) );
	}

	public static function update_recipe_cookbook( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$recipes   = $req->get_param( 'recipes' );
		$recipes   = is_array( $recipes ) ? $recipes : [];
		$sanitized = self::sanitize_recipe_cookbook_items( $recipes );
		self::set_recipe_cookbook_items( $user_id, $sanitized );
		self::sync_recipe_cookbook_missing_ingredients_to_grocery_gap( $user_id, $sanitized );

		return new \WP_REST_Response( [
			'updated' => true,
			'recipes' => $sanitized,
		] );
	}

	public static function get_grocery_gap( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p                = $wpdb->prefix;
		$user_id          = get_current_user_id();
		$pantry_rows      = $wpdb->get_results( $wpdb->prepare(
			"SELECT item_name FROM {$p}fit_pantry_items WHERE user_id = %d ORDER BY item_name",
			$user_id
		) );
		$prefs            = self::get_user_food_preferences( $user_id );
		$manual_items     = self::get_manual_grocery_gap_items( $user_id );
		$hidden_item_keys = self::get_hidden_grocery_gap_item_keys( $user_id );
		$gaps             = self::build_grocery_gap( $pantry_rows, $prefs, $manual_items, $hidden_item_keys );

		return new \WP_REST_Response( $gaps );
	}

	public static function add_grocery_gap_items( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$items   = $req->get_param( 'items' );

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
		$items_by_key  = [];
		$results       = [];
		$created_count = 0;
		$merged_count  = 0;

		foreach ( $current_items as $item ) {
			$key = self::normalise_food_name( (string) ( $item['item_name'] ?? '' ) );
			if ( '' === $key ) {
				continue;
			}

			$items_by_key[ $key ] = $item;
		}

		foreach ( $items as $item ) {
			$payload = self::sanitise_grocery_gap_payload( (array) $item );
			$key     = self::normalise_food_name( (string) $payload['item_name'] );

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
		self::remove_hidden_grocery_gap_item_keys(
			$user_id,
			array_map(
				static fn( array $item ): string => (string) ( $item['item_name'] ?? '' ),
				array_values( $items_by_key )
			)
		);

		return new \WP_REST_Response( [
			'items'         => $results,
			'created_count' => $created_count,
			'merged_count'  => $merged_count,
		] );
	}

	public static function delete_grocery_gap_items( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$items   = $req->get_param( 'items' );

		if ( ! is_array( $items ) ) {
			return new \WP_REST_Response( [ 'message' => 'Items array is required.' ], 400 );
		}

		$keys_to_remove = [];
		foreach ( $items as $item ) {
			$value = is_array( $item ) ? ( $item['item_name'] ?? '' ) : $item;
			$key   = self::normalise_food_name( sanitize_text_field( (string) $value ) );
			if ( '' !== $key ) {
				$keys_to_remove[ $key ] = true;
			}
		}

		if ( empty( $keys_to_remove ) ) {
			return new \WP_REST_Response( [ 'message' => 'No valid grocery gap items were provided.' ], 400 );
		}

		$current_items   = self::get_manual_grocery_gap_items( $user_id );
		$remaining_items = [];
		$deleted_count   = 0;

		foreach ( $current_items as $item ) {
			$key = self::normalise_food_name( (string) ( $item['item_name'] ?? '' ) );
			if ( '' !== $key && isset( $keys_to_remove[ $key ] ) ) {
				$deleted_count++;
				continue;
			}

			$remaining_items[] = $item;
		}

		self::save_manual_grocery_gap_items( $user_id, $remaining_items );
		self::add_hidden_grocery_gap_item_keys( $user_id, array_keys( $keys_to_remove ) );

		return new \WP_REST_Response( [
			'deleted'       => true,
			'deleted_count' => $deleted_count,
		] );
	}

	private static function build_user_recipe_discovery_query( array $pantry_rows, array $prefs ): string {
		$pantry_items = array_values( array_filter( array_map( static function( $row ): string {
			return self::normalise_food_name( (string) ( is_object( $row ) ? ( $row->item_name ?? '' ) : ( $row['item_name'] ?? '' ) ) );
		}, $pantry_rows ) ) );
		$pantry_slice = array_slice( $pantry_items, 0, 6 );
		$prefs_slice  = array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $prefs['preferred_foods'] ?? [] ) ) ) ), 0, 4 );

		$parts = [
			'high protein practical meal ideas',
			$pantry_slice ? 'using ' . implode( ', ', $pantry_slice ) : '',
			$prefs_slice ? 'favouring ' . implode( ', ', $prefs_slice ) : '',
		];

		return trim( implode( ' ', array_filter( $parts ) ) );
	}

	private static function merge_recipe_suggestion_sets( array $base, array $incoming ): array {
		$merged = [];
		$seen   = [];

		foreach ( array_merge( $incoming, $base ) as $recipe ) {
			$recipe = is_array( $recipe ) ? $recipe : [];
			$name   = sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) );
			if ( '' === $name ) {
				continue;
			}

			$key = strtolower( sanitize_title( $name ) . '|' . sanitize_key( (string) ( $recipe['meal_type'] ?? '' ) ) );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$merged[]     = $recipe;
		}

		return array_values( $merged );
	}

	private static function decode_json_list( $value ): array {
		if ( ! $value ) {
			return [];
		}

		$decoded = json_decode( (string) $value, true );
		return is_array( $decoded ) ? $decoded : [];
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
		$pantry          = array_values( array_filter( array_map( static fn( $row ) => self::normalise_food_name( (string) $row->item_name ), $pantry_rows ) ) );
		$preferred_foods = array_values( array_filter( array_map( 'trim', explode( ',', strtolower( trim( (string) ( $prefs['food_preferences']['preferred_foods'] ?? '' ) ) ) ) ) ) );
		$dislikes        = array_map( 'strtolower', array_map( 'trim', $prefs['food_dislikes'] ?? [] ) );
		$token           = $refresh_token ?: gmdate( 'Y-m-d' );
		$pools           = self::build_recipe_ingredient_pools( $pantry, $token );

		$library     = get_option( 'jf_recipe_library', [] );
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
					'source'               => 'admin_library',
					'meal_type'            => sanitize_key( (string) ( $recipe['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
					'recipe_name'          => sanitize_text_field( (string) $recipe['recipe_name'] ),
					'ingredients'          => self::unique_recipe_ingredients( (array) ( $recipe['ingredients'] ?? [] ) ),
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
			$ingredients       = self::unique_recipe_ingredients( (array) ( $suggestion['ingredients'] ?? [] ) );
			$on_hand           = [];
			$missing           = [];
			$source            = sanitize_key( (string) ( $suggestion['source'] ?? 'generated' ) ) ?: 'generated';
			$preferred_matches = 0;

			foreach ( $ingredients as $ingredient ) {
				if ( self::pantry_has_ingredient( $pantry, $ingredient ) ) {
					$on_hand[] = $ingredient;
				} else {
					$missing[] = $ingredient;
				}
			}

			$text = strtolower( implode( ' ', $ingredients ) . ' ' . (string) ( $suggestion['recipe_name'] ?? '' ) );
			foreach ( $preferred_foods as $preferred_food ) {
				if ( $preferred_food && str_contains( $text, strtolower( $preferred_food ) ) ) {
					$preferred_matches++;
				}
			}

			$suggestion['source']                = $source;
			$suggestion['key']                   = sanitize_title( $source . '-' . (string) ( $suggestion['meal_type'] ?? 'meal' ) . '-' . (string) ( $suggestion['recipe_name'] ?? '' ) );
			$suggestion['ingredients']           = $ingredients;
			$suggestion['on_hand_ingredients']   = array_values( array_unique( $on_hand ) );
			$suggestion['missing_ingredients']   = array_values( array_unique( $missing ) );
			$suggestion['pantry_match_count']    = count( $suggestion['on_hand_ingredients'] );
			$suggestion['pantry_missing_count']  = count( $suggestion['missing_ingredients'] );
			$suggestion['preferred_match_count'] = $preferred_matches;
			return $suggestion;
		}, $suggestions );

		usort( $suggestions, static function( array $left, array $right ) use ( $token ): int {
			$meal_cmp = strcmp( (string) ( $left['meal_type'] ?? '' ), (string) ( $right['meal_type'] ?? '' ) );
			if ( 0 !== $meal_cmp ) {
				return $meal_cmp;
			}

			$left_source_priority  = 'admin_library' === ( $left['source'] ?? '' ) ? 1 : 0;
			$right_source_priority = 'admin_library' === ( $right['source'] ?? '' ) ? 1 : 0;
			$source_cmp            = $right_source_priority <=> $left_source_priority;
			if ( 0 !== $source_cmp ) {
				return $source_cmp;
			}

			$preferred_cmp = $right['preferred_match_count'] <=> $left['preferred_match_count'];
			if ( 0 !== $preferred_cmp ) {
				return $preferred_cmp;
			}

			$score_cmp = $right['pantry_match_count'] <=> $left['pantry_match_count'];
			if ( 0 !== $score_cmp ) {
				return $score_cmp;
			}

			$left_hash  = md5( $token . '|' . (string) ( $left['recipe_name'] ?? '' ) );
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
		$variant            = intdiv( $index, 5 );
		$pattern            = $index % 5;
		$breakfast_protein  = self::pool_item( $pools['breakfast_proteins'] ?? [], $variant, 'eggs' );
		$breakfast_carb     = self::pool_item( $pools['breakfast_carbs'] ?? [], $variant + $pattern, 'oats' );
		$lunch_protein      = self::pool_item( $pools['lunch_proteins'] ?? [], $variant + $pattern, 'chicken' );
		$lunch_carb         = self::pool_item( $pools['lunch_carbs'] ?? [], $variant, 'rice' );
		$dinner_protein     = self::pool_item( $pools['dinner_proteins'] ?? [], $variant + $pattern, 'salmon' );
		$dinner_carb        = self::pool_item( $pools['dinner_carbs'] ?? [], $variant, 'potatoes' );
		$snack_protein      = self::pool_item( $pools['snack_proteins'] ?? [], $variant + $pattern, 'greek yogurt' );
		$snack_carb         = self::pool_item( $pools['snack_carbs'] ?? [], $variant, 'apple' );
		$veg_a              = self::pool_item( $pools['vegetables'] ?? [], $variant + $pattern, 'spinach' );
		$veg_b              = self::pool_item( $pools['vegetables'] ?? [], $variant + $pattern + 1, 'broccoli' );
		$flavor             = self::pool_item( $pools['flavors'] ?? [], $variant + $pattern, 'olive oil' );
		$topper             = self::pool_item( $pools['toppers'] ?? [], $variant + $pattern, 'chia seeds' );

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
			'source'              => 'generated',
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

	private static function build_grocery_gap( array $pantry_rows, array $prefs, array $manual_items = [], array $hidden_item_keys = [] ): array {
		$pantry          = array_map( static fn( $row ) => self::normalise_food_name( (string) $row->item_name ), $pantry_rows );
		$hidden_lookup   = array_fill_keys( array_filter( array_map( [ __CLASS__, 'normalise_food_name' ], $hidden_item_keys ) ), true );
		$preferred_foods = array_filter( array_map( 'trim', explode( ',', (string) ( $prefs['food_preferences']['preferred_foods'] ?? '' ) ) ) );
		$common_meals    = array_filter( array_map( 'trim', [
			(string) ( $prefs['common_meals']['breakfasts'] ?? '' ),
			(string) ( $prefs['common_meals']['lunches'] ?? '' ),
		] ) );

		$staples        = array_unique( array_filter( array_merge( [ 'chicken', 'eggs', 'rice', 'oats', 'berries', 'greek yogurt', 'spinach' ], $preferred_foods ) ) );
		$missing        = array_values( array_filter( $staples, static function( $item ) use ( $hidden_lookup, $pantry ): bool {
			$key = self::normalise_food_name( (string) $item );
			return '' !== $key && ! isset( $hidden_lookup[ $key ] ) && ! self::pantry_has_ingredient( $pantry, (string) $item );
		} ) );
		$manual_missing = array_values( array_filter( self::merge_grocery_gap_items( $manual_items ), static function( array $item ) use ( $hidden_lookup, $pantry ): bool {
			$key = self::normalise_food_name( (string) ( $item['item_name'] ?? '' ) );
			return '' !== $key && ! isset( $hidden_lookup[ $key ] ) && ! self::pantry_has_ingredient( $pantry, (string) ( $item['item_name'] ?? '' ) );
		} ) );

		return [
			'missing_items'     => array_slice( $missing, 0, 8 ),
			'manual_items'      => $manual_missing,
			'hidden_item_keys'  => array_values( array_keys( $hidden_lookup ) ),
			'pantry_count'      => count( $pantry ),
			'context'           => [
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

	private static function unique_recipe_ingredients( array $ingredients ): array {
		$unique = [];
		$seen   = [];

		foreach ( $ingredients as $ingredient ) {
			$label      = sanitize_text_field( (string) $ingredient );
			$normalised = self::normalise_food_name( $label );

			if ( '' === $label || '' === $normalised || isset( $seen[ $normalised ] ) ) {
				continue;
			}

			$seen[ $normalised ] = true;
			$unique[]            = $label;
		}

		return array_values( $unique );
	}

	private static function sanitise_pantry_payload( array $input ): array {
		$item_name         = sanitize_text_field( (string) ( $input['item_name'] ?? '' ) );
		$category_override = self::sanitise_pantry_category_override( $input['category_override'] ?? null );
		$unit              = sanitize_text_field( (string) ( $input['unit'] ?? '' ) );
		$expires_on        = sanitize_text_field( (string) ( $input['expires_on'] ?? '' ) );
		$quantity          = null;

		if ( array_key_exists( 'quantity', $input ) && '' !== (string) $input['quantity'] && null !== $input['quantity'] ) {
			$quantity = round( (float) $input['quantity'], 2 );
		}

		return [
			'item_name'         => trim( $item_name ),
			'category_override' => $category_override,
			'quantity'          => $quantity,
			'unit'              => '' !== trim( $unit ) ? trim( $unit ) : null,
			'expires_on'        => '' !== trim( $expires_on ) ? trim( $expires_on ) : null,
		];
	}

	private static function sanitise_pantry_category_override( $value ): ?string {
		$category = sanitize_key( (string) ( $value ?? '' ) );
		$allowed  = [ 'proteins', 'produce', 'dairy-eggs', 'grains', 'staples', 'frozen', 'snacks', 'drinks', 'other' ];

		if ( '' === $category ) {
			return null;
		}

		return in_array( $category, $allowed, true ) ? $category : null;
	}

	private static function sanitise_grocery_gap_payload( array $input ): array {
		$payload = self::sanitise_pantry_payload( $input );
		$notes   = sanitize_text_field( (string) ( $input['notes'] ?? '' ) );

		$payload['notes'] = '' !== trim( $notes ) ? trim( $notes ) : null;

		return $payload;
	}

	private static function merge_pantry_values( array $existing, array $incoming ): array {
		$existing_unit     = isset( $existing['unit'] ) ? trim( (string) $existing['unit'] ) : '';
		$incoming_unit     = isset( $incoming['unit'] ) && null !== $incoming['unit'] ? trim( (string) $incoming['unit'] ) : '';
		$existing_quantity = isset( $existing['quantity'] ) && '' !== (string) $existing['quantity'] ? (float) $existing['quantity'] : null;
		$incoming_quantity = isset( $incoming['quantity'] ) && null !== $incoming['quantity'] ? (float) $incoming['quantity'] : null;
		$unit_pair         = self::resolve_pantry_units_and_quantity( $existing_quantity, $existing_unit, $incoming_quantity, $incoming_unit );

		return [
			'item_name'         => $incoming['item_name'] ?: (string) $existing['item_name'],
			'category_override' => array_key_exists( 'category_override', $incoming ) ? $incoming['category_override'] : ( $existing['category_override'] ?? null ),
			'quantity'          => $unit_pair['quantity'],
			'unit'              => $unit_pair['unit'],
			'expires_on'        => self::merge_pantry_expiry( $existing['expires_on'] ?? null, $incoming['expires_on'] ?? null ),
		];
	}

	private static function merge_grocery_gap_item_values( array $existing, array $incoming ): array {
		$merged          = self::merge_pantry_values( $existing, $incoming );
		$merged['notes'] = ! empty( $incoming['notes'] ) ? $incoming['notes'] : ( $existing['notes'] ?? null );

		return $merged;
	}

	private static function get_manual_grocery_gap_items( int $user_id ): array {
		$stored       = get_user_meta( $user_id, self::GROCERY_GAP_ITEMS_META_KEY, true );
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

	private static function get_hidden_grocery_gap_item_keys( int $user_id ): array {
		$stored       = get_user_meta( $user_id, self::GROCERY_GAP_HIDDEN_ITEMS_META_KEY, true );
		$stored_items = is_array( $stored ) ? $stored : [];

		return array_values( array_filter( array_unique( array_map( [ __CLASS__, 'normalise_food_name' ], $stored_items ) ) ) );
	}

	private static function save_hidden_grocery_gap_item_keys( int $user_id, array $keys ): void {
		$keys = array_values( array_filter( array_unique( array_map( [ __CLASS__, 'normalise_food_name' ], $keys ) ) ) );

		if ( empty( $keys ) ) {
			delete_user_meta( $user_id, self::GROCERY_GAP_HIDDEN_ITEMS_META_KEY );
			return;
		}

		update_user_meta( $user_id, self::GROCERY_GAP_HIDDEN_ITEMS_META_KEY, $keys );
	}

	private static function add_hidden_grocery_gap_item_keys( int $user_id, array $keys ): void {
		$current = self::get_hidden_grocery_gap_item_keys( $user_id );
		self::save_hidden_grocery_gap_item_keys( $user_id, array_merge( $current, $keys ) );
	}

	private static function remove_hidden_grocery_gap_item_keys( int $user_id, array $keys ): void {
		$keys_to_remove = array_fill_keys(
			array_filter( array_map( [ __CLASS__, 'normalise_food_name' ], $keys ) ),
			true
		);

		if ( empty( $keys_to_remove ) ) {
			return;
		}

		$remaining = array_values( array_filter(
			self::get_hidden_grocery_gap_item_keys( $user_id ),
			static fn( string $key ): bool => ! isset( $keys_to_remove[ $key ] )
		) );

		self::save_hidden_grocery_gap_item_keys( $user_id, $remaining );
	}

	private static function get_recipe_cookbook_items( int $user_id ): array {
		self::maybe_migrate_recipe_cookbook_meta_to_table( $user_id );

		global $wpdb;
		$table = $wpdb->prefix . 'fit_recipe_suggestions';
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT recipe_key, meal_type, recipe_name, ingredients_json, instructions_json, estimated_calories,
			        estimated_protein_g, estimated_carbs_g, estimated_fat_g, why_this_works, source
			 FROM {$table}
			 WHERE user_id = %d AND is_cookbook = 1
			 ORDER BY updated_at DESC, id DESC",
			$user_id
		), ARRAY_A );

		return array_values( array_filter( array_map( [ __CLASS__, 'map_recipe_suggestion_row' ], $rows ) ) );
	}

	private static function set_recipe_cookbook_items( int $user_id, array $recipes ): void {
		$recipes = self::sanitize_recipe_cookbook_items( $recipes );
		self::maybe_migrate_recipe_cookbook_meta_to_table( $user_id );

		global $wpdb;
		$table       = $wpdb->prefix . 'fit_recipe_suggestions';
		$recipe_keys = array_values( array_filter( array_map( static fn( array $recipe ): string => (string) ( $recipe['key'] ?? '' ), $recipes ) ) );

		if ( empty( $recipe_keys ) ) {
			$wpdb->delete( $table, [ 'user_id' => $user_id, 'is_cookbook' => 1 ] );
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $recipe_keys ), '%s' ) );
		$params       = array_merge( [ $user_id ], $recipe_keys );
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$table} WHERE user_id = %d AND is_cookbook = 1 AND recipe_key NOT IN ({$placeholders})",
			...$params
		) );

		foreach ( $recipes as $recipe ) {
			$key = (string) ( $recipe['key'] ?? '' );
			if ( '' === $key ) {
				continue;
			}

			$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND recipe_key = %s AND is_cookbook = 1 ORDER BY id DESC LIMIT 1",
				$user_id,
				$key
			) );
			$payload     = self::recipe_suggestion_db_payload( $user_id, $recipe, 1 );

			if ( $existing_id > 0 ) {
				$wpdb->update( $table, $payload, [ 'id' => $existing_id ] );
				continue;
			}

			$wpdb->insert( $table, $payload );
		}
	}

	private static function sync_recipe_cookbook_missing_ingredients_to_grocery_gap( int $user_id, array $recipes ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$pantry_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT item_name FROM {$p}fit_pantry_items WHERE user_id = %d ORDER BY item_name",
			$user_id
		) );
		$pantry_items = array_values( array_filter( array_map(
			static fn( $row ): string => self::normalise_food_name( (string) ( is_object( $row ) ? ( $row->item_name ?? '' ) : ( $row['item_name'] ?? '' ) ) ),
			is_array( $pantry_rows ) ? $pantry_rows : []
		) ) );

		$items_by_key = [];
		foreach ( self::get_manual_grocery_gap_items( $user_id ) as $item ) {
			$key = self::normalise_food_name( (string) ( $item['item_name'] ?? '' ) );
			if ( '' === $key ) {
				continue;
			}

			$items_by_key[ $key ] = $item;
		}

		foreach ( $recipes as $recipe ) {
			$raw_ingredients = ! empty( $recipe['missing_ingredients'] ) ? (array) $recipe['missing_ingredients'] : (array) ( $recipe['ingredients'] ?? [] );
			foreach ( self::unique_recipe_ingredients( $raw_ingredients ) as $ingredient ) {
				$key = self::normalise_food_name( $ingredient );
				if ( '' === $key || self::pantry_has_ingredient( $pantry_items, $ingredient ) ) {
					continue;
				}

				if ( isset( $items_by_key[ $key ] ) ) {
					continue;
				}

				$items_by_key[ $key ] = self::sanitise_grocery_gap_payload( [
					'item_name' => $ingredient,
				] );
			}
		}

		self::save_manual_grocery_gap_items( $user_id, array_values( $items_by_key ) );
	}

	private static function maybe_migrate_recipe_cookbook_meta_to_table( int $user_id ): void {
		$stored = get_user_meta( $user_id, self::RECIPE_COOKBOOK_META_KEY, true );
		$stored = is_array( $stored ) ? $stored : [];

		if ( empty( $stored ) ) {
			return;
		}

		global $wpdb;
		$table          = $wpdb->prefix . 'fit_recipe_suggestions';
		$existing_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND is_cookbook = 1",
			$user_id
		) );

		if ( $existing_count <= 0 ) {
			$this_turn_recipes = self::sanitize_recipe_cookbook_items( $stored );
			foreach ( $this_turn_recipes as $recipe ) {
				$wpdb->insert( $table, self::recipe_suggestion_db_payload( $user_id, $recipe, 1 ) );
			}
		}

		delete_user_meta( $user_id, self::RECIPE_COOKBOOK_META_KEY );
	}

	private static function sanitize_recipe_cookbook_items( array $recipes ): array {
		$sanitized = [];
		$seen      = [];

		foreach ( $recipes as $recipe ) {
			if ( ! is_array( $recipe ) ) {
				continue;
			}

			$recipe_name = sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) );
			if ( '' === $recipe_name ) {
				continue;
			}

			$key = sanitize_title( (string) ( $recipe['key'] ?? '' ) );
			if ( '' === $key ) {
				$key = sanitize_title(
					( sanitize_key( (string) ( $recipe['meal_type'] ?? 'meal' ) ) ?: 'meal' ) . '-' . $recipe_name
				);
			}

			if ( isset( $seen[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$sanitized[]  = [
				'key'                 => $key,
				'recipe_name'         => $recipe_name,
				'meal_type'           => sanitize_key( (string) ( $recipe['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
				'ingredients'         => self::unique_recipe_ingredients( (array) ( $recipe['ingredients'] ?? [] ) ),
				'instructions'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['instructions'] ?? [] ) ) ) ),
				'estimated_calories'  => (int) ( $recipe['estimated_calories'] ?? 0 ),
				'estimated_protein_g' => round( (float) ( $recipe['estimated_protein_g'] ?? 0 ), 2 ),
				'estimated_carbs_g'   => round( (float) ( $recipe['estimated_carbs_g'] ?? 0 ), 2 ),
				'estimated_fat_g'     => round( (float) ( $recipe['estimated_fat_g'] ?? 0 ), 2 ),
				'why_this_works'      => sanitize_text_field( (string) ( $recipe['why_this_works'] ?? '' ) ),
				'source'              => sanitize_key( (string) ( $recipe['source'] ?? '' ) ) ?: 'generated',
				'on_hand_ingredients' => self::unique_recipe_ingredients( (array) ( $recipe['on_hand_ingredients'] ?? [] ) ),
				'missing_ingredients' => self::unique_recipe_ingredients( (array) ( $recipe['missing_ingredients'] ?? [] ) ),
			];
		}

		return $sanitized;
	}

	private static function recipe_suggestion_db_payload( int $user_id, array $recipe, int $is_cookbook = 0 ): array {
		$recipe = self::sanitize_recipe_cookbook_items( [ $recipe ] );
		$recipe = $recipe[0] ?? [];

		return [
			'user_id'             => $user_id,
			'recipe_key'          => (string) ( $recipe['key'] ?? '' ),
			'meal_type'           => (string) ( $recipe['meal_type'] ?? 'lunch' ),
			'recipe_name'         => (string) ( $recipe['recipe_name'] ?? '' ),
			'ingredients_json'    => wp_json_encode( (array) ( $recipe['ingredients'] ?? [] ) ),
			'instructions_json'   => wp_json_encode( (array) ( $recipe['instructions'] ?? [] ) ),
			'estimated_calories'  => (int) ( $recipe['estimated_calories'] ?? 0 ),
			'estimated_protein_g' => (float) ( $recipe['estimated_protein_g'] ?? 0 ),
			'estimated_carbs_g'   => (float) ( $recipe['estimated_carbs_g'] ?? 0 ),
			'estimated_fat_g'     => (float) ( $recipe['estimated_fat_g'] ?? 0 ),
			'why_this_works'      => (string) ( $recipe['why_this_works'] ?? '' ),
			'source'              => (string) ( $recipe['source'] ?? 'generated' ),
			'is_cookbook'         => $is_cookbook ? 1 : 0,
			'fits_goal'           => 1,
		];
	}

	private static function map_recipe_suggestion_row( array $row ): array {
		return [
			'key'                 => sanitize_title( (string) ( $row['recipe_key'] ?? '' ) ),
			'recipe_name'         => sanitize_text_field( (string) ( $row['recipe_name'] ?? '' ) ),
			'meal_type'           => sanitize_key( (string) ( $row['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
			'ingredients'         => self::unique_recipe_ingredients( (array) json_decode( (string) ( $row['ingredients_json'] ?? '[]' ), true ) ),
			'instructions'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) json_decode( (string) ( $row['instructions_json'] ?? '[]' ), true ) ) ) ),
			'estimated_calories'  => (int) ( $row['estimated_calories'] ?? 0 ),
			'estimated_protein_g' => round( (float) ( $row['estimated_protein_g'] ?? 0 ), 2 ),
			'estimated_carbs_g'   => round( (float) ( $row['estimated_carbs_g'] ?? 0 ), 2 ),
			'estimated_fat_g'     => round( (float) ( $row['estimated_fat_g'] ?? 0 ), 2 ),
			'why_this_works'      => sanitize_text_field( (string) ( $row['why_this_works'] ?? '' ) ),
			'source'              => sanitize_key( (string) ( $row['source'] ?? '' ) ) ?: 'generated',
		];
	}

	private static function merge_grocery_gap_items( array $items ): array {
		$items_by_key = [];

		foreach ( $items as $item ) {
			$payload = self::sanitise_grocery_gap_payload( (array) $item );
			$key     = self::normalise_food_name( (string) $payload['item_name'] );

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
			$left_in_pantry  = self::pantry_has_ingredient( $pantry, $left );
			$right_in_pantry = self::pantry_has_ingredient( $pantry, $right );

			if ( $left_in_pantry !== $right_in_pantry ) {
				return $left_in_pantry ? -1 : 1;
			}

			return strcmp( md5( $token . '|' . $left ), md5( $token . '|' . $right ) );
		} );

		return array_values( array_unique( $candidates ) );
	}
}
