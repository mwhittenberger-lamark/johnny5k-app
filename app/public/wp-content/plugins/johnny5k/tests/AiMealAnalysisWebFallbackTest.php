<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiMealAnalysisWebFallbackTest extends ServiceTestCase {
	private function queueWebSearchStub( string $foodName, int $calories ): void {
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'id' => 'response-' . $foodName,
				'usage' => [ 'input_tokens' => 50, 'output_tokens' => 20 ],
				'output' => [[
					'type' => 'message',
					'content' => [[
						'type' => 'output_text',
						'text' => wp_json_encode( [
							'food_name' => $foodName,
							'calories' => $calories,
							'protein_g' => 10,
							'carbs_g' => 10,
							'fat_g' => 5,
						] ),
					]],
				]],
			] ),
		] );
	}

	// Every item without a USDA match triggers a full sequential OpenAI web-search
	// call (up to 60-90s each). A meal photo with several unmatched homemade/mixed
	// items could previously stack enough of these to stall the whole request for
	// minutes. This locks in the cap that keeps worst-case latency bounded.
	public function test_caps_web_search_fallback_calls_per_meal(): void {
		$this->setOption( 'jf_openai_api_key', 'test-key' );

		$this->queueWebSearchStub( 'Grandma\'s Casserole', 400 );
		$this->queueWebSearchStub( 'Homemade Stew', 350 );
		// Intentionally no 3rd or 4th stub queued — if the cap failed to hold,
		// those calls would return a "missing_http_stub" WP_Error instead.

		$unresolved_item = static fn( string $name, int $fallback_calories ) => [
			'food_name' => $name,
			'serving_amount' => 1,
			'serving_unit' => 'serving',
			'estimated_grams' => 200,
			'calories' => $fallback_calories,
			'protein_g' => 5.0,
			'carbs_g' => 5.0,
			'fat_g' => 5.0,
			'source' => null,
		];

		$analysis = [
			'items' => [
				$unresolved_item( 'grandmas casserole', 111 ),
				$unresolved_item( 'homemade stew', 222 ),
				$unresolved_item( 'mystery casserole', 333 ),
				$unresolved_item( 'leftover surprise', 444 ),
			],
		];

		$result = $this->invokePrivateStatic( AiService::class, 'resolve_meal_analysis_with_web_search', [
			7,
			$analysis,
			[ 'goal_type' => 'maintain', 'target_calories' => 2200, 'target_protein_g' => 180 ],
		] );

		$postCalls = $GLOBALS['johnny5k_test_http_log']['post'] ?? [];
		$this->assertCount( 2, $postCalls, 'only 2 web-search fallback calls should fire, matching the cap' );

		$items = $result['items'];
		$this->assertSame( 'Grandma\'s Casserole', $items[0]['food_name'], 'first item should be resolved via web search' );
		$this->assertSame( 400, $items[0]['calories'] );
		$this->assertSame( 'Homemade Stew', $items[1]['food_name'], 'second item should be resolved via web search' );
		$this->assertSame( 350, $items[1]['calories'] );
		$this->assertSame( 'mystery casserole', $items[2]['food_name'], 'third item exceeds the cap and keeps its original estimate' );
		$this->assertSame( 333, $items[2]['calories'] );
		$this->assertSame( 'leftover surprise', $items[3]['food_name'], 'fourth item exceeds the cap and keeps its original estimate' );
		$this->assertSame( 444, $items[3]['calories'] );
	}
}
