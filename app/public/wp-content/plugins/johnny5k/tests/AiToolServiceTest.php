<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiService;
use Johnny5k\Services\AiToolService;
use Johnny5k\Tests\Support\ServiceTestCase;

class AiToolServiceTest extends ServiceTestCase {
	public function test_create_custom_workout_tool_accepts_time_tier(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool     = $registry['create_custom_workout'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertSame( 'string', $tool['parameters']['properties']['time_tier']['type'] ?? null );
		$this->assertSame( [ 'standard', 'circuit' ], $tool['parameters']['properties']['workout_structure']['enum'] ?? null );
		$this->assertSame( 'array', $tool['parameters']['properties']['exercises']['type'] ?? null );
		$this->assertSame( 'duration', $tool['parameters']['properties']['exercises']['items']['properties']['target_type']['enum'][1] ?? null );
		$this->assertSame( 'boolean', $tool['parameters']['properties']['exercises']['items']['properties']['reps_per_side']['type'] ?? null );
		$this->assertSame( [ 'name', 'workout_structure', 'exercises' ], $tool['parameters']['required'] ?? [] );
	}

	public function test_visualization_tool_has_a_bounded_safe_schema(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool = $registry['create_visualization'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertTrue( $tool['read_only'] ?? false );
		$this->assertSame( [ 'line', 'bar', 'progress', 'comparison', 'infographic' ], $tool['parameters']['properties']['type']['enum'] ?? [] );
		$this->assertSame( 12, $tool['parameters']['properties']['items']['maxItems'] ?? null );
		$this->assertSame( [ 'type', 'title', 'items' ], $tool['parameters']['required'] ?? [] );
	}

	public function test_decision_rail_tool_has_bounded_choices(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool = $registry['present_choices'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertTrue( $tool['read_only'] ?? false );
		$this->assertSame( 2, $tool['parameters']['properties']['choices']['minItems'] ?? null );
		$this->assertSame( 4, $tool['parameters']['properties']['choices']['maxItems'] ?? null );
		$this->assertSame( [ 'reply', 'navigate' ], $tool['parameters']['properties']['choices']['items']['properties']['type']['enum'] ?? [] );
	}

	public function test_general_image_generation_tool_requires_accessible_metadata(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool = $registry['generate_image'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertFalse( $tool['read_only'] ?? true );
		$this->assertSame( [ 'prompt', 'title', 'alt_text', 'category' ], $tool['parameters']['required'] ?? [] );
		$this->assertContains( 'exercise_illustration', $tool['parameters']['properties']['category']['enum'] ?? [] );
		$this->assertContains( 'johnny_moment', $tool['parameters']['properties']['category']['enum'] ?? [] );
		$this->assertContains( '9:16', $tool['parameters']['properties']['aspect_ratio']['enum'] ?? [] );
		$this->assertSame( 'boolean', $tool['parameters']['properties']['use_johnny_likeness']['type'] ?? null );
	}

	public function test_explicit_image_requests_require_the_image_tool(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertSame( 'generate_image', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Create an image of Johnny coaching a sunrise workout.' ) );
		$this->assertSame( 'generate_image', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Design a workout poster for Monday Circuit.' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'What kinds of images can you generate?' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Create a chart of my weekly steps.' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Do not generate an image yet.' ) );
		$this->assertSame( 'create_custom_workout', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Build me a new full-body circuit for today.' ) );
		$this->assertSame( 'create_custom_workout', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Put together a strength workout for me.' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'How do I build a workout?' ) );
		$this->assertSame( 'create_custom_workout', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Use these exercises to create my workout: Pendulum Squat, Hatfield Split Squat, and Cable Y Raise.' ) );
		$this->assertStringContainsString( 'automatically creates any missing exercises', $registry['create_custom_workout']['description'] ?? '' );
	}

	public function test_weight_progress_requests_require_complete_weight_history(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertSame( 'get_weight_history', AiToolService::get_required_chat_tool( $registry, 'general', [], 'What has my weight progress been looking like?' ) );
		$this->assertSame( 'get_weight_history', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Show me a graph of my weight loss.' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'What is my latest weight?' ) );
	}

	public function test_explicit_conversation_clear_requests_require_clear_tool(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'clear_conversation', $registry );
		$this->assertSame( 'clear_conversation', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Clear the chat.' ) );
		$this->assertSame( 'clear_conversation', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Delete this conversation for me.' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Clear my pending follow-ups.' ) );
	}

	public function test_explicit_onboarding_requests_require_activation_tool(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'activate_onboarding', $registry );
		$this->assertSame( 'activate_onboarding', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Restart my onboarding.' ) );
		$this->assertSame( 'activate_onboarding', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Can you restart my onboarding?' ) );
		$this->assertSame( 'activate_onboarding', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Update my coaching setup.' ) );
		$this->assertSame( '', AiToolService::get_required_chat_tool( $registry, 'general', [], 'What is onboarding?' ) );
		$this->assertSame( 'activate_onboarding', AiToolService::get_required_chat_tool( $registry, 'general', [], 'Can you restart onboarding?' ) );
	}

	public function test_tool_fallbacks_speak_in_johnnys_first_person_voice(): void {
		$this->assertSame(
			'I updated your plan.',
			AiToolService::build_tool_action_fallback_reply( [ [ 'summary' => 'Johnny updated your plan.' ] ] )
		);
		$this->assertSame(
			'I saved that workout to My Workouts.',
			AiToolService::build_tool_action_fallback_reply( [ [ 'action' => 'save_workout_to_library' ] ] )
		);
		$this->assertSame(
			'I checked that, but I haven’t made a change yet.',
			AiToolService::build_tool_action_fallback_reply( [ [ 'action' => 'unknown_action' ] ] )
		);
		$this->assertStringNotContainsString( 'Johnny', AiToolService::build_tool_action_fallback_reply( [], [ 'unknown_tool' ] ) );
		$this->assertSame(
			'I couldn’t complete that change: Replacement was not found.',
			AiToolService::build_tool_action_fallback_reply(
				[ [ 'tool_name' => 'get_current_workout' ] ],
				[ 'get_current_workout', 'modify_workout' ],
				[ [ 'tool_name' => 'modify_workout', 'error' => 'Replacement was not found.' ] ]
			)
		);
		$this->assertSame(
			'Replaced Barbell Bench Press with Dumbbell Bench Press.',
			AiToolService::build_tool_action_fallback_reply(
				[ [ 'tool_name' => 'create_personal_exercise', 'completed_pending_replacement' => true, 'summary' => 'Replaced Barbell Bench Press with Dumbbell Bench Press.' ] ],
				[ 'modify_workout', 'create_personal_exercise' ],
				[ [ 'tool_name' => 'modify_workout', 'error' => 'Replacement was not found.' ] ]
			)
		);
	}

	public function test_modify_workout_registers_atomic_replace_action(): void {
		$schema = AiToolService::tool_registry( 5, 5, 5 )['modify_workout']['parameters'] ?? [];
		$this->assertContains( 'replace', $schema['properties']['action']['enum'] ?? [] );
		$this->assertArrayHasKey( 'replacement_exercise_name', $schema['properties'] ?? [] );
	}

	public function test_exercise_demo_lookup_returns_direct_embed_and_johnny_description(): void {
		$this->setOption( 'jf_openai_api_key', 'test-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'id' => 'exercise-demo-response',
				'output' => [
					[ 'type' => 'web_search_call', 'id' => 'search-1', 'status' => 'completed' ],
					[ 'type' => 'message', 'content' => [[
						'type' => 'output_text',
						'text' => '{"description":"I pin my shoulders to the bench before unracking. Lower the dumbbells with control and press without losing that position.","video_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","video_title":"Dumbbell Bench Press Form"}',
					]] ],
				],
				'usage' => [ 'input_tokens' => 100, 'output_tokens' => 40 ],
			] ),
		] );

		$result = AiService::find_exercise_demo( 42, 'Dumbbell Bench Press', [ 'equipment' => 'dumbbell', 'primary_muscle' => 'chest' ] );

		$this->assertSame( 'dQw4w9WgXcQ', $result['video_id'] ?? '' );
		$this->assertSame( '', $result['embed_url'] ?? null );
		$this->assertFalse( $result['embed_verified'] ?? true );
		$this->assertStringContainsString( 'I pin my shoulders', $result['description'] ?? '' );
		$request = json_decode( (string) ( $GLOBALS['johnny5k_test_http_log']['post'][0]['args']['body'] ?? '' ), true );
		$this->assertContains( [ 'type' => 'web_search' ], $request['tools'] ?? [] );
	}

	public function test_responses_request_forces_only_the_first_image_tool_call(): void {
		$this->setOption( 'jf_openai_api_key', 'test-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'id' => 'response-1',
				'output' => [[
					'type' => 'function_call',
					'name' => 'generate_image',
					'call_id' => 'image-call-1',
					'arguments' => wp_json_encode( [ 'prompt' => 'Sunrise workout' ] ),
				]],
			] ),
		] );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'id' => 'response-2',
				'output' => [[
					'type' => 'message',
					'content' => [[ 'type' => 'output_text', 'text' => 'Made it.' ]],
				]],
			] ),
		] );

		$result = $this->invokePrivateStatic( AiService::class, 'call_openai', [
			[[
				'role' => 'user',
				'content' => 'Create an image of a sunrise workout.',
			]],
			'gpt-4o-mini',
			[
				'function_tools' => [[
					'type' => 'function',
					'name' => 'generate_image',
					'description' => 'Generate an image.',
					'parameters' => [ 'type' => 'object', 'properties' => [] ],
				]],
				'required_function_tool' => 'generate_image',
				'tool_executor' => static fn(): array => [ 'action' => 'generate_image', 'image_id' => 'image-1' ],
			],
		] );

		$this->assertSame( [ 'generate_image' ], $result['used_tools'] ?? [] );
		$requests = $GLOBALS['johnny5k_test_http_log']['post'];
		$first_payload = json_decode( (string) ( $requests[0]['args']['body'] ?? '' ), true );
		$second_payload = json_decode( (string) ( $requests[1]['args']['body'] ?? '' ), true );
		$this->assertSame( [ 'type' => 'function', 'name' => 'generate_image' ], $first_payload['tool_choice'] ?? null );
		$this->assertSame( 'auto', $second_payload['tool_choice'] ?? null );
	}

	public function test_failed_tool_call_preserves_the_real_error(): void {
		$this->setOption( 'jf_openai_api_key', 'test-key' );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'id' => 'response-1',
				'output' => [[
					'type' => 'function_call',
					'name' => 'generate_image',
					'call_id' => 'image-call-1',
					'arguments' => '{}',
				]],
			] ),
		] );
		$this->queueHttpPostResponse( [
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode( [
				'id' => 'response-2',
				'output' => [[
					'type' => 'message',
					'content' => [[ 'type' => 'output_text', 'text' => 'I made it.' ]],
				]],
			] ),
		] );

		$result = $this->invokePrivateStatic( AiService::class, 'call_openai', [
			[[ 'role' => 'user', 'content' => 'Generate an image.' ]],
			'gpt-4o-mini',
			[
				'function_tools' => [[
					'type' => 'function',
					'name' => 'generate_image',
					'description' => 'Generate an image.',
					'parameters' => [ 'type' => 'object', 'properties' => [] ],
				]],
				'required_function_tool' => 'generate_image',
				'tool_executor' => static fn(): array => [ 'error' => 'OpenAI rejected the image request.' ],
			],
		] );

		$this->assertSame( [], $result['action_results'] ?? null );
		$this->assertSame( [[
			'tool_name' => 'generate_image',
			'error' => 'OpenAI rejected the image request.',
		]], $result['tool_errors'] ?? null );
	}

	public function test_required_image_reply_only_claims_success_with_a_saved_image_id(): void {
		$failed = $this->invokePrivateStatic( AiService::class, 'normalize_required_tool_reply', [
			'generate_image',
			'I generated it.',
			[],
			[[ 'tool_name' => 'generate_image', 'error' => 'Image quota reached.' ]],
		] );
		$this->assertSame( 'I couldn\'t generate that image. Image quota reached.', $failed );

		$succeeded = $this->invokePrivateStatic( AiService::class, 'normalize_required_tool_reply', [
			'generate_image',
			'I could not do that.',
			[[ 'action' => 'generate_image', 'image_id' => 'image-1', 'title' => 'a sunflower' ]],
			[],
		] );
		$this->assertSame( 'I generated a sunflower for you.', $succeeded );
	}

	public function test_set_training_schedule_tool_accepts_weekly_entries(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tool     = $registry['set_training_schedule'] ?? null;

		$this->assertIsArray( $tool );
		$this->assertFalse( $tool['read_only'] ?? true );
		$this->assertSame( 'array', $tool['parameters']['properties']['preferred_workout_days_json']['type'] ?? null );
		$this->assertSame( [ 'preferred_workout_days_json' ], $tool['parameters']['required'] ?? [] );
	}

	public function test_saved_workout_tools_are_registered_and_exposed_for_workout_requests(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$this->assertArrayHasKey( 'get_saved_workouts', $registry );
		$this->assertArrayHasKey( 'save_workout_to_library', $registry );
		$this->assertArrayHasKey( 'load_saved_workout', $registry );
		$this->assertTrue( $registry['get_saved_workouts']['read_only'] ?? false );
		$this->assertFalse( $registry['save_workout_to_library']['read_only'] ?? true );
		$this->assertSame( 'integer', $registry['load_saved_workout']['parameters']['properties']['id']['type'] ?? null );

		$tools = AiToolService::get_chat_function_tools( $registry, 'general', [], 'Load Monday Circuit from My Workouts.' );
		$names = array_map( static fn( array $tool ): string => (string) ( $tool['name'] ?? '' ), $tools );
		$this->assertContains( 'save_workout_to_library', $names );
		$this->assertContains( 'load_saved_workout', $names );
		$this->assertContains( 'get_saved_workouts', $names );
	}

	public function test_save_workout_tool_survives_short_contextual_follow_ups(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		foreach ( [ 'save it in my library', 'try again', 'load the second one' ] as $message ) {
			$tools = AiToolService::get_chat_function_tools( $registry, 'accountability', [ 'current_screen' => 'dashboard' ], $message );
			$names = array_map( static fn( array $tool ): string => (string) ( $tool['name'] ?? '' ), $tools );
			$this->assertContains( 'save_workout_to_library', $names, $message );
			$this->assertContains( 'load_saved_workout', $names, $message );
		}
	}

	public function test_custom_workout_tool_is_always_available_for_semantic_model_selection(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tools    = AiToolService::get_chat_function_tools( $registry, 'general', [], 'Surprise me with something useful at the gym today.' );
		$names    = array_map( static fn( array $tool ): string => (string) ( $tool['name'] ?? '' ), $tools );

		$this->assertContains( 'create_custom_workout', $names );
		$this->assertStringContainsString( 'not only when they use a specific phrase', $registry['create_custom_workout']['description'] ?? '' );
	}

	public function test_cardio_and_rest_day_logging_tools_are_registered(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'log_cardio', $registry );
		$this->assertArrayHasKey( 'log_rest_day', $registry );
		$this->assertFalse( $registry['log_cardio']['read_only'] ?? true );
		$this->assertFalse( $registry['log_rest_day']['read_only'] ?? true );
		$this->assertSame( [ 'cardio_type', 'duration_minutes', 'intensity' ], $registry['log_cardio']['parameters']['required'] ?? [] );
	}

	public function test_schedule_language_exposes_workout_schedule_tool(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$tools    = AiToolService::get_chat_function_tools( $registry, 'general', [], 'Set my weekly schedule to Monday Wednesday Friday.' );
		$names    = array_map( static fn( array $tool ): string => (string) ( $tool['name'] ?? '' ), $tools );

		$this->assertContains( 'set_training_schedule', $names );
	}

	public function test_clear_tools_are_registered_for_johnny(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'clear_follow_ups', $registry );
		$this->assertArrayHasKey( 'clear_sms_reminders', $registry );
		$this->assertSame( 'boolean', $registry['clear_follow_ups']['parameters']['properties']['clear_all']['type'] ?? null );
		$this->assertSame( 'boolean', $registry['clear_sms_reminders']['parameters']['properties']['clear_all']['type'] ?? null );
	}

	public function test_recipe_tools_are_registered_for_recipe_review_and_cookbook_save(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );

		$this->assertArrayHasKey( 'get_recipe_catalog', $registry );
		$this->assertArrayHasKey( 'get_recipe_cookbook', $registry );
		$this->assertArrayHasKey( 'add_recipe_to_cookbook', $registry );
		$this->assertFalse( $registry['add_recipe_to_cookbook']['read_only'] ?? true );
		$this->assertSame( 'string', $registry['add_recipe_to_cookbook']['parameters']['properties']['recipe_key']['type'] ?? null );
	}

	public function test_complete_johnny_mutation_tool_batch_is_registered(): void {
		$registry = AiToolService::tool_registry( 5, 5, 5 );
		$expected = [
			'approve_workout', 'search_exercises', 'modify_workout', 'start_workout', 'manage_workout_set', 'cancel_workout', 'restart_workout_timer', 'complete_workout',
			'log_body_measurement', 'manage_health_log', 'log_water', 'manage_meal', 'manage_saved_meal', 'update_goals', 'update_profile',
		];
		foreach ( $expected as $name ) {
			$this->assertArrayHasKey( $name, $registry );
			$this->assertTrue( $registry[ $name ]['enabled'] ?? false );
			$this->assertArrayHasKey( 'parameters', $registry[ $name ] );
		}
		$this->assertTrue( $registry['search_exercises']['read_only'] ?? false );
		$this->assertFalse( $registry['manage_health_log']['read_only'] ?? true );
		$this->assertSame( [ 'update', 'delete' ], $registry['manage_health_log']['parameters']['properties']['action']['enum'] ?? [] );
	}
}
