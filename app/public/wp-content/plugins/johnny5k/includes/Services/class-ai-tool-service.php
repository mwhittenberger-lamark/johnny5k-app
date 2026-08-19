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
			'get_grocery_gap' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get and display the user’s current grocery gap or shopping list, including pantry staples and manually added or recipe-planning items. Use whenever the user asks what is on their grocery list, shopping list, or grocery gap.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
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
			'get_weight_history' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get the user’s complete stored weight-loss history, including every dated weight, waist, body-fat, resting-heart-rate, and notes entry plus starting weight, target weight, total change, goal progress, and date span. Use for any question about weight progress, loss, change, history, or trend. When at least two weight entries exist, this tool also returns a ready-to-render weight line chart; do not call create_visualization again for the same weight series.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'get_current_workout' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get the user’s queued workout draft and approval state as well as the current or today’s workout session, exercises, logged sets, reps, weights, and most recent completed workout details.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'get_saved_workouts' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'List the user’s reusable workouts from My Workouts, including IDs, names, structure, exercise counts, and exercise prescriptions. Use when the user asks what workouts they have, asks to see or search their saved workouts, or needs the exact name or ID before loading one.',
				'parameters'  => [
					'type' => 'object',
					'properties' => [
						'query' => [ 'type' => 'string', 'description' => 'Optional name, day type, or exercise text to search.' ],
						'limit' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 100 ],
					],
					'additionalProperties' => false,
				],
			],
			'present_choices' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Show a compact decision rail beneath your reply when the user has 2 to 4 genuinely useful next choices. Use reply choices for clarifications and decisions, and navigation choices only to open an app screen. Call this at most once per response. Do not use it for a direct answer with no meaningful decision.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'prompt' => [ 'type' => 'string', 'description' => 'Optional short question or decision label shown above the buttons.' ],
						'style' => [ 'type' => 'string', 'enum' => [ 'chips', 'actions' ], 'description' => 'Use chips for short answers and actions for more consequential next steps.' ],
						'choices' => [
							'type' => 'array',
							'minItems' => 2,
							'maxItems' => 4,
							'items' => [
								'type'                 => 'object',
								'properties'           => [
									'label' => [ 'type' => 'string', 'description' => 'Concise button text.' ],
									'type' => [ 'type' => 'string', 'enum' => [ 'reply', 'navigate' ] ],
									'response' => [ 'type' => 'string', 'description' => 'Natural-language message sent back to Johnny for a reply choice.' ],
									'route' => [ 'type' => 'string', 'description' => 'App route for a navigation choice.' ],
									'emphasis' => [ 'type' => 'string', 'enum' => [ 'primary', 'secondary' ] ],
								],
								'required'             => [ 'label', 'type' ],
								'additionalProperties' => false,
							],
						],
					],
					'required'             => [ 'choices' ],
					'additionalProperties' => false,
				],
			],
			'create_visualization' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Create a chart or infographic card in the Johnny conversation. Use after retrieving the relevant user data when a visual comparison, trend, progress summary, or step-by-step explanation would be clearer than prose. Never invent values. Keep charts to 12 data points or fewer and cite the data source in source_label.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'type' => [ 'type' => 'string', 'enum' => [ 'line', 'bar', 'progress', 'comparison', 'infographic' ] ],
						'title' => [ 'type' => 'string', 'description' => 'Short, specific visual title.' ],
						'subtitle' => [ 'type' => 'string', 'description' => 'Optional one-line context.' ],
						'unit' => [ 'type' => 'string', 'description' => 'Short unit such as lb, reps, hours, steps, %, kcal, or g.' ],
						'source_label' => [ 'type' => 'string', 'description' => 'Where the displayed values came from, such as Workout history or Daily check-ins.' ],
						'target' => [ 'type' => 'number', 'description' => 'Optional target for progress charts.' ],
						'items' => [
							'type' => 'array', 'minItems' => 1, 'maxItems' => 12,
							'items' => [
								'type' => 'object',
								'properties' => [
									'label' => [ 'type' => 'string' ],
									'value' => [ 'type' => 'number' ],
									'secondary_value' => [ 'type' => 'number', 'description' => 'Optional comparison value.' ],
									'detail' => [ 'type' => 'string', 'description' => 'Optional concise annotation or infographic description.' ],
								],
								'required' => [ 'label' ],
								'additionalProperties' => false,
							],
						],
					],
					'required'             => [ 'type', 'title', 'items' ],
					'additionalProperties' => false,
				],
			],
			'set_ambient_color' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Change the home screen’s ambient accent color and mood lighting. Use when the user explicitly asks to change the color, vibe, or theme, or proactively for a genuinely fitting moment (a celebration, a fresh start, a recovery day) — do not change it without a real reason, and never more than once in a short exchange. "default" always restores the original teal look; use it when the user asks to undo, reset, or go back to normal. "dance" plays a brief animated light show cycling through all the colors before settling back to default on its own — reserve it for a truly big, rare moment (a major PR, a milestone, finishing a program), not routine wins.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'color' => [ 'type' => 'string', 'enum' => [ 'default', 'green', 'violet', 'rose', 'amber', 'dance' ], 'description' => '"default" is the original teal and always available as a reset. "dance" is a brief celebratory animation reserved for a truly big, rare moment.' ],
					],
					'required'             => [ 'color' ],
					'additionalProperties' => false,
				],
			],
			'trigger_confetti_burst' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Trigger a brief confetti burst overlay across the app. This is the mid-tier celebration—bigger and more fun than a simple ambient color change, but lighter than color dance or fire mode. Good for a notable but not huge win: hitting a target, a solid streak, finishing a tough set. Clears itself automatically—never call anything to turn it off. Never more than once per reply.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => new \stdClass(),
					'additionalProperties' => false,
				],
			],
			'set_text_size' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Change the size of Johnny\'s chat text. Use only when the user explicitly asks to make the text bigger, larger, or easier to read, or asks to undo that and go back to normal — never proactively and never as part of a celebration. "large" enlarges the chat text; "default" restores the original size.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'size' => [ 'type' => 'string', 'enum' => [ 'default', 'large' ], 'description' => '"default" restores the original chat text size. "large" enlarges it.' ],
					],
					'required'             => [ 'size' ],
					'additionalProperties' => false,
				],
			],
			'activate_fire_mode' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Trigger a brief full-screen animated fire effect across the whole app as a big hype moment. It plays for a few seconds and clears itself automatically—never call anything to turn it off. Reserve it for a genuinely major, rare achievement (a huge PR, a big milestone, finishing a hard program) — never for routine praise, and never more than once in a short exchange.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => new \stdClass(),
					'additionalProperties' => false,
				],
			],
			'search_gif' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Search GIPHY and share one safe-for-work reaction GIF in the conversation. Use only for a genuinely celebratory, funny, or encouraging moment—a real win, a streak, a joke that lands—never for factual, medical, safety, or data questions, and never more than once per reply. Keep the query short and universal, e.g. "high five", "you got this", "monday motivation".',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'query' => [ 'type' => 'string', 'description' => 'Short, safe-for-work search phrase describing the reaction or moment.' ],
					],
					'required'             => [ 'query' ],
					'additionalProperties' => false,
				],
			],
			'generate_image' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Generate and privately save one image for the current user with OpenAI. Set use_user_likeness true only when the user explicitly asks for an image of themselves; this uses their private uploaded headshot. Set use_johnny_likeness true when the user asks for an image of Johnny; this uses Johnny’s official uploaded reference. Never set both likeness modes. Do not imply a likeness was used unless the tool confirms it.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'prompt' => [ 'type' => 'string', 'description' => 'A detailed visual description grounded in the user request.' ],
						'title' => [ 'type' => 'string', 'description' => 'Short display title.' ],
						'alt_text' => [ 'type' => 'string', 'description' => 'Concise accessible description of the intended image.' ],
						'category' => [ 'type' => 'string', 'enum' => [ 'exercise_illustration', 'workout_poster', 'meal_concept', 'motivation', 'share_card', 'johnny_moment', 'other' ] ],
						'aspect_ratio' => [ 'type' => 'string', 'enum' => [ '1:1', '4:3', '3:4', '16:9', '9:16' ] ],
						'use_user_likeness' => [ 'type' => 'boolean', 'description' => 'Use the current user’s private uploaded headshot as a likeness reference.' ],
						'use_johnny_likeness' => [ 'type' => 'boolean', 'description' => 'Use Johnny’s official uploaded character image as the likeness reference.' ],
					],
					'required'             => [ 'prompt', 'title', 'alt_text', 'category' ],
					'additionalProperties' => false,
				],
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
			'set_training_schedule' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Set or change the user\'s weekly training split and workout schedule. Use when the user wants specific day types assigned to specific weekdays, such as push on Monday, pull on Wednesday, legs on Friday, cardio on Saturday, and rest on the remaining days.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'preferred_workout_days_json' => [
							'type'        => 'array',
							'description' => 'Weekly schedule entries. Each item should include a weekday label (Mon, Tue, Wed, Thu, Fri, Sat, Sun) and a day_type. Omitted weekdays will default to rest.',
							'items'       => [
								'type'                 => 'object',
								'properties'           => [
									'day' => [ 'type' => 'string', 'description' => 'Weekday label: Mon, Tue, Wed, Thu, Fri, Sat, or Sun.' ],
									'day_type' => [ 'type' => 'string', 'description' => 'Workout type for that weekday: ' . TrainingDayTypes::ai_list() . '.' ],
								],
								'required'             => [ 'day', 'day_type' ],
								'additionalProperties' => false,
							],
						],
					],
					'required'             => [ 'preferred_workout_days_json' ],
					'additionalProperties' => false,
				],
			],
			'create_custom_workout' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Use this whenever the user wants Johnny to produce, assemble, choose, design, recommend, or otherwise give them a concrete workout to perform—not only when they use a specific phrase. This is an atomic workout builder: pass every requested exercise directly, including exercises that may not exist yet. The tool resolves existing library entries, automatically creates any missing exercises in the user’s personal library, and adds all of them to the reviewable workout draft in one operation. Never ask the user to create missing exercises first, never claim custom exercises cannot be added, and never split a workout request into separate create_personal_exercise calls. Never provide a requested workout prescription only as prose. Preserve exercise order and exact rep, duration, per-side, sets, rounds, and rest instructions. Use circuit when the intended structure repeats a sequence. Convert minutes to seconds and disclose consequential assumptions in interpretation_notes.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'name'           => [ 'type' => 'string', 'description' => 'The custom workout name Johnny wants the user to see.' ],
						'day_type'       => [ 'type' => 'string', 'description' => 'Optional base day type: ' . TrainingDayTypes::ai_list() . '.' ],
						'time_tier'      => [ 'type' => 'string', 'description' => 'Optional workout length: short, medium, or full.' ],
						'workout_structure' => [ 'type' => 'string', 'enum' => [ 'standard', 'circuit' ] ],
						'rounds' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 20, 'description' => 'Required for a circuit.' ],
						'rest_between_exercises_seconds' => [ 'type' => 'integer', 'minimum' => 0, 'maximum' => 900 ],
						'rest_between_rounds_seconds' => [ 'type' => 'integer', 'minimum' => 0, 'maximum' => 1800 ],
						'exercises' => [
							'type' => 'array',
							'minItems' => 1,
							'maxItems' => 30,
							'items' => [
								'type' => 'object',
								'properties' => [
									'exercise_name' => [ 'type' => 'string' ],
									'target_type' => [ 'type' => 'string', 'enum' => [ 'reps', 'duration' ] ],
									'target_reps' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 500 ],
									'target_rep_min' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 500 ],
									'target_rep_max' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 500 ],
									'target_duration_seconds' => [ 'type' => 'integer', 'minimum' => 5, 'maximum' => 3600 ],
									'sets' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 20 ],
									'reps_per_side' => [ 'type' => 'boolean' ],
									'notes' => [ 'type' => 'string' ],
								],
								'required' => [ 'exercise_name', 'target_type' ],
								'additionalProperties' => false,
							],
						],
						'exercise_names' => [
							'type'        => 'array',
							'items'       => [ 'type' => 'string' ],
							'description' => 'Ordered list of exercise names Johnny selected for this custom workout.',
						],
						'coach_note'   => [ 'type' => 'string', 'description' => 'Optional short note about why Johnny built this workout.' ],
						'interpretation_notes' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ], 'description' => 'Corrections or consequential assumptions to show in review.' ],
					],
					'required'             => [ 'name', 'workout_structure', 'exercises' ],
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
			'save_workout_to_library' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Save the user’s queued workout draft or active workout session to their reusable My Workouts library. Use only when the user explicitly asks to save, store, or keep the workout.',
				'parameters'  => [
					'type' => 'object',
					'properties' => [
						'name' => [ 'type' => 'string', 'description' => 'Optional library name override.' ],
					],
					'additionalProperties' => false,
				],
			],
			'load_saved_workout' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Find a workout in the user’s My Workouts library by saved ID or name and queue a fresh copy on the Workout screen when the user explicitly asks to load or use it.',
				'parameters'  => [
					'type' => 'object',
					'properties' => [
						'id' => [ 'type' => 'integer', 'minimum' => 1 ],
						'name' => [ 'type' => 'string' ],
					],
					'additionalProperties' => false,
				],
			],
			'remove_saved_workout' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Permanently remove one workout from the user’s My Workouts library by saved ID or name. Use only when the user explicitly asks to remove or delete a saved/library workout. If the workout is unclear, call get_saved_workouts first instead of guessing.',
				'parameters'  => [
					'type' => 'object',
					'properties' => [
						'id' => [ 'type' => 'integer', 'minimum' => 1 ],
						'name' => [ 'type' => 'string' ],
					],
					'additionalProperties' => false,
				],
			],
			'create_food_tile' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Create a reusable food tile for the planning dashboard and saved-food library when the user explicitly asks Johnny to make, create, or save a tile. Analyze food_text to estimate the serving and nutrition; explicit nutrition fields override estimates. Set category to "staples" for a basic, clean, minimally processed whole food (e.g. eggs, chicken breast, ground turkey, brown rice, plain oats) when the user is building out that kind of everyday library; omit it otherwise. Do not log the tile as eaten.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'food_text' => [ 'type' => 'string', 'description' => 'Food and portion description used to build the tile.' ],
					'name' => [ 'type' => 'string' ], 'brand' => [ 'type' => 'string' ], 'serving_size' => [ 'type' => 'string' ],
					'calories' => [ 'type' => 'integer', 'minimum' => 0 ], 'protein_g' => [ 'type' => 'number', 'minimum' => 0 ],
					'carbs_g' => [ 'type' => 'number', 'minimum' => 0 ], 'fat_g' => [ 'type' => 'number', 'minimum' => 0 ],
					'fiber_g' => [ 'type' => 'number', 'minimum' => 0 ], 'sugar_g' => [ 'type' => 'number', 'minimum' => 0 ],
					'sodium_mg' => [ 'type' => 'number', 'minimum' => 0 ],
					'category' => [ 'type' => 'string', 'description' => 'Optional library category, e.g. "staples" for a basic clean whole food.' ],
				], 'required' => [ 'food_text' ], 'additionalProperties' => false ],
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
			'log_cardio' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Log a completed cardio activity when the user clearly asks Johnny to record it. Use the user’s wording to choose the activity type and intensity. Do not merely describe the entry or claim it was logged without calling this tool.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'cardio_type'       => [ 'type' => 'string', 'description' => 'Activity such as walking, running, cycling, swimming, rowing, stairmaster, HIIT, or other.' ],
						'duration_minutes'  => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 1440 ],
						'intensity'         => [ 'type' => 'string', 'enum' => [ 'light', 'moderate', 'hard' ] ],
						'distance'          => [ 'type' => 'number', 'minimum' => 0, 'description' => 'Optional distance using the value supplied by the user.' ],
						'estimated_calories'=> [ 'type' => 'integer', 'minimum' => 0 ],
						'notes'              => [ 'type' => 'string' ],
						'date'               => [ 'type' => 'string', 'description' => 'Date in YYYY-MM-DD format when known. Omit to use today.' ],
					],
					'required'             => [ 'cardio_type', 'duration_minutes', 'intensity' ],
					'additionalProperties' => false,
				],
			],
			'log_rest_day' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Record today as a completed rest day when the user clearly says they are taking, logging, or confirming a rest day. This changes today’s training record, so do not use it for general recovery questions or hypothetical discussion.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'approve_workout' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Persistently approve and lock the currently queued or active workout for today after the user explicitly approves it.',
				'parameters' => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'search_exercises' => [
				'read_only' => true, 'enabled' => true,
				'description' => 'Search the accessible exercise library before recommending, adding, or replacing exercises when exact available options matter.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'query' => [ 'type' => 'string' ], 'muscle' => [ 'type' => 'string' ], 'equipment' => [ 'type' => 'string' ],
					'own_only' => [ 'type' => 'boolean' ], 'limit' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 50 ],
				], 'additionalProperties' => false ],
			],
			'modify_workout' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Modify the queued workout card. Use replace for an atomic one-for-one exercise replacement, remove, add, reorder with the complete ordered exercise-name list, or structure to change standard/circuit rounds and rest. Add and replace automatically create a missing exercise in the user’s personal library; never ask the user to create it first. A failed replacement leaves the original workout unchanged.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'action' => [ 'type' => 'string', 'enum' => [ 'replace', 'remove', 'add', 'reorder', 'structure' ] ],
					'exercise_name' => [ 'type' => 'string' ],
					'replacement_exercise_name' => [ 'type' => 'string' ],
					'exercise_order' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
					'workout_structure' => [ 'type' => 'string', 'enum' => [ 'standard', 'circuit' ] ],
					'rounds' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 20 ],
					'rest_between_exercises_seconds' => [ 'type' => 'integer', 'minimum' => 0, 'maximum' => 900 ],
					'rest_between_rounds_seconds' => [ 'type' => 'integer', 'minimum' => 0, 'maximum' => 1800 ],
				], 'required' => [ 'action' ], 'additionalProperties' => false ],
			],
			'start_workout' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Activate the approved queued workout when the user explicitly asks to begin or start it.',
				'parameters' => [ 'type' => 'object', 'properties' => [ 'readiness_score' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 10 ] ], 'additionalProperties' => false ],
			],
			'activate_ironquest_mission' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Turn on IronQuest mode for this account and start (or attach) an IronQuest mission — only when the user explicitly asks to start, activate, or turn on a quest or mission, never proactively. A mission is recommended automatically; you never need to know or choose a mission or location slug. If a workout is already active, the mission attaches to it immediately. If not, set start_workout to true when the user also wants today\'s workout started right now; otherwise the mission attaches automatically the next time a workout starts.',
				'parameters' => [ 'type' => 'object', 'properties' => [ 'start_workout' => [ 'type' => 'boolean', 'description' => 'Set true if the user also wants to begin today\'s workout right now.' ] ], 'additionalProperties' => false ],
			],
			'manage_workout_set' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Create, correct, or delete a logged workout set. Resolve the active session and exercise from live workout data; require a set id for update/delete.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'action' => [ 'type' => 'string', 'enum' => [ 'create', 'update', 'delete' ] ], 'set_id' => [ 'type' => 'integer', 'minimum' => 1 ],
					'session_exercise_id' => [ 'type' => 'integer', 'minimum' => 1 ], 'exercise_name' => [ 'type' => 'string' ],
					'set_number' => [ 'type' => 'integer', 'minimum' => 1 ], 'weight' => [ 'type' => 'number', 'minimum' => 0 ],
					'reps' => [ 'type' => 'integer', 'minimum' => 0 ], 'duration_seconds' => [ 'type' => 'integer', 'minimum' => 0, 'maximum' => 3600 ],
					'circuit_round' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 20 ], 'rir' => [ 'type' => 'number', 'minimum' => 0, 'maximum' => 10 ],
					'rpe' => [ 'type' => 'number', 'minimum' => 0, 'maximum' => 10 ], 'pain_flag' => [ 'type' => 'boolean' ], 'notes' => [ 'type' => 'string' ],
				], 'required' => [ 'action' ], 'additionalProperties' => false ],
			],
			'complete_workout' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Complete the active workout only when the user explicitly says the session is finished.',
				'parameters' => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'cancel_workout' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Cancel or clear the current queued or active workout when the user explicitly asks to cancel, discard, clear, or start over. Never use complete_workout for this intent.',
				'parameters' => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'restart_workout_timer' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Reset the active workout clock to zero while preserving the active session, exercises, and logged sets. Use only when the user asks to restart the timer or clock.',
				'parameters' => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
			],
			'log_body_measurement' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Log a weight/body measurement entry. Weight is required; waist, body fat, resting heart rate, notes, and date are optional.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'weight_lb' => [ 'type' => 'number', 'minimum' => 1 ], 'waist_in' => [ 'type' => 'number', 'minimum' => 1 ],
					'body_fat_pct' => [ 'type' => 'number', 'minimum' => 1, 'maximum' => 100 ], 'resting_hr' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 250 ],
					'notes' => [ 'type' => 'string' ], 'date' => [ 'type' => 'string' ],
				], 'required' => [ 'weight_lb' ], 'additionalProperties' => false ],
			],
			'manage_health_log' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Correct or delete an existing weight, sleep, steps, or cardio log by id. Only use delete after explicit confirmation.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'log_type' => [ 'type' => 'string', 'enum' => [ 'weight', 'sleep', 'steps', 'cardio' ] ], 'action' => [ 'type' => 'string', 'enum' => [ 'update', 'delete' ] ],
					'id' => [ 'type' => 'integer', 'minimum' => 1 ], 'date' => [ 'type' => 'string' ], 'weight_lb' => [ 'type' => 'number' ],
					'waist_in' => [ 'type' => 'number' ], 'body_fat_pct' => [ 'type' => 'number' ], 'resting_hr' => [ 'type' => 'integer' ],
					'hours_sleep' => [ 'type' => 'number' ], 'sleep_quality' => [ 'type' => 'string' ], 'steps' => [ 'type' => 'integer' ],
					'cardio_type' => [ 'type' => 'string' ], 'duration_minutes' => [ 'type' => 'integer' ], 'intensity' => [ 'type' => 'string' ],
					'estimated_calories' => [ 'type' => 'integer' ], 'notes' => [ 'type' => 'string' ],
				], 'required' => [ 'log_type', 'action', 'id' ], 'additionalProperties' => false ],
			],
			'log_water' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Set today’s total glasses of water when the user asks Johnny to record hydration.',
				'parameters' => [ 'type' => 'object', 'properties' => [ 'glasses' => [ 'type' => 'integer', 'minimum' => 0, 'maximum' => 8 ], 'date' => [ 'type' => 'string' ] ], 'required' => [ 'glasses' ], 'additionalProperties' => false ],
			],
			'manage_meal' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Correct or delete an existing logged meal by id. Updates replace its item list; deletion requires explicit confirmation.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'action' => [ 'type' => 'string', 'enum' => [ 'update', 'delete' ] ], 'id' => [ 'type' => 'integer', 'minimum' => 1 ],
					'meal_type' => [ 'type' => 'string' ], 'meal_datetime' => [ 'type' => 'string' ], 'items' => [ 'type' => 'array', 'items' => [ 'type' => 'object' ] ],
				], 'required' => [ 'action', 'id' ], 'additionalProperties' => false ],
			],
			'manage_saved_meal' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Create, update, delete, or log a reusable saved meal. Delete requires explicit confirmation.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'action' => [ 'type' => 'string', 'enum' => [ 'create', 'update', 'delete', 'log' ] ], 'id' => [ 'type' => 'integer', 'minimum' => 1 ],
					'name' => [ 'type' => 'string' ], 'meal_type' => [ 'type' => 'string' ], 'meal_datetime' => [ 'type' => 'string' ],
					'items' => [ 'type' => 'array', 'items' => [ 'type' => 'object' ] ],
				], 'required' => [ 'action' ], 'additionalProperties' => false ],
			],
			'update_goals' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Update user fitness targets after explicit instruction: goal type/rate, calories, macros, steps, sleep, or target weight.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'goal_type' => [ 'type' => 'string' ], 'goal_rate' => [ 'type' => 'string' ], 'target_weight_lb' => [ 'type' => 'number' ],
					'target_calories' => [ 'type' => 'integer' ], 'target_protein_g' => [ 'type' => 'integer' ], 'target_carbs_g' => [ 'type' => 'integer' ],
					'target_fat_g' => [ 'type' => 'integer' ], 'target_steps' => [ 'type' => 'integer' ], 'target_sleep_hours' => [ 'type' => 'number' ],
				], 'additionalProperties' => false ],
			],
			'update_profile' => [
				'read_only' => false, 'enabled' => true,
				'description' => 'Update user profile/settings fields only after explicit instruction.',
				'parameters' => [ 'type' => 'object', 'properties' => [
					'first_name' => [ 'type' => 'string' ], 'last_name' => [ 'type' => 'string' ], 'date_of_birth' => [ 'type' => 'string' ],
					'sex' => [ 'type' => 'string' ], 'height_cm' => [ 'type' => 'number' ], 'training_experience' => [ 'type' => 'string' ],
					'activity_level' => [ 'type' => 'string' ], 'available_time_default' => [ 'type' => 'string' ], 'phone' => [ 'type' => 'string' ],
					'timezone' => [ 'type' => 'string' ], 'units' => [ 'type' => 'string' ],
				], 'additionalProperties' => false ],
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
			'remove_pantry_items' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Remove one or more named items from the user pantry when the user explicitly asks Johnny to remove them.',
				'parameters'  => self::named_item_list_parameters(),
			],
			'add_grocery_gap_items' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Add one or more items to the user shopping list. Also use this for ingredients from a recipe Johnny just created or the user requested; first compare with the pantry snapshot and add only ingredients that are missing.',
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
			'add_recipe_ingredients_to_grocery_list' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Add the missing ingredients for a named recipe selected from the recipe catalog or cookbook to the user shopping list. This compares the recipe with pantry inventory and avoids adding on-hand ingredients.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'recipe_name' => [ 'type' => 'string' ],
						'recipe_key'  => [ 'type' => 'string' ],
					],
					'additionalProperties' => false,
				],
			],
			'remove_grocery_gap_items' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Remove one or more named items from the user shopping list when the user explicitly asks Johnny to remove them.',
				'parameters'  => self::named_item_list_parameters(),
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
			'clear_conversation' => [
				'read_only'   => false,
				'enabled'     => true,
				'description' => 'Permanently clear the current Johnny chat history when the user explicitly asks to clear, delete, or reset this chat or conversation.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => new \stdClass(),
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

	public static function get_required_chat_tool( array $tool_registry, string $mode = 'general', array $context_overrides = [], string $user_message = '' ): string {
		$request_context = self::derive_tool_request_context( $mode, $context_overrides, $user_message );
		$tool_name = self::explicit_image_generation_requested( $user_message ) ? 'generate_image' : '';
		if ( '' === $tool_name && self::weight_history_requested( $user_message ) ) {
			$tool_name = 'get_weight_history';
		}
		if ( '' === $tool_name && self::conversation_clear_requested( $user_message ) ) {
			$tool_name = 'clear_conversation';
		}
		if ( '' === $tool_name && self::concrete_workout_creation_requested( $user_message ) ) {
			$tool_name = 'create_custom_workout';
		}
		if ( '' === $tool_name ) {
			return '';
		}

		$tool = $tool_registry[ $tool_name ] ?? null;
		if ( ! is_array( $tool ) || empty( $tool['enabled'] ) || ! self::tool_allowed_for_request( $tool_name, $request_context ) ) {
			return '';
		}

		return $tool_name;
	}

	private static function weight_history_requested( string $user_message ): bool {
		$message = strtolower( trim( $user_message ) );
		if ( '' === $message || ! self::message_contains_any( $message, [ 'weight', 'weigh-in', 'weigh in', 'bodyweight', 'body weight' ] ) ) {
			return false;
		}

		return self::message_contains_any( $message, [ 'progress', 'trend', 'history', 'loss', 'lost', 'change', 'changing', 'chart', 'graph', 'over time', 'looking like' ] );
	}

	private static function conversation_clear_requested( string $user_message ): bool {
		$message = strtolower( trim( $user_message ) );
		if ( '' === $message || ! self::message_contains_any( $message, [ 'chat', 'conversation', 'thread', 'chat history', 'conversation history' ] ) ) {
			return false;
		}

		return self::message_contains_any( $message, [ 'clear', 'delete', 'erase', 'reset', 'remove', 'start over' ] );
	}

	private static function concrete_workout_creation_requested( string $user_message ): bool {
		$message = strtolower( trim( $user_message ) );
		if ( '' === $message || self::message_contains_any( $message, [ 'how do i', 'how can i', 'can you create workouts', 'are you able', 'do not create', "don't create", 'not yet' ] ) ) {
			return false;
		}

		$workout_context = self::message_contains_any( $message, [ 'workout', 'training session', 'gym session', 'circuit' ] );
		$creation_intent = self::message_contains_any( $message, [ 'create', 'build', 'make', 'put together', 'assemble', 'plan', 'give me', 'set up', 'use these', 'add these' ] );
		return $workout_context && $creation_intent;
	}

	private static function pick_fallback_phrase( array $phrases ): string {
		return $phrases[ array_rand( $phrases ) ];
	}

	public static function build_tool_action_fallback_reply( array $action_results, array $used_tools = [], array $tool_errors = [] ): string {
		$mutation_tools = [ 'approve_workout', 'modify_workout', 'start_workout', 'swap_workout_exercise', 'manage_workout_set', 'cancel_workout', 'restart_workout_timer', 'complete_workout', 'create_custom_workout', 'save_workout_to_library', 'load_saved_workout', 'remove_saved_workout', 'create_food_tile' ];
		$recovered_pending_replacement = false;
		foreach ( $action_results as $action_result ) {
			if ( ! empty( $action_result['completed_pending_replacement'] ) ) { $recovered_pending_replacement = true; break; }
		}
		foreach ( array_reverse( $tool_errors ) as $tool_error ) {
			$tool_name = sanitize_key( (string) ( $tool_error['tool_name'] ?? '' ) );
			if ( in_array( $tool_name, $mutation_tools, true ) && ! ( $recovered_pending_replacement && 'modify_workout' === $tool_name ) ) {
				$error = sanitize_text_field( (string) ( $tool_error['error'] ?? 'The requested change could not be completed.' ) );
				return 'I couldn’t complete that change: ' . $error;
			}
		}

		$preferred_result = [];
		foreach ( array_reverse( $action_results ) as $action_result ) {
			$tool_name = sanitize_key( (string) ( $action_result['action'] ?? $action_result['tool_name'] ?? '' ) );
			if ( ! empty( $action_result['summary'] ) && ( empty( $preferred_result ) || in_array( $tool_name, $mutation_tools, true ) ) ) {
				$preferred_result = $action_result;
				if ( in_array( $tool_name, $mutation_tools, true ) ) break;
			}
		}
		if ( ! empty( $preferred_result['summary'] ) ) {
			$summary = sanitize_text_field( (string) $preferred_result['summary'] );
			return (string) preg_replace( '/^Johnny\s+/i', 'I ', $summary );
		}

		if ( ! empty( $action_results ) ) {
			$last_result = end( $action_results );
			$action_name = sanitize_key( (string) ( $last_result['action'] ?? $last_result['tool_name'] ?? '' ) );
			return match ( $action_name ) {
				'create_custom_workout'    => 'I built that workout and queued it for your review.',
				'create_personal_exercise' => 'I added that exercise to your custom library.',
				'save_workout_to_library' => 'I saved that workout to My Workouts.',
				'load_saved_workout'       => 'I loaded that workout and have it ready for you.',
				'remove_saved_workout'     => 'I removed that workout from My Workouts.',
				'create_food_tile'          => 'I created that food tile and added it to your planning shelf.',
				'create_visualization'     => 'I turned your data into a visual summary.',
				'set_ambient_color'        => self::pick_fallback_phrase( [ 'Vibe updated.', 'New look, same coach.', 'Mood shifted.' ] ),
				'activate_fire_mode'        => self::pick_fallback_phrase( [ 'Lighting it up!', 'Fire mode, let’s go.', 'Turning up the heat.' ] ),
				'trigger_confetti_burst'    => self::pick_fallback_phrase( [ 'Confetti time!', 'Let’s celebrate that.', 'Confetti earned.' ] ),
				'search_gif'                => self::pick_fallback_phrase( [ 'Found a GIF for that.', 'Here’s one for the moment.', 'Got a GIF for that.' ] ),
				'present_choices'          => 'Choose what you want to do next.',
				'generate_image'            => 'I made that image for you.',
				'create_training_plan'     => 'I built your new training plan.',
				'set_training_schedule'    => 'I updated your weekly training schedule.',
				'clear_follow_ups'        => 'I cleared those follow-ups.',
				'clear_conversation'      => self::pick_fallback_phrase( [ 'Chat cleared.', 'Clean slate.', 'Thread cleared.' ] ),
				'clear_sms_reminders'     => 'I canceled those text reminders.',
				'swap_workout_exercise'    => 'I updated the current workout.',
				default                    => 'I checked that, but I haven’t made a change yet.',
			};
		}

		if ( ! empty( $used_tools ) ) {
			return 'I checked the current workout and exercise library, but I haven’t changed the workout yet.';
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

	private static function named_item_list_parameters(): array {
		return [
			'type'                 => 'object',
			'properties'           => [
				'item_name' => [ 'type' => 'string' ],
				'items'     => [
					'type'  => 'array',
					'items' => [
						'type'                 => 'object',
						'properties'           => [ 'item_name' => [ 'type' => 'string' ] ],
						'required'             => [ 'item_name' ],
						'additionalProperties' => false,
					],
				],
			],
			'additionalProperties' => false,
		];
	}

	private static function derive_tool_request_context( string $mode, array $context_overrides, string $user_message ): array {
		$message            = strtolower( trim( $user_message ) );
		$current_screen     = sanitize_key( (string) ( $context_overrides['current_screen'] ?? '' ) );
		$workout_keywords   = [
			'workout', 'workouts', 'circuit', 'full-body', 'full body', 'saved workout', 'workout library', 'my workouts', 'training', 'exercise', 'session', 'split', 'schedule', 'training schedule', 'workout schedule', 'weekly schedule', 'week split', 'weekly split', 'push day', 'pull day', 'leg day', 'upper body', 'lower body', 'bench', 'squat', 'deadlift', 'swap exercise', 'replace exercise',
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
			// Keep creation and saving available through short contextual follow-ups
			// such as "save it in my library" and "try again". The model still
			// receives the explicit-user-request constraint in each tool description.
			'create_custom_workout', 'save_workout_to_library', 'load_saved_workout', 'remove_saved_workout' => true,
			'create_training_plan', 'set_training_schedule', 'create_personal_exercise', 'swap_workout_exercise' => ! empty( $request_context['workout_mutation_allowed'] ),
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

	private static function explicit_image_generation_requested( string $user_message ): bool {
		$message = strtolower( trim( $user_message ) );
		if ( '' === $message || self::message_contains_any( $message, [ "don't generate", 'do not generate', "don't create", 'do not create', 'without generating' ] ) ) {
			return false;
		}
		if ( self::message_contains_any( $message, [ 'what kind of image', 'what kinds of image', 'what type of image', 'what types of image', 'how does image generation', 'tell me about image generation' ] ) ) {
			return false;
		}

		$creation_language = [ 'generate', 'create', 'make', 'draw', 'illustrate', 'design', 'render', 'paint' ];
		$image_language = [ 'image', 'picture', 'photo', 'illustration', 'poster', 'artwork', 'graphic', 'portrait', 'share card', 'wallpaper' ];
		$data_visual_language = [ 'chart', 'graph', 'data infographic', 'progress infographic' ];

		return self::message_contains_any( $message, $creation_language )
			&& self::message_contains_any( $message, $image_language )
			&& ! self::message_contains_any( $message, $data_visual_language );
	}
}
