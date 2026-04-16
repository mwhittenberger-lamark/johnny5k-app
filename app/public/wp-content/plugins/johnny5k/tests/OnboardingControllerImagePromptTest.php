<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\OnboardingController;
use Johnny5k\Tests\Support\ServiceTestCase;

class OnboardingControllerImagePromptTest extends ServiceTestCase {
	public function test_get_generation_scenarios_switches_to_ironquest_class_scenarios(): void {
		$scenarios = $this->invokePrivateStatic(
			OnboardingController::class,
			'get_generation_scenarios',
			[
				[
					'mode' => 'ironquest',
					'class_slug' => 'mage',
					'location_name' => 'The Training Grounds',
					'location_theme' => 'open training yard, banners, wooden dummies, early adventure gear',
					'location_tone' => 'hopeful, structured, heroic beginnings',
				],
			]
		);

		$this->assertSame( 'Arcane Proving Ground', $scenarios[0]['label'] );
		$this->assertStringContainsString( 'spell-lit proving ground', strtolower( $scenarios[0]['prompt'] ) );
	}

	public function test_build_personalized_image_prompt_uses_ironquest_fantasy_direction(): void {
		$this->wpdb()->expectGetRow(
			'SELECT first_name, current_goal FROM wp_fit_user_profiles WHERE user_id = 42',
			(object) [
				'first_name' => 'Avery',
				'current_goal' => 'recomp',
			]
		);

		$prompt = $this->invokePrivateStatic(
			OnboardingController::class,
			'build_personalized_image_prompt',
			[
				'torch-lit mage portrait',
				[
					'label' => 'Arcane Proving Ground',
					'prompt' => 'Johnny and the user stand in a spell-lit proving ground with floating sigils and controlled arcane energy.',
				],
				42,
				[
					'mode' => 'ironquest',
					'class_slug' => 'mage',
					'motivation_slug' => 'discipline',
					'location_name' => 'The Training Grounds',
					'location_theme' => 'open training yard, banners, wooden dummies, early adventure gear',
					'location_tone' => 'hopeful, structured, heroic beginnings',
				],
			]
		);

		$this->assertStringContainsString( 'IronQuest', $prompt );
		$this->assertStringContainsString( 'Mage', $prompt );
		$this->assertStringContainsString( 'torch-lit mage portrait', $prompt );
		$this->assertStringContainsString( 'not a modern gym photo', $prompt );
		$this->assertStringContainsString( 'avoid dumbbells, benches, treadmills, gym mats', strtolower( $prompt ) );
	}
}
