<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceLabelAnalysisTest extends ServiceTestCase {
	public function test_normalise_label_analysis_sanitizes_and_rounds_fields(): void {
		$parsed = $this->invokePrivateStatic(
			AiService::class,
			'normalise_label_analysis',
			[
				[
					'product_name' => ' Crunch Bar <script> ',
					'brand' => ' SnackCo ',
					'serving_size' => '1 bar',
					'calories' => '219.6',
					'protein_g' => '12.345',
					'carbs_g' => '25.678',
					'fat_g' => '7.444',
					'fiber_g' => '4.444',
					'sugar_g' => '9.991',
					'sodium_mg' => '280.556',
					'fit_summary' => ' Useful around training. ',
					'flags' => [ ' high sodium ', '', '<b>processed</b>' ],
					'swap_suggestions' => [
						[ 'title' => ' Lower sugar ', 'body' => ' Pick the unsweetened box. ' ],
						[ 'title' => '', 'body' => 'Ignored' ],
					],
					'micros' => [
						[ 'key' => 'iron', 'label' => 'Iron', 'amount' => '8.555', 'unit' => 'mg' ],
					],
				],
			]
		);

		self::assertSame( 'Crunch Bar', $parsed['food_name'] );
		self::assertSame( 'SnackCo', $parsed['brand'] );
		self::assertSame( '1 bar', $parsed['serving_size'] );
		self::assertSame( 220, $parsed['calories'] );
		self::assertSame( 12.35, $parsed['protein_g'] );
		self::assertSame( 25.68, $parsed['carbs_g'] );
		self::assertSame( 7.44, $parsed['fat_g'] );
		self::assertSame( 4.44, $parsed['fiber_g'] );
		self::assertSame( 9.99, $parsed['sugar_g'] );
		self::assertSame( 280.56, $parsed['sodium_mg'] );
		self::assertSame( 'Useful around training.', $parsed['fit_summary'] );
		self::assertSame( [ 'high sodium', 'processed' ], $parsed['flags'] );
		self::assertSame(
			[
				[ 'title' => 'Lower sugar', 'body' => 'Pick the unsweetened box.' ],
			],
			$parsed['swap_suggestions']
		);
		self::assertSame( 'iron', $parsed['micros'][0]['key'] );
		self::assertSame( 8.56, $parsed['micros'][0]['amount'] );
	}

	public function test_normalise_label_analysis_keeps_missing_numbers_null(): void {
		$parsed = $this->invokePrivateStatic(
			AiService::class,
			'normalise_label_analysis',
			[
				[
					'name' => 'Mystery Snack',
					'calories' => '',
					'protein_g' => 'not-a-number',
					'carbs_g' => null,
					'fat_g' => '',
					'fiber_g' => '',
					'sugar_g' => '',
					'sodium_mg' => '',
				],
			]
		);

		self::assertSame( 'Mystery Snack', $parsed['food_name'] );
		self::assertNull( $parsed['calories'] );
		self::assertNull( $parsed['protein_g'] );
		self::assertNull( $parsed['carbs_g'] );
		self::assertNull( $parsed['fat_g'] );
		self::assertNull( $parsed['fiber_g'] );
		self::assertNull( $parsed['sugar_g'] );
		self::assertNull( $parsed['sodium_mg'] );
	}
}