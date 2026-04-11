<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiServiceStructuredActionsTest extends ServiceTestCase {
	public function test_parse_structured_chat_reply_sanitizes_actions_and_metadata(): void {
		$raw_reply = <<<'JSON'
```json
{
  "reply": "### Next steps\nOpen nutrition and move.",
  "actions": [
    {
      "type": "open_screen",
      "payload": {
        "screen": "nutrition",
        "route_path": "/nutrition",
        "focus_section": "pantry",
        "focus_tab": "steps",
        "action_label": "Open nutrition",
        "notice": "Heads up",
        "starter_prompt": "Help me clean this up.",
        "meal_type": "dinner"
      }
    },
    {
      "type": "open_screen",
      "payload": {
        "screen": "drop_table"
      }
    },
    {
      "type": "queue_follow_up",
      "payload": {
        "prompt": "   "
      }
    },
    {
      "type": "run_workflow",
      "payload": {
        "workflow": "build_tomorrow_plan",
        "steps": [" pick dinner ", "", "<b>pack lunch</b>"],
        "screen": "body",
        "meal_type": "snack",
        "starter_prompt": "Plan tomorrow."
      }
    }
  ],
  "why": "Because this is the next move.",
  "context_used": [" dashboard ", "", "<b>nutrition</b>"],
  "confidence": "HIGH"
}
```
JSON;

		$parsed = $this->invokePrivateStatic( AiService::class, 'parse_structured_chat_reply', [ $raw_reply ] );

		self::assertSame( 'Open nutrition and move.', $parsed['reply'] );
		self::assertSame( 'Because this is the next move.', $parsed['why'] );
		self::assertSame( [ 'dashboard', 'nutrition' ], $parsed['context_used'] );
		self::assertSame( 'high', $parsed['confidence'] );
		self::assertCount( 2, $parsed['actions'] );
		self::assertSame(
			[
				'type' => 'open_screen',
				'payload' => [
					'screen' => 'nutrition',
					'route_path' => '/nutrition',
					'focus_section' => 'pantry',
					'focus_tab' => 'steps',
					'action_label' => 'Open nutrition',
					'notice' => 'Heads up',
					'starter_prompt' => 'Help me clean this up.',
					'meal_type' => 'dinner',
				],
			],
			$parsed['actions'][0]
		);
		self::assertSame(
			[
				'type' => 'run_workflow',
				'payload' => [
					'workflow' => 'build_tomorrow_plan',
					'steps' => [ 'pick dinner', 'pack lunch' ],
					'screen' => 'body',
					'meal_type' => 'snack',
					'starter_prompt' => 'Plan tomorrow.',
				],
			],
			$parsed['actions'][1]
		);
	}

	public function test_create_saved_meal_draft_payload_requires_name_and_cleans_items(): void {
		$payload = $this->invokePrivateStatic(
			AiService::class,
			'sanitize_structured_action_payload',
			[
				'create_saved_meal_draft',
				[
					'name' => ' Post-workout bowl ',
					'meal_type' => 'dessert',
					'items' => [
						[
							'food_id' => '55',
							'food_name' => 'Chicken',
							'serving_amount' => '1.236',
							'serving_unit' => 'oz',
							'calories' => '123.6',
							'protein_g' => '30.129',
							'carbs_g' => '3.499',
							'fat_g' => '4.444',
						],
						[
							'food_name' => '',
							'calories' => 999,
						],
					],
				],
			]
		);

		self::assertSame(
			[
				'name' => 'Post-workout bowl',
				'meal_type' => 'lunch',
				'items' => [
					[
						'food_id' => 55,
						'food_name' => 'Chicken',
						'serving_amount' => 1.24,
						'serving_unit' => 'oz',
						'calories' => 124,
						'protein_g' => 30.13,
						'carbs_g' => 3.5,
						'fat_g' => 4.44,
					],
				],
			],
			$payload
		);
	}
}