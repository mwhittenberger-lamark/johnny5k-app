<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\NutritionSourceService;
use Johnny5k\Tests\Support\ServiceTestCase;

class NutritionSourceServiceTest extends ServiceTestCase {
	private function queueUsdaLookup( array $foodNutrients, array $overrides = [] ): void {
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'foods' => [
					[ 'fdcId' => 173944, 'description' => 'Grapes, red or green', 'dataType' => 'SR Legacy' ],
				],
			] ),
		] );
		$this->queueHttpGetResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( array_merge( [
				'fdcId' => 173944,
				'description' => 'Grapes, red or green',
				'dataType' => 'SR Legacy',
				'foodNutrients' => $foodNutrients,
			], $overrides ) ),
		] );
	}

	public function test_energy_in_kilojoules_does_not_overwrite_the_kilocalorie_value(): void {
		// FoodData Central lists "Energy" twice per food — once in kcal, once in kJ.
		// A name-only match with max() previously picked whichever number was larger,
		// which is always the ~4.18x-too-high kJ entry.
		$this->queueUsdaLookup( [
			[ 'nutrient' => [ 'number' => '208', 'name' => 'Energy', 'unitName' => 'kcal' ], 'amount' => 89.0 ],
			[ 'nutrient' => [ 'number' => '268', 'name' => 'Energy', 'unitName' => 'kJ' ], 'amount' => 371.0 ],
			[ 'nutrient' => [ 'number' => '203', 'name' => 'Protein', 'unitName' => 'g' ], 'amount' => 1.09 ],
			[ 'nutrient' => [ 'number' => '204', 'name' => 'Total lipid (fat)', 'unitName' => 'g' ], 'amount' => 0.33 ],
			[ 'nutrient' => [ 'number' => '205', 'name' => 'Carbohydrate, by difference', 'unitName' => 'g' ], 'amount' => 22.84 ],
			[ 'nutrient' => [ 'number' => '269', 'name' => 'Total Sugars', 'unitName' => 'g' ], 'amount' => 12.23 ],
			[ 'nutrient' => [ 'number' => '307', 'name' => 'Sodium, Na', 'unitName' => 'mg' ], 'amount' => 1.0 ],
		] );

		$result = NutritionSourceService::enrich_meal_analysis( [
			'items' => [ [ 'food_name' => 'grapes', 'serving_amount' => 1, 'estimated_grams' => 100 ] ],
		] );

		$item = $result['items'][0];
		$this->assertSame( 89, $item['calories'], 'calories should use the kcal entry, not the ~4.18x-larger kJ entry' );
		$this->assertSame( 1.09, $item['protein_g'] );
		$this->assertSame( 22.84, $item['carbs_g'] );
		$this->assertSame( 0.33, $item['fat_g'] );
		$this->assertSame( 12.23, $item['sugar_g'], 'sugar should resolve from "Total Sugars", not stay at 0' );
		$this->assertSame( 1.0, $item['sodium_mg'] );
		$this->assertSame( 89, $result['total_calories'] );
	}

	public function test_scales_nutrients_to_the_estimated_portion_grams(): void {
		$this->queueUsdaLookup( [
			[ 'nutrient' => [ 'number' => '208', 'name' => 'Energy', 'unitName' => 'kcal' ], 'amount' => 200.0 ],
			[ 'nutrient' => [ 'number' => '268', 'name' => 'Energy', 'unitName' => 'kJ' ], 'amount' => 836.8 ],
		] );

		$result = NutritionSourceService::enrich_meal_analysis( [
			'items' => [ [ 'food_name' => 'grapes', 'serving_amount' => 1, 'estimated_grams' => 50 ] ],
		] );

		$this->assertSame( 100, $result['items'][0]['calories'], 'a 50g portion of a 200 kcal/100g food should be 100 kcal' );
	}
}
