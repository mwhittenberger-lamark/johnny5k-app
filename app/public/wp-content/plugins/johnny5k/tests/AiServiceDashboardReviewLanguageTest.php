<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiPromptService;
use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceDashboardReviewLanguageTest extends ServiceTestCase {
	public function test_build_dashboard_review_prompt_requires_plain_spoken_non_app_language(): void {
		$this->wpdb()->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 42 LIMIT 1', 'UTC' );

		$prompt = $this->invokePrivateStatic(
			AiService::class,
			'build_dashboard_review_prompt',
			[
				42,
				[
					'date' => '2026-04-29',
					'goal' => (object) [
						'goal_type' => 'cut',
						'target_calories' => 2200,
						'target_protein_g' => 180,
						'target_sleep_hours' => 8,
					],
					'nutrition_totals' => [
						'calories' => 1400,
						'protein_g' => 110,
						'carbs_g' => 120,
						'fat_g' => 45,
					],
					'meals_today' => [],
					'steps' => [ 'today' => 4200, 'target' => 8000 ],
					'sleep' => (object) [ 'hours_sleep' => 6.5 ],
					'training_status' => [ 'status' => 'open', 'scheduled_day_type' => 'push', 'recorded' => false ],
					'recovery_summary' => [ 'mode' => 'normal', 'headline' => 'Solid' ],
					'streaks' => [ 'logging_days' => 2, 'training_days' => 1, 'sleep_days' => 2, 'cardio_days' => 0 ],
					'tomorrow_preview' => (object) [ 'planned_day_type' => 'pull', 'time_tier' => 'medium' ],
				],
			]
		);

		self::assertStringContainsString( 'use plain spoken English', $prompt );
		self::assertStringContainsString( 'use contractions', $prompt );
		self::assertStringContainsString( 'sound like a good coach texting a client', $prompt );
		self::assertStringContainsString( 'Do not use phrases like "current progress", "clear next move", "signal", "traction", "recover on purpose", or "keep logging clean"', $prompt );
	}

	public function test_dashboard_review_normalizer_fallback_copy_avoids_summary_framing(): void {
		$review = $this->invokePrivateStatic(
			AiService::class,
			'normalise_dashboard_review_payload',
			[
				[],
				[
					'training_status' => [ 'scheduled_day_type' => 'push', 'status' => 'open', 'recorded' => false ],
					'today_schedule' => (object) [ 'day_type' => 'push' ],
					'nutrition_totals' => [ 'protein_g' => 100 ],
					'goal' => (object) [ 'target_protein_g' => 180, 'target_calories' => 2200, 'target_sleep_hours' => 8 ],
					'steps' => [ 'today' => 4000, 'target' => 8000 ],
					'sleep' => (object) [ 'hours_sleep' => 6.8 ],
				],
			]
		);

		self::assertSame( 'Here\'s the move for today', $review['title'] );
		self::assertStringNotContainsString( 'reviewed your board', (string) $review['title'] );
		self::assertStringNotContainsString( 'current progress', (string) $review['message'] );
		self::assertStringNotContainsString( 'clear next move', (string) $review['message'] );
		self::assertStringContainsString( 'what matters most today', (string) $review['starter_prompt'] );
	}

	public function test_admin_persona_contract_checks_include_plain_language_and_no_summary_framing(): void {
		$checks = AiPromptService::admin_persona_contract_checks();
		$ids = array_column( $checks, 'id' );

		self::assertContains( 'plain_spoken_language', $ids );
		self::assertContains( 'no_summary_framing', $ids );
	}
}