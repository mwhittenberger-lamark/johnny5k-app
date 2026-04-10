<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Resolves detected foods against USDA FoodData Central and scales nutrients
 * using AI-estimated gram weights.
 */
class NutritionSourceService {

	private const SEARCH_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';
	private const DETAIL_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/food/';
	private const DEMO_API_KEY    = 'DEMO_KEY';
	private const REQUEST_TIMEOUT = 20;

	private const DATA_TYPE_SCORES = [
		'Foundation'      => 18,
		'SR Legacy'       => 16,
		'Survey (FNDDS)'  => 14,
		'Branded'         => 8,
		'Experimental'    => 6,
	];

	public static function enrich_meal_analysis( array $analysis ): array {
		$items = [];
		$totals = [
			'total_calories'  => 0,
			'total_protein_g' => 0.0,
			'total_carbs_g'   => 0.0,
			'total_fat_g'     => 0.0,
		];

		foreach ( (array) ( $analysis['items'] ?? [] ) as $item ) {
			$resolved = self::resolve_item( (array) $item );
			$items[] = $resolved;
			$totals['total_calories']  += (int) ( $resolved['calories'] ?? 0 );
			$totals['total_protein_g'] += (float) ( $resolved['protein_g'] ?? 0 );
			$totals['total_carbs_g']   += (float) ( $resolved['carbs_g'] ?? 0 );
			$totals['total_fat_g']     += (float) ( $resolved['fat_g'] ?? 0 );
		}

		$analysis['items'] = $items;
		$analysis['total_calories']  = (int) round( $totals['total_calories'] );
		$analysis['total_protein_g'] = round( $totals['total_protein_g'], 2 );
		$analysis['total_carbs_g']   = round( $totals['total_carbs_g'], 2 );
		$analysis['total_fat_g']     = round( $totals['total_fat_g'], 2 );

		return $analysis;
	}

	public static function enrich_food_analysis( array $analysis ): array {
		$item = self::resolve_item( [
			'food_name'          => (string) ( $analysis['food_name'] ?? '' ),
			'brand'              => (string) ( $analysis['brand'] ?? '' ),
			'serving_amount'     => 1,
			'serving_unit'       => (string) ( $analysis['serving_size'] ?? 'serving' ),
			'estimated_grams'    => isset( $analysis['serving_grams'] ) ? (float) $analysis['serving_grams'] : 0,
			'portion_description'=> (string) ( $analysis['serving_size'] ?? '' ),
			'calories'           => (float) ( $analysis['calories'] ?? 0 ),
			'protein_g'          => (float) ( $analysis['protein_g'] ?? 0 ),
			'carbs_g'            => (float) ( $analysis['carbs_g'] ?? 0 ),
			'fat_g'              => (float) ( $analysis['fat_g'] ?? 0 ),
			'fiber_g'            => (float) ( $analysis['fiber_g'] ?? 0 ),
			'sugar_g'            => (float) ( $analysis['sugar_g'] ?? 0 ),
			'sodium_mg'          => (float) ( $analysis['sodium_mg'] ?? 0 ),
			'micros'             => is_array( $analysis['micros'] ?? null ) ? $analysis['micros'] : [],
			'food_confidence'    => (float) ( $analysis['confidence'] ?? 0 ),
			'portion_confidence' => (float) ( $analysis['confidence'] ?? 0 ),
		] );

		$analysis['food_name'] = (string) ( $item['food_name'] ?? $analysis['food_name'] ?? '' );
		$analysis['serving_size'] = trim( sprintf(
			'%s %s',
			rtrim( rtrim( (string) ( $item['serving_amount'] ?? 1 ), '0' ), '.' ),
			(string) ( $item['serving_unit'] ?? $analysis['serving_size'] ?? 'serving' )
		) );
		$analysis['serving_grams'] = round( (float) ( $item['estimated_grams'] ?? 0 ), 2 );
		$analysis['calories'] = (int) ( $item['calories'] ?? $analysis['calories'] ?? 0 );
		$analysis['protein_g'] = round( (float) ( $item['protein_g'] ?? $analysis['protein_g'] ?? 0 ), 2 );
		$analysis['carbs_g'] = round( (float) ( $item['carbs_g'] ?? $analysis['carbs_g'] ?? 0 ), 2 );
		$analysis['fat_g'] = round( (float) ( $item['fat_g'] ?? $analysis['fat_g'] ?? 0 ), 2 );
		$analysis['fiber_g'] = round( (float) ( $item['fiber_g'] ?? $analysis['fiber_g'] ?? 0 ), 2 );
		$analysis['sugar_g'] = round( (float) ( $item['sugar_g'] ?? $analysis['sugar_g'] ?? 0 ), 2 );
		$analysis['sodium_mg'] = round( (float) ( $item['sodium_mg'] ?? $analysis['sodium_mg'] ?? 0 ), 2 );
		$analysis['source'] = $item['source'] ?? null;

		return $analysis;
	}

	private static function resolve_item( array $item ): array {
		$item = self::normalise_item_defaults( $item );
		$food_name = trim( (string) ( $item['food_name'] ?? '' ) );

		if ( '' === $food_name ) {
			return $item;
		}

		$candidates = self::search_food_candidates( $food_name );
		if ( empty( $candidates ) ) {
			$item['source'] = self::build_unresolved_source( $item, 'no_match' );
			return $item;
		}

		$best_candidate = self::pick_best_candidate( $food_name, $item, $candidates );
		if ( empty( $best_candidate['fdcId'] ) ) {
			$item['source'] = self::build_unresolved_source( $item, 'no_match' );
			return $item;
		}

		$details = self::get_food_details( (int) $best_candidate['fdcId'] );
		if ( empty( $details ) ) {
			$item['source'] = self::build_unresolved_source( $item, 'detail_lookup_failed', $best_candidate );
			return $item;
		}

		$per_100g = self::extract_per_100g_nutrients( $details );
		$estimated_grams = self::resolve_item_grams( $item, $details, $best_candidate );
		$scaled = self::scale_per_100g_nutrients( $per_100g, $estimated_grams );

		$item['calories'] = $scaled['calories'];
		$item['protein_g'] = $scaled['protein_g'];
		$item['carbs_g'] = $scaled['carbs_g'];
		$item['fat_g'] = $scaled['fat_g'];
		$item['fiber_g'] = $scaled['fiber_g'];
		$item['sugar_g'] = $scaled['sugar_g'];
		$item['sodium_mg'] = $scaled['sodium_mg'];
		$item['estimated_grams'] = $estimated_grams;
		$item['source'] = [
			'type'                   => 'usda',
			'provider'               => 'usda',
			'fdc_id'                 => (int) $best_candidate['fdcId'],
			'matched_name'           => (string) ( $details['description'] ?? $best_candidate['description'] ?? $food_name ),
			'brand'                  => (string) ( $details['brandOwner'] ?? $best_candidate['brandOwner'] ?? '' ),
			'data_type'              => (string) ( $details['dataType'] ?? $best_candidate['dataType'] ?? '' ),
			'query'                  => $food_name,
			'serving_amount'         => (float) $item['serving_amount'],
			'serving_unit'           => (string) $item['serving_unit'],
			'estimated_grams'        => round( $estimated_grams, 2 ),
			'portion_description'    => (string) ( $item['portion_description'] ?? '' ),
			'food_confidence'        => (float) ( $item['food_confidence'] ?? 0 ),
			'portion_confidence'     => (float) ( $item['portion_confidence'] ?? 0 ),
			'reference_serving_grams'=> self::extract_reference_serving_grams( $details ),
			'per_100g'               => $per_100g,
		];

		return $item;
	}

	private static function normalise_item_defaults( array $item ): array {
		return [
			'food_name'            => sanitize_text_field( (string) ( $item['food_name'] ?? 'Food item' ) ),
			'serving_amount'       => max( 0.1, (float) ( $item['serving_amount'] ?? 1 ) ),
			'serving_unit'         => sanitize_text_field( (string) ( $item['serving_unit'] ?? 'serving' ) ),
			'estimated_grams'      => isset( $item['estimated_grams'] ) ? max( 0, (float) $item['estimated_grams'] ) : 0,
			'portion_description'  => sanitize_text_field( (string) ( $item['portion_description'] ?? '' ) ),
			'food_confidence'      => max( 0, min( 1, (float) ( $item['food_confidence'] ?? 0 ) ) ),
			'portion_confidence'   => max( 0, min( 1, (float) ( $item['portion_confidence'] ?? 0 ) ) ),
			'calories'             => (int) round( (float) ( $item['calories'] ?? 0 ) ),
			'protein_g'            => round( (float) ( $item['protein_g'] ?? 0 ), 2 ),
			'carbs_g'              => round( (float) ( $item['carbs_g'] ?? 0 ), 2 ),
			'fat_g'                => round( (float) ( $item['fat_g'] ?? 0 ), 2 ),
			'fiber_g'              => round( (float) ( $item['fiber_g'] ?? 0 ), 2 ),
			'sugar_g'              => round( (float) ( $item['sugar_g'] ?? 0 ), 2 ),
			'sodium_mg'            => round( (float) ( $item['sodium_mg'] ?? 0 ), 2 ),
			'micros'               => ! empty( $item['micros'] ) && is_array( $item['micros'] ) ? array_values( $item['micros'] ) : [],
			'notes'                => sanitize_text_field( (string) ( $item['notes'] ?? '' ) ),
			'source'               => is_array( $item['source'] ?? null ) ? $item['source'] : null,
		];
	}

	private static function build_unresolved_source( array $item, string $reason, array $candidate = [] ): array {
		return [
			'type'                => 'ai_estimate',
			'provider'            => 'openai',
			'resolution_status'   => $reason,
			'query'               => (string) ( $item['food_name'] ?? '' ),
			'matched_name'        => (string) ( $candidate['description'] ?? '' ),
			'data_type'           => (string) ( $candidate['dataType'] ?? '' ),
			'estimated_grams'     => round( (float) ( $item['estimated_grams'] ?? 0 ), 2 ),
			'portion_description' => (string) ( $item['portion_description'] ?? '' ),
			'food_confidence'     => (float) ( $item['food_confidence'] ?? 0 ),
			'portion_confidence'  => (float) ( $item['portion_confidence'] ?? 0 ),
		];
	}

	private static function search_food_candidates( string $query ): array {
		$response = wp_remote_post(
			self::SEARCH_ENDPOINT . '?api_key=' . rawurlencode( self::get_api_key() ),
			[
				'headers' => [ 'Content-Type' => 'application/json' ],
				'timeout' => self::REQUEST_TIMEOUT,
				'body'    => wp_json_encode( [
					'query'             => $query,
					'pageSize'          => 8,
					'requireAllWords'   => false,
				] ),
			]
		);

		if ( is_wp_error( $response ) ) {
			return [];
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( wp_remote_retrieve_response_code( $response ) !== 200 || empty( $body['foods'] ) || ! is_array( $body['foods'] ) ) {
			return [];
		}

		return array_values( array_filter( $body['foods'], static fn( $food ) => ! empty( $food['fdcId'] ) && ! empty( $food['description'] ) ) );
	}

	private static function pick_best_candidate( string $query, array $item, array $candidates ): array {
		$query_normalized = self::normalise_food_phrase( $query );
		$brand_query = self::normalise_text( (string) ( $item['brand'] ?? '' ) );
		$scored = [];

		foreach ( $candidates as $candidate ) {
			$description = (string) ( $candidate['description'] ?? '' );
			$normalized_description = self::normalise_food_phrase( $description );
			if ( ! self::is_exact_candidate_match( $query_normalized, $normalized_description ) ) {
				continue;
			}
			$data_type = (string) ( $candidate['dataType'] ?? '' );
			$score = self::DATA_TYPE_SCORES[ $data_type ] ?? 0;

			if ( $normalized_description === $query_normalized ) {
				$score += 90;
			} elseif ( str_starts_with( $normalized_description, $query_normalized . ' ' ) ) {
				$score += 60;
			}

			$brand_owner = self::normalise_text( (string) ( $candidate['brandOwner'] ?? '' ) );
			if ( '' !== $brand_query && '' !== $brand_owner && str_contains( $brand_owner, $brand_query ) ) {
				$score += 18;
			}

			$scored[] = [
				'score'     => $score,
				'candidate' => $candidate,
			];
		}

		usort( $scored, static fn( array $left, array $right ) => $right['score'] <=> $left['score'] );

		return $scored[0]['candidate'] ?? [];
	}

	private static function is_exact_candidate_match( string $query_normalized, string $candidate_normalized ): bool {
		if ( '' === $query_normalized || '' === $candidate_normalized ) {
			return false;
		}

		if ( $candidate_normalized === $query_normalized ) {
			return true;
		}

		return str_starts_with( $candidate_normalized, $query_normalized . ' ' );
	}

	private static function get_food_details( int $fdc_id ): array {
		if ( $fdc_id <= 0 ) {
			return [];
		}

		$response = wp_remote_get(
			self::DETAIL_ENDPOINT . $fdc_id . '?api_key=' . rawurlencode( self::get_api_key() ),
			[
				'timeout' => self::REQUEST_TIMEOUT,
			]
		);

		if ( is_wp_error( $response ) ) {
			return [];
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( wp_remote_retrieve_response_code( $response ) !== 200 || ! is_array( $body ) ) {
			return [];
		}

		return $body;
	}

	private static function extract_per_100g_nutrients( array $details ): array {
		$data_type = (string) ( $details['dataType'] ?? '' );
		$reference_grams = self::extract_reference_serving_grams( $details );
		$branded = 'Branded' === $data_type && $reference_grams > 0;

		$label_nutrients = is_array( $details['labelNutrients'] ?? null ) ? $details['labelNutrients'] : [];
		if ( $branded && ! empty( $label_nutrients ) ) {
			$per_serving = [
				'calories'  => (float) ( $label_nutrients['calories']['value'] ?? $label_nutrients['calories'] ?? 0 ),
				'protein_g' => (float) ( $label_nutrients['protein']['value'] ?? $label_nutrients['protein'] ?? 0 ),
				'carbs_g'   => (float) ( $label_nutrients['carbohydrates']['value'] ?? $label_nutrients['carbohydrates'] ?? 0 ),
				'fat_g'     => (float) ( $label_nutrients['fat']['value'] ?? $label_nutrients['fat'] ?? 0 ),
				'fiber_g'   => (float) ( $label_nutrients['fiber']['value'] ?? $label_nutrients['fiber'] ?? 0 ),
				'sugar_g'   => (float) ( $label_nutrients['sugars']['value'] ?? $label_nutrients['sugars'] ?? 0 ),
				'sodium_mg' => (float) ( $label_nutrients['sodium']['value'] ?? $label_nutrients['sodium'] ?? 0 ),
			];

			return self::convert_serving_nutrients_to_per_100g( $per_serving, $reference_grams );
		}

		$nutrients = [
			'calories'  => 0.0,
			'protein_g' => 0.0,
			'carbs_g'   => 0.0,
			'fat_g'     => 0.0,
			'fiber_g'   => 0.0,
			'sugar_g'   => 0.0,
			'sodium_mg' => 0.0,
		];

		foreach ( (array) ( $details['foodNutrients'] ?? [] ) as $entry ) {
			$name = self::normalise_text(
				(string) (
					$entry['nutrient']['name']
					?? $entry['nutrientName']
					?? ''
				)
			);
			$number = (string) (
				$entry['nutrient']['number']
				?? $entry['nutrientNumber']
				?? ''
			);
			$amount = isset( $entry['amount'] ) ? (float) $entry['amount'] : null;

			if ( null === $amount ) {
				continue;
			}

			if ( '1008' === $number || str_contains( $name, 'energy' ) ) {
				$nutrients['calories'] = max( $nutrients['calories'], $amount );
			} elseif ( '1003' === $number || str_contains( $name, 'protein' ) ) {
				$nutrients['protein_g'] = $amount;
			} elseif ( '1005' === $number || str_contains( $name, 'carbohydrate' ) ) {
				$nutrients['carbs_g'] = $amount;
			} elseif ( '1004' === $number || str_contains( $name, 'total lipid' ) || str_contains( $name, 'total fat' ) ) {
				$nutrients['fat_g'] = $amount;
			} elseif ( '1079' === $number || str_contains( $name, 'fiber' ) ) {
				$nutrients['fiber_g'] = $amount;
			} elseif ( '2000' === $number || str_contains( $name, 'sugars, total' ) ) {
				$nutrients['sugar_g'] = $amount;
			} elseif ( '1093' === $number || str_contains( $name, 'sodium' ) ) {
				$nutrients['sodium_mg'] = $amount;
			}
		}

		return [
			'calories'  => round( $nutrients['calories'], 2 ),
			'protein_g' => round( $nutrients['protein_g'], 2 ),
			'carbs_g'   => round( $nutrients['carbs_g'], 2 ),
			'fat_g'     => round( $nutrients['fat_g'], 2 ),
			'fiber_g'   => round( $nutrients['fiber_g'], 2 ),
			'sugar_g'   => round( $nutrients['sugar_g'], 2 ),
			'sodium_mg' => round( $nutrients['sodium_mg'], 2 ),
		];
	}

	private static function resolve_item_grams( array $item, array $details, array $candidate ): float {
		$estimated_grams = (float) ( $item['estimated_grams'] ?? 0 );
		if ( $estimated_grams > 0 ) {
			return round( $estimated_grams, 2 );
		}

		$reference_serving_grams = self::extract_reference_serving_grams( $details );
		if ( $reference_serving_grams > 0 ) {
			return round( max( 0.1, (float) ( $item['serving_amount'] ?? 1 ) ) * $reference_serving_grams, 2 );
		}

		$candidate_serving_size = (float) ( $candidate['servingSize'] ?? 0 );
		$candidate_serving_unit = strtolower( trim( (string) ( $candidate['servingSizeUnit'] ?? '' ) ) );
		if ( $candidate_serving_size > 0 && in_array( $candidate_serving_unit, [ 'g', 'gm', 'gram', 'grams' ], true ) ) {
			return round( max( 0.1, (float) ( $item['serving_amount'] ?? 1 ) ) * $candidate_serving_size, 2 );
		}

		return round( max( 0.1, (float) ( $item['serving_amount'] ?? 1 ) ) * 100, 2 );
	}

	private static function extract_reference_serving_grams( array $details ): float {
		$serving_size = (float) ( $details['servingSize'] ?? 0 );
		$serving_size_unit = strtolower( trim( (string) ( $details['servingSizeUnit'] ?? '' ) ) );

		if ( $serving_size > 0 && in_array( $serving_size_unit, [ 'g', 'gm', 'gram', 'grams', 'ml', 'milliliter', 'milliliters' ], true ) ) {
			return round( $serving_size, 2 );
		}

		return 0.0;
	}

	private static function scale_per_100g_nutrients( array $per_100g, float $grams ): array {
		$factor = max( 0, $grams ) / 100;

		return [
			'calories'  => (int) round( (float) ( $per_100g['calories'] ?? 0 ) * $factor ),
			'protein_g' => round( (float) ( $per_100g['protein_g'] ?? 0 ) * $factor, 2 ),
			'carbs_g'   => round( (float) ( $per_100g['carbs_g'] ?? 0 ) * $factor, 2 ),
			'fat_g'     => round( (float) ( $per_100g['fat_g'] ?? 0 ) * $factor, 2 ),
			'fiber_g'   => round( (float) ( $per_100g['fiber_g'] ?? 0 ) * $factor, 2 ),
			'sugar_g'   => round( (float) ( $per_100g['sugar_g'] ?? 0 ) * $factor, 2 ),
			'sodium_mg' => round( (float) ( $per_100g['sodium_mg'] ?? 0 ) * $factor, 2 ),
		];
	}

	private static function convert_serving_nutrients_to_per_100g( array $per_serving, float $serving_grams ): array {
		$factor = $serving_grams > 0 ? 100 / $serving_grams : 0;

		return [
			'calories'  => round( (float) ( $per_serving['calories'] ?? 0 ) * $factor, 2 ),
			'protein_g' => round( (float) ( $per_serving['protein_g'] ?? 0 ) * $factor, 2 ),
			'carbs_g'   => round( (float) ( $per_serving['carbs_g'] ?? 0 ) * $factor, 2 ),
			'fat_g'     => round( (float) ( $per_serving['fat_g'] ?? 0 ) * $factor, 2 ),
			'fiber_g'   => round( (float) ( $per_serving['fiber_g'] ?? 0 ) * $factor, 2 ),
			'sugar_g'   => round( (float) ( $per_serving['sugar_g'] ?? 0 ) * $factor, 2 ),
			'sodium_mg' => round( (float) ( $per_serving['sodium_mg'] ?? 0 ) * $factor, 2 ),
		];
	}

	private static function normalise_text( string $value ): string {
		$value = strtolower( trim( $value ) );
		$value = preg_replace( '/[^a-z0-9 ]+/', ' ', $value ) ?: '';
		$value = preg_replace( '/\s+/', ' ', $value ) ?: '';

		return trim( $value );
	}

	private static function normalise_food_phrase( string $value ): string {
		$tokens = array_values( array_filter( explode( ' ', self::normalise_text( $value ) ) ) );
		$tokens = array_values( array_filter( array_map( static function( string $token ): string {
			$singular = self::singularize_token( $token );
			return self::is_stop_token( $singular ) ? '' : $singular;
		}, $tokens ) ) );

		return implode( ' ', $tokens );
	}

	private static function singularize_token( string $token ): string {
		$value = trim( $token );
		if ( strlen( $value ) <= 3 ) {
			return $value;
		}
		if ( str_ends_with( $value, 'ies' ) && strlen( $value ) > 4 ) {
			return substr( $value, 0, -3 ) . 'y';
		}
		if ( str_ends_with( $value, 'es' ) && strlen( $value ) > 4 ) {
			return substr( $value, 0, -2 );
		}
		if ( str_ends_with( $value, 's' ) && ! str_ends_with( $value, 'ss' ) ) {
			return substr( $value, 0, -1 );
		}
		return $value;
	}

	private static function is_stop_token( string $token ): bool {
		return in_array( $token, [ 'a', 'an', 'the', 'of', 'and', 'with' ], true );
	}

	private static function get_api_key(): string {
		$key = trim( (string) get_option( 'jf_usda_api_key', '' ) );
		return '' !== $key ? $key : self::DEMO_API_KEY;
	}
}
