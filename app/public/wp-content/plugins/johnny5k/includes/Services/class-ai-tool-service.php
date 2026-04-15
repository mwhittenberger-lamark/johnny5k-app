<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\TrainingDayTypes;

class AiToolService {

	public static function tool_registry( int $max_tool_meal_rows, int $max_tool_pantry_rows, int $max_tool_recipe_rows ): array {
		$empty_object = (object) [];

		return [
			'get_profile_summary' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get a concise summary of the current user profile, goals, and active targets.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'get_daily_targets' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get the user’s current calorie, macro, step, and sleep targets.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'get_today_nutrition' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get today’s logged nutrition totals plus meal-entry count, meal-type count, and a meal breakdown with foods so you can answer questions about dinner or how many meals were logged.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'get_recent_meals' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get detailed logged meals for a specific date, optionally narrowed to breakfast, lunch, dinner, snack, or shake. Includes item-level food names, serving amounts, serving units, estimated grams when available, and macros.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'date'      => [ 'type' => 'string', 'description' => 'Date to inspect in YYYY-MM-DD format. Omit to use today.' ],
						'meal_type' => [ 'type' => 'string', 'description' => 'Optional meal type filter: breakfast, lunch, dinner, snack, or shake.' ],
						'limit'     => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => $max_tool_meal_rows ],
					],
					'additionalProperties' => false,
				],
			],
			'get_pantry_snapshot' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get the current pantry inventory with item names, amounts, categories, and expiry dates when available.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'limit' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => $max_tool_pantry_rows ],
					],
					'additionalProperties' => false,
				],
			],
			'get_recipe_catalog' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get recipe suggestions from the current recipe list, including recipe details, images, and whether each recipe is already in My Cookbook. Optionally filter by meal type or minimum protein.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'meal_type'         => [ 'type' => 'string', 'description' => 'Optional meal type filter: breakfast, lunch, dinner, snack, or shake.' ],
						'minimum_protein_g' => [ 'type' => 'number', 'minimum' => 0 ],
						'limit'             => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => $max_tool_recipe_rows ],
					],
					'additionalProperties' => false,
				],
			],
			'get_recipe_cookbook' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get the recipes currently saved in the user’s My Cookbook list, including images, ingredients, instructions, and macros.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'meal_type'         => [ 'type' => 'string', 'description' => 'Optional meal type filter: breakfast, lunch, dinner, snack, or shake.' ],
						'minimum_protein_g' => [ 'type' => 'number', 'minimum' => 0 ],
						'limit'             => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => $max_tool_recipe_rows ],
					],
					'additionalProperties' => false,
				],
			],
			'add_recipe_to_cookbook' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Save a recipe from the recipe catalog into the user’s My Cookbook list when they say they like it, want to keep it, or want it added to My Cookbook. Prefer the recipe_key from get_recipe_catalog when it is available.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'recipe_key' => [ 'type' => 'string', 'description' => 'Preferred stable recipe key from get_recipe_catalog.' ],
						'recipe_name' => [ 'type' => 'string', 'description' => 'Recipe name to save when the key is not available.' ],
						'meal_type' => [ 'type' => 'string', 'description' => 'Optional meal type filter to disambiguate the recipe.' ],
					],
					'additionalProperties' => false,
				],
			],
			'get_recovery_snapshot' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get today’s steps plus recent sleep, weight, and cardio summary.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'get_current_workout' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get the user’s current or today’s workout session and exercises, including logged sets, reps, weights, and the most recent completed workout details.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'log_steps' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Log or update a step count for a date. Use this when the user asks Johnny to log steps.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'steps' => [ 'type' => 'integer', 'minimum' => 0 ],
						'date'  => [ 'type' => 'string', 'description' => 'Date to log in YYYY-MM-DD format when known. Omit to use today.' ],
					],
					'required'             => [ 'steps' ],
					'additionalProperties' => false,
				],
			],
			'log_food_from_description' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Log food or a meal from a short natural-language description when the user asks Johnny to log what they ate. Use only when the description has enough detail to make a responsible estimate; otherwise ask one short clarifying question first.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'food_text'      => [ 'type' => 'string' ],
						'meal_type'      => [ 'type' => 'string', 'description' => 'breakfast, lunch, dinner, snack, or shake when known' ],
						'meal_datetime'  => [ 'type' => 'string', 'description' => 'Meal timestamp in MySQL datetime format when known. Omit to use now.' ],
					],
					'required'             => [ 'food_text' ],
					'additionalProperties' => false,
				],
			],
			'create_training_plan' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Create and activate a new training plan for the user. Use when the user asks Johnny to create a new workout or exercise plan.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'name'                => [ 'type' => 'string' ],
						'program_template_id' => [ 'type' => 'integer' ],
						'template_name'       => [ 'type' => 'string', 'description' => 'Optional template name when the user asks for a specific split.' ],
					],
					'additionalProperties' => false,
				],
			],
			'create_custom_workout' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Create a named one-off custom workout draft for the user and queue it on the workout screen. Use when the user wants Johnny to build a specific custom workout for today instead of editing the full weekly plan.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'name'           => [ 'type' => 'string', 'description' => 'The custom workout name Johnny wants the user to see.' ],
						'day_type'       => [ 'type' => 'string', 'description' => 'Optional base day type: ' . TrainingDayTypes::ai_list() . '.' ],
						'time_tier'      => [ 'type' => 'string', 'description' => 'Optional workout length: short, medium, or full.' ],
						'exercise_names' => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Ordered list of exercise names Johnny selected for this custom workout.',
						],
						'coach_note'   => [ 'type' => 'string', 'description' => 'Optional short note about why Johnny built this workout.' ],
					],
					'required'             => [ 'name', 'exercise_names' ],
					'additionalProperties' => false,
				],
			],
			'create_personal_exercise' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Add an exercise to the user’s personal exercise library. Use when the user asks Johnny to save, add, or create a custom exercise in their library.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'name'             => [ 'type' => 'string', 'description' => 'Exercise name to save in the personal library.' ],
						'description'      => [ 'type' => 'string' ],
						'primary_muscle'   => [ 'type' => 'string' ],
						'movement_pattern' => [ 'type' => 'string' ],
						'equipment'        => [ 'type' => 'string' ],
						'difficulty'       => [ 'type' => 'string', 'description' => 'beginner, intermediate, or advanced' ],
						'default_rep_min'  => [ 'type' => 'integer' ],
						'default_rep_max'  => [ 'type' => 'integer' ],
						'default_sets'     => [ 'type' => 'integer' ],
						'day_types'        => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
						'slot_types'       => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
						'coaching_cues'    => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
					],
					'required'             => [ 'name' ],
					'additionalProperties' => false,
				],
			],
			'log_sleep' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Log sleep for a date when the user asks Johnny to record last night or a recovery sleep entry.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'hours_sleep'   => [ 'type' => 'number', 'minimum' => 0.1, 'maximum' => 24 ],
						'sleep_quality' => [ 'type' => 'string', 'description' => 'Optional quality label such as poor, okay, good, or great.' ],
						'date'          => [ 'type' => 'string', 'description' => 'Date to log in YYYY-MM-DD format when known. Omit to use today.' ],
					],
					'required'             => [ 'hours_sleep' ],
					'additionalProperties' => false,
				],
			],
			'add_pantry_items' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Add one or more items to the pantry when the user asks Johnny to update pantry inventory.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'item_name'  => [ 'type' => 'string' ],
						'quantity'   => [ 'type' => 'number' ],
						'unit'       => [ 'type' => 'string' ],
						'expires_on' => [ 'type' => 'string', 'description' => 'Optional YYYY-MM-DD expiry date.' ],
						'items'      => [
							'type'  => 'array',
							'items' => [
								'type'                 => 'object',
								'properties'           => [
									'item_name'  => [ 'type' => 'string' ],
									'quantity'   => [ 'type' => 'number' ],
									'unit'       => [ 'type' => 'string' ],
									'expires_on' => [ 'type' => 'string' ],
								],
								'additionalProperties' => false,
							],
						],
					],
					'additionalProperties' => false,
				],
			],
			'add_grocery_gap_items' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Add one or more items to the grocery gap list when the user asks Johnny to add shopping items.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'item_name' => [ 'type' => 'string' ],
						'quantity'  => [ 'type' => 'number' ],
						'unit'      => [ 'type' => 'string' ],
						'notes'     => [ 'type' => 'string' ],
						'items'     => [
							'type'  => 'array',
							'items' => [
								'type'                 => 'object',
								'properties'           => [
									'item_name' => [ 'type' => 'string' ],
									'quantity'  => [ 'type' => 'number' ],
									'unit'      => [ 'type' => 'string' ],
									'notes'     => [ 'type' => 'string' ],
								],
								'additionalProperties' => false,
							],
						],
					],
					'additionalProperties' => false,
				],
			],
			'swap_workout_exercise' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Swap an exercise inside the user’s current workout session using the live swap options for that session.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'current_exercise_name'     => [ 'type' => 'string', 'description' => 'The exercise currently in the workout that should be replaced.' ],
						'replacement_exercise_name' => [ 'type' => 'string', 'description' => 'The replacement exercise to swap in.' ],
						'session_exercise_id'       => [ 'type' => 'integer', 'description' => 'Optional session exercise id when already known.' ],
					],
					'required'             => [ 'current_exercise_name', 'replacement_exercise_name' ],
					'additionalProperties' => false,
				],
			],
			'schedule_sms_reminder' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Schedule an SMS reminder for the user at a specific future local date and time when they explicitly ask for a text reminder.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'message'       => [ 'type' => 'string', 'description' => 'The reminder message Johnny should text.' ],
						'send_at_local' => [ 'type' => 'string', 'description' => 'Future local date/time for the user, such as 2026-04-07 18:30 or tomorrow 6:30pm.' ],
					],
					'required'             => [ 'message', 'send_at_local' ],
					'additionalProperties' => false,
				],
			],
			'clear_follow_ups' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Clear one or more pending Johnny follow-ups when the user explicitly asks to dismiss, remove, or clear them.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'follow_up_ids' => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Optional list of follow-up ids to dismiss.',
						],
						'clear_all' => [ 'type' => 'boolean', 'description' => 'Set true only when the user clearly wants all pending follow-ups cleared.' ],
					],
					'additionalProperties' => false,
				],
			],
			'clear_sms_reminders' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Cancel one or more scheduled SMS reminders when the user explicitly asks Johnny to clear or remove them.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'reminder_ids' => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Optional list of scheduled SMS reminder ids to cancel.',
						],
						'clear_all' => [ 'type' => 'boolean', 'description' => 'Set true only when the user clearly wants all scheduled SMS reminders cleared.' ],
					],
					'additionalProperties' => false,
				],
			],
		];
	}

	public static function get_chat_function_tools( array $tool_registry, string $mode = 'general', array $context_overrides = [], string $user_message = '' ): array {
		$request_context = self::derive_tool_request_context( $mode, $context_overrides, $user_message );
		$tools           = [];

		foreach ( $tool_registry as $name => $tool ) {
			if ( empty( $tool['enabled'] ) || ! self::tool_allowed_for_request( $name, $request_context ) ) {
				continue;
			}

			$tools[] = [
				'type'        => 'function',
				'name'        => $name,
				'description' => $tool['description'],
				'parameters'  => $tool['parameters'],
			];
		}

		return $tools;
	}

	public static function build_tool_action_fallback_reply( array $action_results, array $used_tools = [] ): string {
		if ( ! empty( $action_results[0]['summary'] ) ) {
			return sanitize_text_field( (string) $action_results[0]['summary'] );
		}

		if ( ! empty( $action_results ) ) {
			$action_name = sanitize_key( (string) ( $action_results[0]['action'] ?? $action_results[0]['tool_name'] ?? '' ) );
			return match ( $action_name ) {
				'create_custom_workout'    => 'Johnny queued a custom workout for you on the workout page.',
				'create_personal_exercise' => 'Johnny added that exercise to your custom exercise library.',
				'create_training_plan'     => 'Johnny created a new training plan.',
				'clear_follow_ups'        => 'Johnny cleared the requested follow-ups.',
				'clear_sms_reminders'     => 'Johnny canceled the requested SMS reminders.',
				'swap_workout_exercise'    => 'Johnny updated the current workout.',
				default                    => 'Johnny completed that action.',
			};
		}

		if ( ! empty( $used_tools ) ) {
			return 'Johnny attempted that action, but needs a more specific request to finish it cleanly.';
		}

		return '';
	}

	public static function execute_chat_tool( int $user_id, string $tool_name, array $arguments = [], string $user_message = '', ?callable $argument_normalizer = null, ?callable $executor = null ): array {
		if ( is_callable( $argument_normalizer ) ) {
			$arguments = $argument_normalizer( $user_id, $tool_name, $arguments, $user_message );
		}

		if ( ! is_callable( $executor ) ) {
			return [ 'error' => 'Tool executor not available.' ];
		}

		return $executor( $user_id, $tool_name, $arguments );
	}

	private static function derive_tool_request_context( string $mode, array $context_overrides, string $user_message ): array {
		$message            = strtolower( trim( $user_message ) );
		$current_screen     = sanitize_key( (string) ( $context_overrides['current_screen'] ?? '' ) );
		$workout_keywords   = [
			'workout', 'training', 'exercise', 'session', 'split', 'push day', 'pull day', 'leg day', 'upper body', 'lower body', 'bench', 'squat', 'deadlift', 'swap exercise', 'replace exercise',
		];
		$nutrition_keywords = [
			'meal', 'meals', 'breakfast', 'lunch', 'dinner', 'snack', 'shake', 'protein', 'calorie', 'macro', 'macros', 'recipe', 'recipes', 'pantry', 'grocery', 'food', 'eat', 'eating',
		];

		$workout_requested   = self::message_contains_any( $message, $workout_keywords );
		$nutrition_requested = self::message_contains_any( $message, $nutrition_keywords );
		$workout_surface     = in_array( $mode, [ 'coach', 'live_workout', 'workout_review' ], true ) || in_array( $current_screen, [ 'workout', 'workouts' ], true );

		return [
			'workout_mutation_allowed' => $workout_requested || ( $workout_surface && ! $nutrition_requested ),
		];
	}

	private static function tool_allowed_for_request( string $tool_name, array $request_context ): bool {
		return match ( $tool_name ) {
			'create_training_plan', 'create_custom_workout', 'create_personal_exercise', 'swap_workout_exercise' => ! empty( $request_context['workout_mutation_allowed'] ),
			default => true,
		};
	}

	private static function message_contains_any( string $message, array $needles ): bool {
		if ( '' === $message ) {
			return false;
		}

		foreach ( $needles as $needle ) {
			if ( false !== strpos( $message, strtolower( (string) $needle ) ) ) {
				return true;
			}
		}

		return false;
	}
}
