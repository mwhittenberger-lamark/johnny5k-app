<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\DashboardController;

/**
 * AI Service — Johnny 5000
 *
 * All OpenAI Responses API calls go through here.
 * The Johnny 5000 personality is compiled from the admin personality editor
 * and stored in the `jf_johnny_system_prompt` option.
 *
 * Each user interaction type has its own context-building method so the
 * prompt is always data-rich and relevant.
 */
class AiService {

	private const DEFAULT_MODEL    = 'gpt-4o-mini';
	private const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
	private const SUPPORTED_ACTION_SCREENS = [ 'nutrition', 'saved_meals', 'recipes', 'grocery_gap', 'pantry', 'steps', 'sleep', 'weight', 'workouts', 'cardio', 'workout', 'dashboard' ];
	private const SUPPORTED_WORKFLOWS = [ 'fix_macros', 'plan_next_meal', 'close_grocery_gap', 'review_recovery', 'build_tomorrow_plan' ];
	private const DURABLE_MEMORY_META_KEY = 'jf_johnny_durable_memory';
	private const FOLLOW_UP_META_KEY = 'jf_johnny_follow_ups';
	private const FOLLOW_UP_HISTORY_META_KEY = 'jf_johnny_follow_up_history';
	private const MAX_TOOL_MEAL_ROWS = 12;
	private const MAX_TOOL_PANTRY_ROWS = 24;
	private const MAX_TOOL_RECIPE_ROWS = 12;
	private const MAX_PENDING_FOLLOW_UPS = 6;
	private const MAX_FOLLOW_UP_HISTORY_ITEMS = 30;
	private const MISSED_FOLLOW_UP_HOURS = 24;

	/** Minimum assistant turns before the first thread summary is generated. */
	private const SUMMARY_MIN_TURNS = 4;

	/** Regenerate the thread summary after every N assistant turns. */
	private const SUMMARY_REFRESH_INTERVAL = 5;

	/** Minimum messages required to generate a thread summary. */
	private const SUMMARY_MIN_MESSAGES = 6;

	/** Calorie tolerance (kcal) above/below target before flagging as off-track. */
	private const CALORIE_TOLERANCE_KCAL = 200;

	// ── Chat with Johnny 5000 ─────────────────────────────────────────────────

	/**
	 * Send a user message in a thread and return Johnny's reply.
	 *
	 * Persists conversation to wp_fit_ai_messages via the supplied thread_key.
	 *
	 * @param  int    $user_id
	 * @param  string $thread_key  Unique identifier for this conversation thread.
	 * @param  string $user_message
	 * @return array{reply:string, tokens_in:int, tokens_out:int, sources:array<int,array{url:string,title:string}>, used_web_search:bool, model:string, used_tools:array<int,string>, action_results:array<int,array<string,mixed>>}|WP_Error
	 */
	public static function chat( int $user_id, string $thread_key, string $user_message, string $mode = 'general', array $context_overrides = [] ) {
		global $wpdb;
		$p = $wpdb->prefix;

		// Ensure thread row exists
		$thread = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_ai_threads WHERE thread_key = %s",
			$thread_key
		) );
		if ( ! $thread ) {
			$wpdb->insert( $p . 'fit_ai_threads', [
				'user_id'    => $user_id,
				'thread_key' => $thread_key,
			] );
			$thread_id      = $wpdb->insert_id;
			$thread_summary = '';
		} else {
			$thread_id      = (int) $thread->id;
			$thread_summary = (string) ( $thread->summary_text ?? '' );
		}

		// Load conversation history — query only the last 18 rows at DB level
		$history = $wpdb->get_results( $wpdb->prepare(
			"SELECT role, message_text FROM {$p}fit_ai_messages
			 WHERE thread_id = %d AND role IN ('user','assistant')
			 ORDER BY id DESC LIMIT 18",
			$thread_id
		) );
		$history = array_reverse( $history );

		$messages = [];

		// System prompt (persona + live user context + mode instructions)
		$messages[] = [
			'role'    => 'system',
			'content' => self::build_system_prompt( $user_id, $mode, $context_overrides ),
		];

		// Thread memory block — prepend summary so long-term context is never lost
		if ( $thread_summary ) {
			$messages[] = [
				'role'    => 'system',
				'content' => "Coaching memory for this thread:\n" . $thread_summary,
			];
		}

		// Recent conversation history
		foreach ( $history as $h ) {
			$messages[] = [
				'role'    => $h->role,
				'content' => $h->message_text,
			];
		}

		// New user message
		$messages[] = [
			'role'    => 'user',
			'content' => $user_message,
		];

		// ── Persist user message ──────────────────────────────────────────────
		$wpdb->insert( $p . 'fit_ai_messages', [
			'thread_id'    => $thread_id,
			'role'         => 'user',
			'message_text' => $user_message,
		] );

		// ── Call OpenAI ───────────────────────────────────────────────────────
		$enable_web_search = self::should_enable_web_search( $user_message );
		$result            = self::call_openai(
			$messages,
			self::DEFAULT_MODEL,
			[
				'web_search'    => $enable_web_search,
				'function_tools'=> self::get_chat_function_tools( $mode, $context_overrides, $user_message ),
				'tool_executor' => static fn( string $tool_name, array $arguments = [] ) => self::execute_chat_tool( $user_id, $tool_name, $arguments, $user_message ),
			]
		);
		if ( is_wp_error( $result ) ) return $result;

		$raw_reply  = $result['reply'];
		$tokens_in  = $result['tokens_in'];
		$tokens_out = $result['tokens_out'];

		// ── Parse structured actions if model returned JSON ───────────────────
		$parsed_reply = self::parse_structured_chat_reply( $raw_reply );
		$reply        = $parsed_reply['reply'];
		$actions      = $parsed_reply['actions'];
		$why          = $parsed_reply['why'];
		$context_used = $parsed_reply['context_used'];
		$confidence   = $parsed_reply['confidence'];
		$queued_follow_ups = self::store_queued_follow_ups( $user_id, $actions );

		// ── Persist assistant reply (plain text only) ─────────────────────────
		$assistant_metadata = array_filter([
			'actions'           => $actions,
			'sources'           => $result['sources'],
			'used_tools'        => $result['used_tools'],
			'action_results'    => $result['action_results'] ?? [],
			'queued_follow_ups' => $queued_follow_ups,
			'why'               => $why,
			'context_used'      => $context_used,
			'confidence'        => $confidence,
		], static function( $value ) {
			if ( is_array( $value ) ) {
				return ! empty( $value );
			}

			return null !== $value && '' !== $value;
		} );

		$assistant_row = [
			'thread_id'    => $thread_id,
			'role'         => 'assistant',
			'message_text' => $reply,
		];
		if ( ! empty( $assistant_metadata ) ) {
			$assistant_row['tool_payload_json'] = wp_json_encode( $assistant_metadata );
		}
		$wpdb->insert( $p . 'fit_ai_messages', $assistant_row );

		// ── Refresh thread summary every 5 assistant turns ────────────────────
		self::maybe_refresh_thread_summary( $thread_id, $user_id );

		// ── Log cost ─────────────────────────────────────────────────────────
		CostTracker::log_openai(
			$user_id,
			$result['model'],
			'/v1/responses',
			$tokens_in,
			$tokens_out,
			[
				'thread_key'      => $thread_key,
				'used_web_search' => $result['used_web_search'] ? 1 : 0,
				'used_tools'      => $result['used_tools'],
			]
		);

		return [
			'reply'           => $reply,
			'actions'         => $actions,
			'tokens_in'       => $tokens_in,
			'tokens_out'      => $tokens_out,
			'sources'         => $result['sources'],
			'used_web_search' => $result['used_web_search'],
			'model'           => $result['model'],
			'used_tools'      => $result['used_tools'],
			'action_results'  => $result['action_results'] ?? [],
			'queued_follow_ups' => $queued_follow_ups,
			'why'             => $why,
			'context_used'    => $context_used,
			'confidence'      => $confidence,
		];
	}

	/**
	 * Run a one-off preview chat without persisting thread history.
	 *
	 * @return array{reply:string, actions:array<int,array<string,mixed>>, tokens_in:int, tokens_out:int, sources:array<int,array{url:string,title:string}>, used_web_search:bool, model:string, system_prompt:string, context:array<string,mixed>}|WP_Error
	 */
	public static function preview_chat( int $user_id, string $user_message, string $mode = 'general', array $context_overrides = [] ) {
		$system_prompt = self::build_system_prompt( $user_id, $mode, $context_overrides );

		$result = self::call_openai(
			[
				[
					'role'    => 'system',
					'content' => $system_prompt,
				],
				[
					'role'    => 'user',
					'content' => $user_message,
				],
			],
			self::DEFAULT_MODEL,
			[ 'web_search' => false ]
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed_reply = self::parse_structured_chat_reply( (string) $result['reply'] );

		return [
			'reply'           => $parsed_reply['reply'],
			'actions'         => $parsed_reply['actions'],
			'why'             => $parsed_reply['why'],
			'context_used'    => $parsed_reply['context_used'],
			'confidence'      => $parsed_reply['confidence'],
			'tokens_in'       => $result['tokens_in'],
			'tokens_out'      => $result['tokens_out'],
			'sources'         => $result['sources'],
			'used_web_search' => $result['used_web_search'],
			'model'           => $result['model'],
			'system_prompt'   => $system_prompt,
			'context'         => self::get_user_context( $user_id, $context_overrides ),
		];
	}

	// ── One-shot context-aware analysis ──────────────────────────────────────

	/**
	 * Analyse a meal/food photo sent as a base64 URL.
	 *
	 * @param  int    $user_id
	 * @param  string $image_base64_url  data:image/jpeg;base64,...
	 * @param  string $context           'meal_photo'|'food_label'
	 * @return array|WP_Error  Structured nutrition estimate.
	 */
	public static function analyse_food_image( int $user_id, string $image_base64_url, string $context = 'meal_photo' ) {
		$context_data = self::get_user_context( $user_id );
		$prompt = $context === 'food_label'
			? sprintf(
				'Extract the product name, brand, serving size, calories, protein, carbs, fat, fiber, sugar, sodium, and any visible vitamin or mineral amounts from this nutrition label. The user goal is %1$s, calorie target is %2$s, protein target is %3$s. Return only valid JSON with this exact shape: {food_name, brand, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros:[{key,label,amount,unit}], fit_summary, flags:[string], swap_suggestions:[{title, body}]}. Use an empty array for micros if the label does not show vitamins or minerals. Keep fit_summary to one sentence. Flags should be short lowercase phrases. swap_suggestions should give 1-3 concrete healthier variations or replacement ideas that match the user goal.',
				$context_data['goal_type'] ?: 'maintain',
				$context_data['target_calories'] ?: 'unknown',
				$context_data['target_protein_g'] ?: 'unknown'
			)
			: 'Estimate the nutrition for this meal photo. Return as JSON: {meal_name, items:[{name, serving_size, calories, protein_g, carbs_g, fat_g}], total_calories, total_protein_g, total_carbs_g, total_fat_g, confidence(0-1)}.';

		$messages = [
			[
				'role'    => 'system',
				'content' => 'You are a precise sports nutrition analyst. Always return valid JSON and nothing else.',
			],
			[
				'role'    => 'user',
				'content' => [
					[ 'type' => 'input_text',  'text'      => $prompt ],
					[ 'type' => 'input_image', 'image_url' => $image_base64_url ],
				],
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o' );
		if ( is_wp_error( $result ) ) return $result;

		CostTracker::log_openai( $user_id, 'gpt-4o', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => $context ] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI nutrition response.' );
		}

		if ( 'food_label' === $context ) {
			$parsed = self::normalise_label_analysis( $parsed );
		} else {
			$parsed = self::normalise_meal_analysis( $parsed );
		}

		return $parsed;
	}

	/**
	 * Analyse a typed food description and return estimated macros and micros.
	 *
	 * @param int $user_id
	 * @param string $food_text
	 * @return array|WP_Error
	 */
	public static function analyse_food_text( int $user_id, string $food_text ) {
		$food_text = trim( $food_text );
		if ( '' === $food_text ) {
			return new \WP_Error( 'missing_food_text', 'No food description provided.' );
		}

		$context_data = self::get_user_context( $user_id );
		$messages = [
			[
				'role'    => 'system',
				'content' => 'You are a precise sports nutrition analyst. Always return valid JSON and nothing else.',
			],
			[
				'role'    => 'user',
				'content' => sprintf(
					'Estimate the nutrition for this typed food or meal entry: "%1$s". The user goal is %2$s, daily calories %3$s, protein target %4$s. Return only valid JSON with this exact shape: {food_name, brand, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micros:[{key,label,amount,unit}], confidence, notes}. Use best-guess reasonable sports nutrition estimates. For common whole foods and standard grocery items, estimate the most relevant vitamins and minerals instead of leaving micros empty. Include likely nutrients such as calcium, iron, potassium, vitamin_a, vitamin_c, vitamin_d, vitamin_b12, magnesium, zinc, selenium, phosphorus, riboflavin, thiamin, niacin, folate, vitamin_e, or vitamin_k when they are meaningfully present. Only use an empty micros array when the food is too ambiguous to estimate responsibly. Keep notes to one short sentence.',
					$food_text,
					$context_data['goal_type'] ?: 'maintain',
					$context_data['target_calories'] ?: 'unknown',
					$context_data['target_protein_g'] ?: 'unknown'
				),
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o-mini' );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, 'gpt-4o-mini', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'food_text' ] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI food analysis response.' );
		}

		return self::normalise_food_analysis( $parsed );
	}

	/**
	 * Analyse a spoken or typed pantry list and extract pantry items.
	 *
	 * @param int $user_id
	 * @param string $pantry_text
	 * @return array|WP_Error
	 */
	public static function analyse_pantry_text( int $user_id, string $pantry_text ) {
		$pantry_text = trim( $pantry_text );
		if ( '' === $pantry_text ) {
			return new \WP_Error( 'missing_pantry_text', 'No pantry list provided.' );
		}

		$context_data = self::get_user_context( $user_id );
		$messages = [
			[
				'role'    => 'system',
				'content' => 'You are a precise pantry extraction assistant. Always return valid JSON and nothing else.',
			],
			[
				'role'    => 'user',
				'content' => sprintf(
					'Extract pantry items from this spoken or typed list: "%1$s". The user goal is %2$s. Return only valid JSON with this exact shape: {items:[{item_name, quantity, unit, notes}], notes}. Keep item_name short and grocery-friendly. quantity should be numeric when clearly stated, otherwise null. unit should be empty when unclear. notes should be short. notes at the top level should be one brief sentence.',
					$pantry_text,
					$context_data['goal_type'] ?: 'maintain'
				),
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o-mini' );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, 'gpt-4o-mini', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'pantry_text' ] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI pantry response.' );
		}

		return self::normalise_pantry_analysis( $parsed );
	}

	/**
	 * Discover recipe candidates for the admin recipe library.
	 *
	 * @param int $user_id
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>|\WP_Error
	 */
	public static function discover_recipe_library_items( int $user_id, array $args = [] ) {
		$query = trim( (string) ( $args['query'] ?? '' ) );
		$meal_type = sanitize_key( (string) ( $args['meal_type'] ?? '' ) );
		$count = max( 1, min( 10, (int) ( $args['count'] ?? 5 ) ) );
		$meal_label = $meal_type ? $meal_type : 'any';

		if ( '' === $query && '' === $meal_type ) {
			return new \WP_Error( 'missing_recipe_query', 'Provide a recipe search query or meal type.' );
		}

		$messages = [
			[
				'role'    => 'system',
				'content' => 'You are a recipe researcher for a fitness app admin. Use web search when available, prefer reputable recipe publishers, and return valid JSON only.',
			],
			[
				'role'    => 'user',
				'content' => sprintf(
					'Find %1$d strong recipe candidates for a fitness recipe library. Search theme: "%2$s". Meal type focus: %3$s. Return only valid JSON in this exact shape: {recipes:[{recipe_name, meal_type, ingredients:[string], instructions:[string], estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, why_this_works, source_url, source_title}], notes}. Keep ingredients and steps concise summaries, not verbatim copies. Use meal_type values only from breakfast, lunch, dinner, snack. If calories or macros are not explicitly available, estimate them conservatively. why_this_works should be one sentence aimed at a fitness user. Prefer recipes with accessible ingredients and clear prep structure.',
					$count,
					$query ?: 'high-protein meal ideas',
					$meal_label
				),
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o-mini', [ 'web_search' => true ] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, 'gpt-4o-mini', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [
			'context'         => 'recipe_discovery',
			'used_web_search' => $result['used_web_search'] ? 1 : 0,
			'query'           => $query,
			'meal_type'       => $meal_type,
		] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI recipe discovery response.' );
		}

		$recipes = [];
		foreach ( (array) ( $parsed['recipes'] ?? [] ) as $index => $recipe ) {
			if ( ! is_array( $recipe ) ) {
				continue;
			}

			$source = $result['sources'][ $index ] ?? $result['sources'][0] ?? [];
			$recipes[] = [
				'recipe_name'         => sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) ),
				'meal_type'           => sanitize_key( (string) ( $recipe['meal_type'] ?? $meal_type ?: 'lunch' ) ) ?: 'lunch',
				'ingredients'         => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ),
				'instructions'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['instructions'] ?? [] ) ) ) ),
				'estimated_calories'  => (int) ( $recipe['estimated_calories'] ?? 0 ),
				'estimated_protein_g' => (float) ( $recipe['estimated_protein_g'] ?? 0 ),
				'estimated_carbs_g'   => (float) ( $recipe['estimated_carbs_g'] ?? 0 ),
				'estimated_fat_g'     => (float) ( $recipe['estimated_fat_g'] ?? 0 ),
				'why_this_works'      => sanitize_text_field( (string) ( $recipe['why_this_works'] ?? '' ) ),
				'source_url'          => esc_url_raw( (string) ( $recipe['source_url'] ?? ( $source['url'] ?? '' ) ) ),
				'source_title'        => sanitize_text_field( (string) ( $recipe['source_title'] ?? ( $source['title'] ?? '' ) ) ),
				'source_type'         => 'ai_discovery',
			];
		}

		$recipes = array_values( array_filter( $recipes, static function( array $recipe ): bool {
			return '' !== (string) ( $recipe['recipe_name'] ?? '' ) && ! empty( $recipe['ingredients'] ) && ! empty( $recipe['instructions'] );
		} ) );

		return [
			'recipes'         => $recipes,
			'notes'           => sanitize_text_field( (string) ( $parsed['notes'] ?? '' ) ),
			'sources'         => $result['sources'],
			'used_web_search' => $result['used_web_search'],
		];
	}

	/**
	 * Fill missing exercise library fields for an admin-authored exercise draft.
	 *
	 * @param int $user_id
	 * @param array<string,mixed> $exercise
	 * @return array<string,mixed>|\WP_Error
	 */
	public static function fill_exercise_library_item( int $user_id, array $exercise ) {
		$name = trim( (string) ( $exercise['name'] ?? '' ) );
		if ( '' === $name ) {
			return new \WP_Error( 'missing_exercise_name', 'Provide an exercise name before asking AI to fill fields.' );
		}

		$current_fields = [
			'description'              => sanitize_textarea_field( (string) ( $exercise['description'] ?? '' ) ),
			'movement_pattern'         => sanitize_text_field( (string) ( $exercise['movement_pattern'] ?? '' ) ),
			'primary_muscle'           => sanitize_text_field( (string) ( $exercise['primary_muscle'] ?? '' ) ),
			'secondary_muscles'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $exercise['secondary_muscles'] ?? [] ) ) ) ),
			'equipment'                => sanitize_text_field( (string) ( $exercise['equipment'] ?? '' ) ),
			'difficulty'               => sanitize_key( (string) ( $exercise['difficulty'] ?? '' ) ),
			'age_friendliness_score'   => (int) ( $exercise['age_friendliness_score'] ?? 0 ),
			'joint_stress_score'       => (int) ( $exercise['joint_stress_score'] ?? 0 ),
			'spinal_load_score'        => (int) ( $exercise['spinal_load_score'] ?? 0 ),
			'default_rep_min'          => (int) ( $exercise['default_rep_min'] ?? 0 ),
			'default_rep_max'          => (int) ( $exercise['default_rep_max'] ?? 0 ),
			'default_sets'             => (int) ( $exercise['default_sets'] ?? 0 ),
			'default_progression_type' => sanitize_key( (string) ( $exercise['default_progression_type'] ?? '' ) ),
			'coaching_cues'            => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $exercise['coaching_cues'] ?? [] ) ) ) ),
			'day_types'                => array_values( array_filter( array_map( 'sanitize_key', (array) ( $exercise['day_types'] ?? [] ) ) ) ),
			'slot_types'               => array_values( array_filter( array_map( 'sanitize_key', (array) ( $exercise['slot_types'] ?? [] ) ) ) ),
		];

		$messages = [
			[
				'role'    => 'system',
				'content' => 'You are an exercise library builder for a fitness app admin. Use web search when helpful and return valid JSON only. Fill unknown exercise metadata conservatively and practically for general gym users.',
			],
			[
				'role'    => 'user',
				'content' => sprintf(
					'Fill missing library fields for this exercise draft. Exercise name: "%1$s". Existing data: %2$s. Return only valid JSON in this exact shape: {exercise:{description,movement_pattern,primary_muscle,secondary_muscles:[string],equipment,difficulty,age_friendliness_score,joint_stress_score,spinal_load_score,default_rep_min,default_rep_max,default_sets,default_progression_type,coaching_cues:[string],day_types:[string],slot_types:[string]}, notes}. Rules: keep description to 1-2 sentences. If the current description is empty, you must provide a non-empty description. Use only difficulty from beginner, intermediate, advanced. Use only default_progression_type from double_progression, load_progression, top_set_backoff. Use only day_types from push, pull, legs, arms_shoulders, cardio, rest. Use only slot_types from main, secondary, shoulders, accessory, abs, challenge. Scores are integers 1 to 10. Rep ranges and sets should be realistic defaults, not extreme.',
					$name,
					wp_json_encode( $current_fields )
				),
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o-mini', [ 'web_search' => true ] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, 'gpt-4o-mini', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [
			'context'         => 'exercise_fill',
			'used_web_search' => $result['used_web_search'] ? 1 : 0,
			'exercise_name'   => $name,
		] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) || ! is_array( $parsed['exercise'] ?? null ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI exercise fill response.' );
		}

		$normalised_exercise = self::normalise_exercise_library_item( (array) $parsed['exercise'], $name );
		if ( '' === $normalised_exercise['description'] ) {
			$normalised_exercise['description'] = self::build_fallback_exercise_description( $normalised_exercise );
		}

		return [
			'exercise'        => $normalised_exercise,
			'notes'           => sanitize_text_field( (string) ( $parsed['notes'] ?? '' ) ),
			'sources'         => $result['sources'],
			'used_web_search' => $result['used_web_search'],
		];
	}

	/**
	 * Discover exercise candidates that are not already present in the exercise library.
	 *
	 * @param int $user_id
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>|\WP_Error
	 */
	public static function discover_exercise_library_items( int $user_id, array $args = [] ) {
		$query         = trim( (string) ( $args['query'] ?? '' ) );
		$count         = max( 1, min( 10, (int) ( $args['count'] ?? 5 ) ) );
		$exclude_names = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $args['exclude_names'] ?? [] ) ) ) );

		if ( '' === $query ) {
			return new \WP_Error( 'missing_exercise_query', 'Provide an exercise search theme or movement to discover.' );
		}

		$messages = [
			[
				'role'    => 'system',
				'content' => 'You are an exercise researcher for a fitness app admin. Use web search when available, prefer reputable training resources, and return valid JSON only.',
			],
			[
				'role'    => 'user',
				'content' => sprintf(
					'Find %1$d useful exercise candidates for an exercise library based on this search: "%2$s". Exclude any exercise already in this library: %3$s. Return only valid JSON in this exact shape: {exercises:[{name,description,movement_pattern,primary_muscle,secondary_muscles:[string],equipment,difficulty,age_friendliness_score,joint_stress_score,spinal_load_score,default_rep_min,default_rep_max,default_sets,default_progression_type,coaching_cues:[string],day_types:[string],slot_types:[string]}], notes}. Rules: each result must be a distinct exercise name not present in the exclude list. Keep description to 1-2 sentences. Use only difficulty from beginner, intermediate, advanced. Use only default_progression_type from double_progression, load_progression, top_set_backoff. Use only day_types from push, pull, legs, arms_shoulders, cardio, rest. Use only slot_types from main, secondary, shoulders, accessory, abs, challenge. Scores are integers 1 to 10.',
					$count,
					$query,
					$exclude_names ? implode( ', ', $exclude_names ) : 'none'
				),
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o-mini', [ 'web_search' => true ] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, 'gpt-4o-mini', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [
			'context'         => 'exercise_discovery',
			'used_web_search' => $result['used_web_search'] ? 1 : 0,
			'query'           => $query,
		] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI exercise discovery response.' );
		}

		$exercises = [];
		foreach ( (array) ( $parsed['exercises'] ?? [] ) as $exercise ) {
			if ( ! is_array( $exercise ) ) {
				continue;
			}

			$item = self::normalise_exercise_library_item( $exercise );
			if ( '' === $item['name'] ) {
				continue;
			}

			$already_exists = false;
			foreach ( $exclude_names as $exclude_name ) {
				if ( 0 === strcasecmp( $exclude_name, $item['name'] ) ) {
					$already_exists = true;
					break;
				}
			}

			if ( $already_exists ) {
				continue;
			}

			$exercises[] = $item;
		}

		return [
			'exercises'       => array_values( $exercises ),
			'notes'           => sanitize_text_field( (string) ( $parsed['notes'] ?? '' ) ),
			'sources'         => $result['sources'],
			'used_web_search' => $result['used_web_search'],
		];
	}

	/**
	 * Generate a progress photo comparison message.
	 *
	 * @param  int          $user_id
	 * @param  string       $first_photo_url
	 * @param  string       $latest_photo_url
	 * @param  array<string,mixed> $comparison_context
	 * @return string|WP_Error  Encouraging feedback text.
	 */
	public static function analyse_progress_photo( int $user_id, string $first_photo_url, string $latest_photo_url, array $comparison_context = [] ) {
		$profile          = self::get_user_context( $user_id );
		$goal             = sanitize_text_field( (string) ( $profile['goal_type'] ?? 'maintain' ) );
		$compare_context  = self::normalise_progress_photo_context( $comparison_context );
		$compare_prompt   = self::build_progress_photo_compare_prompt( $goal, $compare_context );

		$messages = [
			[
				'role'    => 'system',
				'content' => self::build_progress_photo_system_prompt(),
			],
			[
				'role'    => 'user',
				'content' => [
					[ 'type' => 'input_text', 'text' => $compare_prompt ],
					[ 'type' => 'input_image', 'image_url' => $first_photo_url ],
					[ 'type' => 'input_image', 'image_url' => $latest_photo_url ],
				],
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o' );
		if ( is_wp_error( $result ) ) return $result;

		CostTracker::log_openai( $user_id, 'gpt-4o', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'progress_photo' ] );
		self::log_progress_photo_compare_debug( 'raw_reply', [
			'user_id'    => $user_id,
			'goal'       => $goal,
			'context'    => $compare_context,
			'raw_reply'  => (string) $result['reply'],
			'model'      => (string) ( $result['model'] ?? 'gpt-4o' ),
		] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( is_array( $parsed ) ) {
			$comparison = self::normalise_progress_photo_comparison( $parsed );
			if ( '' !== $comparison ) {
				self::log_progress_photo_compare_debug( 'parsed_reply', [
					'user_id'     => $user_id,
					'context'     => $compare_context,
					'parsed_reply' => $parsed,
					'comparison'  => $comparison,
				] );
				return $comparison;
			}
		}

		$reply = sanitize_textarea_field( (string) $result['reply'] );
		if ( self::contains_progress_photo_disclaimer( $reply ) ) {
			self::log_progress_photo_compare_debug( 'disclaimer_reply', [
				'user_id'   => $user_id,
				'context'   => $compare_context,
				'raw_reply' => $reply,
			] );
			return new \WP_Error( 'ai_parse_error', 'AI compare could not produce a usable progress-photo comparison.' );
		}

		self::log_progress_photo_compare_debug( 'plain_text_reply', [
			'user_id'   => $user_id,
			'context'   => $compare_context,
			'raw_reply' => $reply,
		] );

		return $reply;
	}

	private static function build_progress_photo_system_prompt(): string {
		return <<<PROMPT
You are Johnny 5000 in progress-photo comparison mode.

Two images are attached to the request and are available for visual inspection. Compare them directly.

Rules:
- Do not say you cannot see, view, access, inspect, or compare the photos.
- Compare only visible changes. If something is subtle or uncertain, say that it is subtle or uncertain.
- Be specific about visible physique or posture changes when they are present.
- Use the provided angle and date metadata to orient the comparison, but never invent details beyond what is visible.
- Stay concise, direct, honest, and supportive.
- Do not make medical claims.
- Do not estimate exact body-fat percentage.
- Do not give generic coaching unless it is tied to what is visible.
- Return only valid JSON with this exact shape: {comparison:string, visible_changes:[string], confidence:string}.
PROMPT;
	}

	private static function build_progress_photo_compare_prompt( string $goal, array $comparison_context ): string {
		$first_photo  = $comparison_context['first_photo'] ?? [];
		$second_photo = $comparison_context['second_photo'] ?? [];

		$first_angle  = sanitize_text_field( (string) ( $first_photo['angle'] ?? 'unknown' ) );
		$first_date   = sanitize_text_field( (string) ( $first_photo['photo_date'] ?? 'unknown' ) );
		$second_angle = sanitize_text_field( (string) ( $second_photo['angle'] ?? 'unknown' ) );
		$second_date  = sanitize_text_field( (string) ( $second_photo['photo_date'] ?? 'unknown' ) );

		return "These are two progress photos of the same person. The first image is the earlier photo taken on {$first_date} at the {$first_angle} angle. The second image is the more recent photo taken on {$second_date} at the {$second_angle} angle. The goal is {$goal}. Compare only what is visibly present between the two images. Use this rubric: 1) overall body shape and tightness, 2) waist or midsection changes, 3) upper-body definition or posture, 4) anything subtle that is visible but not conclusive. If the angles differ, say that the angle difference limits certainty, but still compare what can be seen. If the change is subtle, say that clearly instead of refusing to compare. Return only valid JSON with this exact shape: {comparison:string, visible_changes:[string], confidence:string}. The comparison must be 3 to 4 sentences, direct, honest, supportive, and free of generic filler.";
	}

	/**
	 * @param array<string,mixed> $comparison_context
	 * @return array<string,array<string,string|int>>
	 */
	private static function normalise_progress_photo_context( array $comparison_context ): array {
		$normalised = [];

		foreach ( [ 'first_photo', 'second_photo' ] as $key ) {
			$photo = is_array( $comparison_context[ $key ] ?? null ) ? $comparison_context[ $key ] : [];
			$normalised[ $key ] = [
				'id'         => (int) ( $photo['id'] ?? 0 ),
				'photo_date' => sanitize_text_field( (string) ( $photo['photo_date'] ?? '' ) ),
				'angle'      => sanitize_key( (string) ( $photo['angle'] ?? '' ) ),
			];
		}

		return $normalised;
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	private static function log_progress_photo_compare_debug( string $event, array $payload ): void {
		$ai_settings     = get_option( 'jf_ai_settings', [] );
		$admin_enabled   = ! empty( $ai_settings['progress_photo_compare_debug_enabled'] );
		$filter_enabled  = (bool) apply_filters( 'jf_progress_photo_compare_debug', false, $event, $payload );
		$enabled         = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) || $admin_enabled || $filter_enabled;
		if ( ! $enabled ) {
			return;
		}

		$encoded = wp_json_encode( [
			'event'   => $event,
			'payload' => $payload,
		] );

		if ( false === $encoded ) {
			return;
		}

		error_log( 'Johnny5k progress photo compare: ' . $encoded );
	}

	/**
	 * Generate an AI review for the dashboard homepage using the current snapshot.
	 *
	 * @param int  $user_id
	 * @param bool $force
	 * @return array<string,mixed>|\WP_Error
	 */
	public static function dashboard_review( int $user_id, bool $force = false ) {
		$snapshot = DashboardController::get_daily_snapshot_data( $user_id );
		$hash     = md5( wp_json_encode( self::dashboard_review_cache_payload( $snapshot ) ) );
		$cached   = get_user_meta( $user_id, 'jf_dashboard_johnny_review', true );

		if ( ! $force && is_array( $cached ) && ( $cached['snapshot_hash'] ?? '' ) === $hash && ! empty( $cached['review'] ) ) {
			$review = self::normalise_dashboard_review_payload( (array) $cached['review'], $snapshot );
			$review['snapshot_hash'] = $hash;
			$review['cached'] = true;
			$review['generated_at'] = $cached['generated_at'] ?? current_time( 'mysql' );
			return $review;
		}

		$messages = [
			[ 'role' => 'system', 'content' => self::build_system_prompt( $user_id ) ],
			[ 'role' => 'user', 'content' => self::build_dashboard_review_prompt( $snapshot ) ],
		];

		$result = self::call_openai( $messages, self::DEFAULT_MODEL );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, self::DEFAULT_MODEL, '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'dashboard_review', 'snapshot_hash' => $hash ] );

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		if ( ! is_array( $parsed ) ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI dashboard review.' );
		}

		$review = self::normalise_dashboard_review_payload( $parsed, $snapshot );
		$review['snapshot_hash'] = $hash;
		$review['cached'] = false;
		$review['generated_at'] = current_time( 'mysql' );

		update_user_meta( $user_id, 'jf_dashboard_johnny_review', [
			'snapshot_hash' => $hash,
			'generated_at'  => $review['generated_at'],
			'review'        => $review,
		] );

		return $review;
	}

	/**
	 * Generate a post-workout summary narrative.
	 *
	 * @param  int   $user_id
	 * @param  int   $session_id
	 * @return string|WP_Error
	 */
	public static function post_workout_summary( int $user_id, int $session_id ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d AND user_id = %d",
			$session_id, $user_id
		) );
		if ( ! $session ) return new \WP_Error( 'not_found', 'Session not found.' );

		$exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT e.name, wse.slot_type, ws.sets_completed,
			        MAX(ws.weight) AS top_weight, SUM(ws.reps) AS total_reps
			 FROM {$p}fit_workout_session_exercises wse
			 JOIN {$p}fit_exercises e ON e.id = wse.exercise_id
			 LEFT JOIN (
			   SELECT session_exercise_id,
			          COUNT(*) AS sets_completed, weight, reps, rir
			   FROM {$p}fit_workout_sets
			   WHERE completed = 1
			   GROUP BY session_exercise_id
			 ) ws ON ws.session_exercise_id = wse.id
			 WHERE wse.session_id = %d
			 GROUP BY wse.id, e.name, wse.slot_type",
			$session_id
		) );

		$exercise_lines = array_map( function( $ex ) {
			return "• {$ex->name}: {$ex->sets_completed} sets × up to {$ex->total_reps} reps @ {$ex->top_weight} lb";
		}, $exercises );

		$duration  = $session->duration_minutes ? "{$session->duration_minutes} minutes" : 'an unknown duration';
		$day_type  = strtoupper( str_replace( '_', ' ', $session->actual_day_type ?? $session->planned_day_type ) );

		$context = "Just finished a {$day_type} workout in {$duration}. Here's what I did:\n" . implode( "\n", $exercise_lines );

		$messages = [
			[ 'role' => 'system',  'content' => self::build_system_prompt( $user_id ) ],
			[ 'role' => 'user',    'content' => "{$context}\n\nGive me a brief post-workout summary in your style — acknowledge the work, call out anything impressive, and set me up for the next session." ],
		];

		$result = self::call_openai( $messages );
		if ( is_wp_error( $result ) ) return $result;

		CostTracker::log_openai( $user_id, self::DEFAULT_MODEL, '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'post_workout' ] );

		// Persist summary on the session
		$wpdb->update( $p . 'fit_workout_sessions', [ 'ai_summary' => $result['reply'] ], [ 'id' => $session_id ] );

		return $result['reply'];
	}

	/**
	 * Generate a weekly summary narrative (called after calorie adjustment).
	 *
	 * @param  int   $user_id
	 * @param  array $stats
	 * @return string|WP_Error
	 */
	public static function weekly_check_in( int $user_id, array $stats = [] ) {
		global $wpdb;

		if ( ! $stats ) {
			$stats = self::compile_weekly_stats( $user_id );
		}

		$context  = self::get_user_context( $user_id );
		$name     = $context['first_name'] ?? 'you';
		$goal     = $context['goal_type'] ?? 'maintain';
		$workouts = $stats['workouts_completed'] ?? 0;
		$avg_cal  = $stats['avg_calories'] ?? 0;
		$avg_pro  = $stats['avg_protein_g'] ?? 0;
		$weight_d = $stats['weight_change_lb'] ?? null;
		$w_line   = isset( $weight_d ) ? sprintf( "Weight change: %+.1f lb.", $weight_d ) : '';

		$messages = [
			[ 'role' => 'system', 'content' => self::build_system_prompt( $user_id ) ],
			[ 'role' => 'user',   'content' => "Weekly check-in for {$name}. Goal: {$goal}. Workouts this week: {$workouts}. Avg calories: {$avg_cal} kcal. Avg protein: {$avg_pro} g. {$w_line}\n\nWrite a brief (3–5 sentence) weekly check-in message — acknowledge wins, point out the one thing to improve next week, and give a motivational sign-off." ],
		];

		$result = self::call_openai( $messages );
		if ( is_wp_error( $result ) ) return $result;

		CostTracker::log_openai( $user_id, self::DEFAULT_MODEL, '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'weekly_check_in' ] );

		return $result['reply'];
	}

	/**
	 * Generate short SMS copy for a reminder trigger.
	 *
	 * @param int   $user_id
	 * @param string $trigger_type
	 * @param array<string,mixed> $context
	 * @return string|WP_Error
	 */
	public static function generate_sms_copy( int $user_id, string $trigger_type, array $context = [] ) {
		$context_lines = [];
		foreach ( $context as $key => $value ) {
			if ( 'recent_messages' === $key || null === $value || '' === $value ) {
				continue;
			}

			$label = ucwords( str_replace( '_', ' ', (string) $key ) );
			if ( is_bool( $value ) ) {
				$value = $value ? 'yes' : 'no';
			}

			$context_lines[] = "{$label}: {$value}";
		}

		$recent_messages = array_values( array_filter( array_map( 'trim', (array) ( $context['recent_messages'] ?? [] ) ) ) );
		$recent_block = '';
		if ( $recent_messages ) {
			$recent_block = "Avoid repeating phrasing from these recent SMS messages:\n- " . implode( "\n- ", array_slice( $recent_messages, 0, 5 ) );
		}

		$messages = [
			[
				'role' => 'system',
				'content' => self::build_system_prompt( $user_id ) . "\n\nYou are writing a single SMS for Johnny 5000. Rules: max 220 characters. Plain text only. No markdown. No quotation marks around the final answer. Make it feel like Johnny 5000 texting personally: confident, warm, lightly funny when it helps, like a strong big brother who actually knows the user's data. Vary sentence rhythm, openings, and verbs so the texts do not feel formulaic. Do not sound corporate, generic, or like an app notification. Make it clear the text is from Johnny 5000 by naturally referring to yourself as Johnny 5000 or signing off as Johnny 5000. Use at most one emoji and only if it feels natural. Return only the SMS body.",
			],
			[
				'role' => 'user',
				'content' => sprintf(
					"Write one %s SMS. Keep it specific to the user's current context and avoid sounding repetitive. Push for fresh phrasing, not stock reminder language. Make it sound unmistakably like Johnny 5000.\n\nContext:\n%s%s",
					str_replace( '_', ' ', $trigger_type ),
					$context_lines ? implode( "\n", $context_lines ) : 'No extra context provided.',
					$recent_block ? "\n\n{$recent_block}" : ''
				),
			],
		];

		$result = self::call_openai( $messages, self::DEFAULT_MODEL );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		CostTracker::log_openai( $user_id, self::DEFAULT_MODEL, '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'sms_copy', 'trigger' => $trigger_type ] );

		$reply = trim( preg_replace( '/\s+/', ' ', (string) $result['reply'] ) );
		$reply = trim( $reply, " \t\n\r\0\x0B\"'" );

		if ( '' === $reply ) {
			return new \WP_Error( 'empty_sms_copy', 'AI returned an empty SMS message.' );
		}

		if ( mb_strlen( $reply ) > 220 ) {
			$reply = rtrim( mb_substr( $reply, 0, 217 ) ) . '...';
		}

		return $reply;
	}

	// ── System prompt builder ─────────────────────────────────────────────────

	/**
	 * Compile the active system prompt by combining Johnny's personality
	 * (from the admin editor) with real-time user context and optional mode instructions.
	 *
	 * @param int    $user_id
	 * @param string $mode  One of: general, coach, nutrition, workout_review, accountability, planning, education
	 */
	public static function build_system_prompt( int $user_id, string $mode = 'general', array $context_overrides = [] ): string {
		$admin_prompt = get_option( 'jf_johnny_system_prompt', '' );

		// Use admin prompt if set; append behavioral rules so they always apply.
		// Fall back to the improved default persona if no admin prompt exists.
		if ( $admin_prompt ) {
			$persona = $admin_prompt . "\n\n" . self::behavioral_rules();
		} else {
			$persona = self::default_persona();
		}

		$context   = self::get_user_context( $user_id, $context_overrides );
		$ctx_lines = self::format_context_block( $context );
		$ctx_block = $ctx_lines ? "\n\nUser context:\n" . implode( "\n", $ctx_lines ) : '';
		$memory_block = self::format_durable_memory_block( $user_id );
		$follow_up_block = self::format_follow_up_history_block( $user_id );
		$tool_note = "\n\nYou may use Johnny5k backend tools to read live user data and perform supported actions. Before answering about meal count, what the user ate for dinner, pantry inventory, available recipes, or whether today's workout already happened, read the live data with the relevant tools instead of guessing from memory. When the user clearly asks you to log steps, log food, update pantry, adjust a workout, create a training plan, or schedule a text reminder, do it with the available tools instead of only describing what they should do. If a required detail is missing or the request is materially ambiguous, ask one short follow-up question instead of guessing. Never claim an action succeeded unless a tool confirmed it. Never create or edit a workout plan when the user is asking about meals, recipes, pantry, groceries, or macros. When the user says today, yesterday, tomorrow, tonight, or last night, resolve that against the current local date and time above. Do not invent a calendar date for relative time references. If the user did not provide a literal YYYY-MM-DD date, omit the date argument and let the backend resolve it from the user's local date. If you estimate food or recovery details, say plainly that it is an estimate and tell the user what detail would make it more accurate.";
		$format_note = "\n\nResponse format rules: default to one short paragraph or two short paragraphs. Do not use markdown headings. Do not produce canned sections like \"Next steps:\" or label-heavy templates like \"Calorie Target:\" unless the user explicitly asks for a breakdown. Do not pad with generic advice like \"track each meal\" or \"consider a workout\" unless it is specifically grounded in the user's current data. Prefer one concrete next move over a five-point plan. Do not end with an upsell question like \"Would you like recipe suggestions?\" unless the user asked for recipes, meal ideas, or options.";

		$mode_block = '';
		$mode_instr = self::get_mode_instructions( $mode );
		if ( $mode_instr ) {
			$mode_block = "\n\n" . $mode_instr;
		}

		// Brief action-capability note so the model can optionally return structured actions.
		$action_block = "\n\nAction capability: When genuinely useful, you may wrap your response as JSON — {\"reply\":\"...\",\"why\":\"short reason grounded in the user's data\",\"confidence\":\"high|medium|low\",\"context_used\":[\"brief context bullet\"],\"actions\":[{\"type\":\"action_name\",\"payload\":{}}]} — so the app can take action and show your reasoning. Supported types: open_screen (payload: {\"screen\":\"name\"}), show_nutrition_summary, show_grocery_gap, highlight_goal_issue, create_saved_meal_draft (payload: {\"name\":\"meal name\",\"meal_type\":\"lunch\",\"items\":[]}), suggest_recipe_plan, queue_follow_up (payload: {\"prompt\":\"short follow-up prompt\",\"reason\":\"why ask later\",\"due_at\":\"YYYY-MM-DD HH:MM\",\"next_step\":\"what to do\",\"starter_prompt\":\"prompt to run later\"}), run_workflow (payload: {\"workflow\":\"fix_macros\",\"title\":\"short title\",\"summary\":\"why this workflow helps\",\"steps\":[\"step one\"],\"screen\":\"nutrition\",\"meal_type\":\"dinner\",\"starter_prompt\":\"prompt to kick it off\"}). If no action is needed, respond in plain text.";

		return $persona . $ctx_block . $memory_block . $follow_up_block . $tool_note . $format_note . $mode_block . $action_block;
	}

	private static function default_persona(): string {
		return <<<PERSONA
You are Johnny 5000, the user's embedded fitness coach inside the Johnny5k app.

You are direct, calm, warm, observant, and grounded. You do not sound corporate, generic, or like a chatbot. You speak like a strong, experienced coach who actually knows the user's data and gives a damn.

Behavior rules:
- Notice patterns and name them clearly.
- Use the user's current data whenever it helps.
- Give one useful next step early in your response.
- Reference prior commitments or recurring patterns when they matter.
- Avoid generic motivational fluff — skip "great job" filler unless it means something.
- Be honest when the user is off track, but never demeaning.
- Stay concise unless the user asks for detail.
- Vary your sentence openings and rhythm.
- Sound like a real person, not a feature.
- Admit uncertainty when a detail is unclear and ask one tight clarifying question before guessing.
- If you do not know something, say so plainly.
- If asked whether you are an AI, be honest and matter-of-fact about it.
- Default to plain prose, not a presentation.
- Avoid markdown headings and templated section labels unless the user explicitly asks for structure.
- Do not tack on a generic closing question offering recipes, meal plans, or more help unless the user asked for that.
PERSONA;
	}

	private static function behavioral_rules(): string {
		return <<<RULES
Behavior rules (always apply):
- Notice patterns and name them clearly.
- Use the user's current data whenever it helps.
- Give one useful next step early.
- Reference prior commitments or recurring patterns when useful.
- Avoid generic motivational fluff.
- Be honest when the user is off track, but never demeaning.
- Stay concise unless detail is requested.
- Vary sentence openings and rhythm.
- Sound like a real person, not a feature.
- Ask one short clarifying question when something important is ambiguous instead of guessing.
- Default to plain prose instead of headings, labels, or canned sections.
RULES;
	}

	/**
	 * Default admin-editable persona fields.
	 *
	 * @return array{name:string,tagline:string,tone:string,rules:string,extra:string}
	 */
	public static function admin_persona_defaults(): array {
		return [
			'name'    => 'Johnny 5000',
			'tagline' => 'The user\'s embedded fitness coach inside Johnny5k.',
			'tone'    => 'direct, calm, warm, observant, grounded',
			'rules'   => '',
			'extra'   => '',
		];
	}

	/**
	 * Compile admin persona settings into a prompt that plugs into the shared
	 * behavioral contract applied by build_system_prompt().
	 */
	public static function compile_admin_persona_prompt( array $persona ): string {
		$defaults = self::admin_persona_defaults();
		$persona  = array_merge( $defaults, $persona );

		$name    = sanitize_text_field( (string) $persona['name'] );
		$tagline = sanitize_text_field( (string) $persona['tagline'] );
		$tone    = sanitize_textarea_field( (string) $persona['tone'] );
		$rules   = sanitize_textarea_field( (string) $persona['rules'] );
		$extra   = sanitize_textarea_field( (string) $persona['extra'] );

		$lines   = [];
		$lines[] = "You are {$name}, the user's embedded fitness coach inside the Johnny5k app.";

		if ( '' !== $tagline ) {
			$lines[] = $tagline;
		}

		if ( '' !== $tone ) {
			$lines[] = "Voice and feel: {$tone}.";
		}

		$lines[] = 'Operate like a real coach who understands the user\'s live data, speaks plainly, and gives practical direction.';

		$custom_rules = array_values( array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $rules ) ?: [] ) ) );
		if ( $custom_rules ) {
			$lines[] = '';
			$lines[] = 'Custom coaching rules:';
			foreach ( $custom_rules as $rule ) {
				$lines[] = '- ' . ltrim( $rule, "- \t" );
			}
		}

		if ( '' !== $extra ) {
			$lines[] = '';
			$lines[] = 'Additional instructions:';
			$lines[] = $extra;
		}

		return implode( "\n", $lines );
	}

	/**
	 * Fixed QA prompts used to verify the shared persona contract in admin tools.
	 *
	 * @return array<int,array{id:string,label:string,prompt:string,expectation:string}>
	 */
	public static function admin_persona_contract_checks(): array {
		return [
			[
				'id'          => 'concise_next_step',
				'label'       => 'Concise next step',
				'prompt'      => 'I missed my protein target most of this week and I do not want a lecture. What should I do today?',
				'expectation' => 'Johnny should stay concise and give one practical next step early.',
			],
			[
				'id'          => 'non_corporate_tone',
				'label'       => 'Non-corporate tone',
				'prompt'      => 'Give me a pep talk after a sloppy weekend, but do not sound like an app notification.',
				'expectation' => 'Johnny should sound human and grounded, not polished, branded, or corporate.',
			],
			[
				'id'          => 'data_aware_coaching',
				'label'       => 'Data-aware coaching',
				'prompt'      => 'I averaged 126 g of protein this week against a 180 g target. What should dinner look like tonight?',
				'expectation' => 'Johnny should use the supplied numbers directly and turn them into a concrete recommendation.',
			],
			[
				'id'          => 'direct_honesty',
				'label'       => 'Direct honesty',
				'prompt'      => 'I have skipped three workouts in the last eight days. Be honest about what pattern you see and what I should do next.',
				'expectation' => 'Johnny should name the pattern clearly, stay supportive, and avoid shaming language.',
			],
		];
	}

	/**
	 * Return mode-specific instructions to append to the system prompt.
	 */
	private static function get_mode_instructions( string $mode ): string {
		switch ( $mode ) {
			case 'nutrition':
				return 'Mode: Nutrition coaching. Be practical and macro-aware. Focus on food swaps, meal timing, and hitting macro targets. Give specific, actionable food suggestions tied to the user\'s current numbers. Prefer a concrete next meal or two over abstract planning language. Do not invent arbitrary meal-count goals unless the user or data specifically supports them.';
			case 'accountability':
				return 'Mode: Accountability check. Be direct and brief. Name the gap clearly without judgment. Push for commitment on one specific action before ending your response.';
			case 'planning':
				return 'Mode: Planning session. Use structured output — clear next steps in priority order. Lean toward numbered lists and concrete timelines.';
			case 'education':
				return 'Mode: Education. Explain the why behind advice. Add more context than usual. Be thorough and clear, not rushed.';
			case 'workout_review':
				return 'Mode: Workout review. Frame everything around performance and recovery. Reference sets, reps, and progression. Note what to push next session.';
			case 'coach':
				return 'Mode: Coaching session. Act as a focused personal trainer. Ask a clarifying question if something is unclear. Hold the user accountable to their stated goals.';
			default:
				return '';
		}
	}

	/**
	 * Format the user context array into a compact list of labeled lines.
	 *
	 * @param array<string,mixed> $context
	 * @return string[]
	 */
	private static function format_context_block( array $context ): array {
		$lines = [];

		if ( ! empty( $context['first_name'] ) )           $lines[] = "Name: {$context['first_name']}";
		if ( ! empty( $context['goal_type'] ) )            $lines[] = "Goal: {$context['goal_type']}";
		if ( ! empty( $context['experience'] ) )           $lines[] = "Training experience: {$context['experience']}";
		if ( ! empty( $context['target_calories'] ) )      $lines[] = "Daily calorie target: {$context['target_calories']} kcal";
		if ( ! empty( $context['target_protein_g'] ) )     $lines[] = "Protein target: {$context['target_protein_g']} g";
		if ( ! empty( $context['latest_weight_lb'] ) )     $lines[] = "Latest weight: {$context['latest_weight_lb']} lb";

		if ( isset( $context['weight_change_last_14_days'] ) && $context['weight_change_last_14_days'] !== null ) {
			$sign  = $context['weight_change_last_14_days'] >= 0 ? '+' : '';
			$lines[] = "Weight trend (14 days): {$sign}{$context['weight_change_last_14_days']} lb";
		}

		if ( isset( $context['workouts_last_7_days'] ) )   $lines[] = "Workouts last 7 days: {$context['workouts_last_7_days']}";

		if ( isset( $context['days_since_last_workout'] ) ) {
			$dsw = $context['days_since_last_workout'];
			$lines[] = $dsw === null ? 'Last workout: no workouts on record' : "Days since last workout: {$dsw}";
		}

		if ( isset( $context['avg_calories_last_7_days'] ) && $context['avg_calories_last_7_days'] > 0 ) {
			$lines[] = "Avg daily calories (7 days): {$context['avg_calories_last_7_days']} kcal";
		}

		if ( isset( $context['avg_protein_last_7_days'] ) && $context['avg_protein_last_7_days'] > 0 ) {
			$lines[] = "Avg daily protein (7 days): {$context['avg_protein_last_7_days']} g";
		}

		if ( isset( $context['days_with_meal_logs_last_7_days'] ) ) {
			$lines[] = "Meal-logged days (last 7): {$context['days_with_meal_logs_last_7_days']} of 7";
		}

		if ( isset( $context['meal_logs_last_7_days'] ) ) {
			$lines[] = "Meals logged (last 7): {$context['meal_logs_last_7_days']}";
		}

		if ( ! empty( $context['last_meal_logged_at'] ) ) {
			$lines[] = "Last meal logged: {$context['last_meal_logged_at']}";
		}

		if ( isset( $context['pantry_item_count'] ) )      $lines[] = "Pantry items: {$context['pantry_item_count']}";
		if ( isset( $context['saved_meals_count'] ) )      $lines[] = "Saved meals: {$context['saved_meals_count']}";
		if ( isset( $context['saved_meal_logs_last_30_days'] ) ) {
			$lines[] = "Saved-meal uses (last 30 days): {$context['saved_meal_logs_last_30_days']}";
		}

		if ( ! empty( $context['top_saved_meal_name'] ) && isset( $context['top_saved_meal_uses_last_30_days'] ) ) {
			$lines[] = "Most-used saved meal (30 days): {$context['top_saved_meal_name']} ({$context['top_saved_meal_uses_last_30_days']} logs)";
		}

		if ( ! empty( $context['adherence_summary'] ) )    $lines[] = "Adherence: {$context['adherence_summary']}";
		if ( ! empty( $context['goal_trend_summary'] ) )   $lines[] = "Goal trend: {$context['goal_trend_summary']}";
		if ( isset( $context['follow_up_pending_count'] ) ) $lines[] = "Pending Johnny follow-ups: {$context['follow_up_pending_count']}";
		if ( isset( $context['follow_up_overdue_count'] ) ) $lines[] = "Overdue Johnny follow-ups: {$context['follow_up_overdue_count']}";
		if ( isset( $context['follow_up_missed_count'] ) ) $lines[] = "Missed Johnny follow-ups: {$context['follow_up_missed_count']}";
		if ( isset( $context['follow_up_completed_last_14_days'] ) ) $lines[] = "Completed Johnny follow-ups (14 days): {$context['follow_up_completed_last_14_days']}";
		if ( isset( $context['follow_up_dismissed_last_14_days'] ) ) $lines[] = "Dismissed Johnny follow-ups (14 days): {$context['follow_up_dismissed_last_14_days']}";
		if ( ! empty( $context['follow_up_recent_summary'] ) ) $lines[] = "Recent Johnny follow-up outcomes: {$context['follow_up_recent_summary']}";

		if ( isset( $context['current_local_date'] ) && '' !== (string) $context['current_local_date'] ) {
			$lines[] = "Current local date: {$context['current_local_date']}";
		}

		if ( isset( $context['current_local_time'] ) && '' !== (string) $context['current_local_time'] ) {
			$lines[] = "Current local time: {$context['current_local_time']}";
		}

		if ( isset( $context['current_local_datetime'] ) && '' !== (string) $context['current_local_datetime'] ) {
			$lines[] = "Current local datetime: {$context['current_local_datetime']}";
		}

		if ( isset( $context['user_timezone'] ) && '' !== (string) $context['user_timezone'] ) {
			$lines[] = "User timezone: {$context['user_timezone']}";
		}

		return $lines;
	}

	private static function format_durable_memory_block( int $user_id ): string {
		$memory = self::get_durable_memory( $user_id );
		$bullets = is_array( $memory['bullets'] ?? null ) ? $memory['bullets'] : [];
		$bullets = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );

		if ( empty( $bullets ) ) {
			return '';
		}

		return "\n\nLong-term coaching memory:\n- " . implode( "\n- ", array_slice( $bullets, 0, 8 ) );
	}

	private static function format_follow_up_history_block( int $user_id ): string {
		$overview = self::get_follow_up_overview( $user_id );
		$parts = [];

		if ( ! empty( $overview['overdue_items'] ) ) {
			$parts[] = 'Overdue commitments: ' . implode( '; ', array_map( static fn( array $item ): string => (string) ( $item['prompt'] ?? '' ), array_slice( $overview['overdue_items'], 0, 3 ) ) );
		}

		if ( ! empty( $overview['history'] ) ) {
			$history_lines = array_map( static function( array $item ): string {
				$state = sanitize_text_field( (string) ( $item['state'] ?? '' ) );
				$prompt = sanitize_text_field( (string) ( $item['prompt'] ?? '' ) );
				$changed = sanitize_text_field( (string) ( $item['changed_at'] ?? '' ) );
				return trim( $state . ': ' . $prompt . ( $changed ? ' (' . $changed . ')' : '' ) );
			}, array_slice( $overview['history'], 0, 4 ) );
			$history_lines = array_values( array_filter( $history_lines ) );
			if ( $history_lines ) {
				$parts[] = "Recent follow-up outcomes:\n- " . implode( "\n- ", $history_lines );
			}
		}

		if ( empty( $parts ) ) {
			return '';
		}

		return "\n\nJohnny follow-up history:\n" . implode( "\n", $parts );
	}

	public static function get_durable_memory( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::DURABLE_MEMORY_META_KEY, true );
		return is_array( $stored ) ? $stored : [];
	}

	public static function update_durable_memory( int $user_id, array $bullets ): array {
		$clean = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );

		$payload = [
			'bullets'    => array_slice( $clean, 0, 8 ),
			'updated_at' => current_time( 'mysql' ),
		];

		update_user_meta( $user_id, self::DURABLE_MEMORY_META_KEY, $payload );
		return $payload;
	}

	public static function get_follow_up_history( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::FOLLOW_UP_HISTORY_META_KEY, true );
		$items = is_array( $stored ) ? $stored : [];

		return array_values( array_filter( array_map( static function( $item ): array {
			if ( ! is_array( $item ) ) {
				return [];
			}

			return [
				'id'         => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
				'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
				'state'      => sanitize_key( (string) ( $item['state'] ?? '' ) ),
				'changed_at' => sanitize_text_field( (string) ( $item['changed_at'] ?? '' ) ),
				'due_at'     => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
			];
		}, $items ), static fn( array $item ) => ! empty( $item['prompt'] ) && ! empty( $item['state'] ) ) );
	}

	public static function get_follow_up_overview( int $user_id ): array {
		$pending = self::get_pending_follow_ups( $user_id );
		$history = self::get_follow_up_history( $user_id );
		$now = UserTime::mysql( $user_id );
		$cutoff = UserTime::days_ago( $user_id, 13 );

		$overdue_items = array_values( array_filter( $pending, static fn( array $item ): bool => ! empty( $item['due_at'] ) && (string) $item['due_at'] < $now ) );
		$missed_items = array_values( array_filter( $pending, static fn( array $item ): bool => 'missed' === ( $item['status'] ?? '' ) ) );
		$recent_history = array_values( array_filter( $history, static fn( array $item ): bool => (string) ( $item['changed_at'] ?? '' ) >= $cutoff ) );
		$completed = count( array_filter( $recent_history, static fn( array $item ): bool => 'completed' === ( $item['state'] ?? '' ) ) );
		$dismissed = count( array_filter( $recent_history, static fn( array $item ): bool => 'dismissed' === ( $item['state'] ?? '' ) ) );
		$snoozed = count( array_filter( $pending, static fn( array $item ): bool => 'snoozed' === ( $item['status'] ?? '' ) ) );

		usort( $history, static fn( array $left, array $right ): int => strcmp( (string) ( $right['changed_at'] ?? '' ), (string) ( $left['changed_at'] ?? '' ) ) );

		$recent_summary_parts = [];
		if ( $completed > 0 ) {
			$recent_summary_parts[] = $completed . ' completed';
		}
		if ( $dismissed > 0 ) {
			$recent_summary_parts[] = $dismissed . ' dismissed';
		}
		if ( count( $overdue_items ) > 0 ) {
			$recent_summary_parts[] = count( $overdue_items ) . ' overdue';
		}
		if ( count( $missed_items ) > 0 ) {
			$recent_summary_parts[] = count( $missed_items ) . ' missed';
		}

		return [
			'pending_count' => count( $pending ),
			'snoozed_count' => $snoozed,
			'overdue_count' => count( $overdue_items ),
			'missed_count' => count( $missed_items ),
			'completed_last_14_days' => $completed,
			'dismissed_last_14_days' => $dismissed,
			'recent_summary' => implode( ', ', $recent_summary_parts ),
			'overdue_items' => array_slice( $overdue_items, 0, 6 ),
			'missed_items' => array_slice( $missed_items, 0, 6 ),
			'history' => array_slice( $history, 0, 10 ),
		];
	}

	public static function get_pending_follow_ups( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::FOLLOW_UP_META_KEY, true );
		$items = is_array( $stored ) ? $stored : [];
		$missed_threshold = self::get_missed_follow_up_threshold( $user_id );

		$clean = array_values( array_filter( array_map( static function( $item ) use ( $missed_threshold ): array {
			if ( ! is_array( $item ) ) {
				return [];
			}

			$status = sanitize_key( (string) ( $item['status'] ?? 'pending' ) );
			if ( in_array( $status, [ 'completed', 'dismissed' ], true ) ) {
				return [];
			}

			$due_at = sanitize_text_field( (string) ( $item['due_at'] ?? '' ) );
			$normalized_status = in_array( $status, [ 'pending', 'snoozed' ], true ) ? $status : 'pending';
			if ( '' !== $due_at && $due_at < $missed_threshold ) {
				$normalized_status = 'missed';
			}

			return [
				'id'         => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
				'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
				'next_step'  => sanitize_text_field( (string) ( $item['next_step'] ?? '' ) ),
				'starter_prompt' => sanitize_textarea_field( (string) ( $item['starter_prompt'] ?? '' ) ),
				'commitment_key' => sanitize_key( (string) ( $item['commitment_key'] ?? '' ) ),
				'due_at'     => $due_at,
				'status'     => $normalized_status,
				'created_at' => sanitize_text_field( (string) ( $item['created_at'] ?? '' ) ),
			];
		}, $items ), static fn( array $item ) => ! empty( $item['id'] ) && ! empty( $item['prompt'] ) ) );

		usort( $clean, static function( array $left, array $right ): int {
			$left_due = (string) ( $left['due_at'] ?? '' );
			$right_due = (string) ( $right['due_at'] ?? '' );
			if ( '' === $left_due && '' === $right_due ) {
				return strcmp( (string) ( $left['created_at'] ?? '' ), (string) ( $right['created_at'] ?? '' ) );
			}
			if ( '' === $left_due ) {
				return 1;
			}
			if ( '' === $right_due ) {
				return -1;
			}

			return strcmp( $left_due, $right_due );
		} );

		return $clean;
	}

	public static function update_follow_up_state( int $user_id, string $follow_up_id, string $state, string $due_at = '' ): ?array {
		$follow_up_id = sanitize_text_field( $follow_up_id );
		$state        = sanitize_key( $state );
		if ( '' === $follow_up_id || ! in_array( $state, [ 'pending', 'snoozed', 'completed', 'dismissed' ], true ) ) {
			return null;
		}

		$stored = get_user_meta( $user_id, self::FOLLOW_UP_META_KEY, true );
		$current = is_array( $stored ) ? $stored : [];
		$updated = null;
		$next = [];

		foreach ( $current as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			if ( sanitize_text_field( (string) ( $item['id'] ?? '' ) ) !== $follow_up_id ) {
				$next[] = $item;
				continue;
			}

			if ( in_array( $state, [ 'completed', 'dismissed' ], true ) ) {
				self::record_follow_up_event( $user_id, [
					'id'         => $follow_up_id,
					'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
					'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
					'state'      => $state,
					'changed_at' => current_time( 'mysql' ),
					'due_at'     => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
				] );
				$updated = [ 'id' => $follow_up_id, 'status' => $state ];
				continue;
			}

			$item['status'] = $state;
			$item['due_at'] = 'snoozed' === $state ? sanitize_text_field( $due_at ) : '';
			$next[] = $item;
			self::record_follow_up_event( $user_id, [
				'id'         => $follow_up_id,
				'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
				'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
				'state'      => $state,
				'changed_at' => current_time( 'mysql' ),
				'due_at'     => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
			] );
			$updated = [
				'id'     => $follow_up_id,
				'status' => $state,
				'due_at' => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
			];
		}

		update_user_meta( $user_id, self::FOLLOW_UP_META_KEY, array_values( $next ) );
		return $updated;
	}

	public static function dismiss_follow_up( int $user_id, string $follow_up_id ): bool {
		return null !== self::update_follow_up_state( $user_id, $follow_up_id, 'dismissed' );
	}

	// ── User context helper ───────────────────────────────────────────────────

	/**
	 * Gather live user context for use in system prompts.
	 * Returns profile, goal, latest metrics, and recent behavioral data.
	 *
	 * @return array<string,mixed>
	 */
	private static function get_user_context( int $user_id, array $context_overrides = [] ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		// ── Profile & goal ────────────────────────────────────────────────────
		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT first_name, training_experience FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT goal_type, target_calories, target_protein_g FROM {$p}fit_user_goals
			 WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		// ── Latest weight + 14-day trend ──────────────────────────────────────
		$weight_rows = $wpdb->get_col( $wpdb->prepare(
			"SELECT weight_lb FROM {$p}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT 14",
			$user_id
		) );
		$latest_weight       = $weight_rows ? (float) $weight_rows[0] : null;
		$weight_change_14d   = count( $weight_rows ) >= 2
			? round( (float) $weight_rows[0] - (float) $weight_rows[ count( $weight_rows ) - 1 ], 1 )
			: null;

		// ── Workout stats (last 7 days) ───────────────────────────────────────
		$since_7d = UserTime::days_ago( $user_id, 6 );

		$workouts_7d = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 AND session_date >= %s",
			$user_id, $since_7d
		) );

		$last_workout_date = $wpdb->get_var( $wpdb->prepare(
			"SELECT session_date FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 ORDER BY session_date DESC LIMIT 1",
			$user_id
		) );
		$days_since_workout = null;
		if ( $last_workout_date ) {
			$today = new \DateTimeImmutable( UserTime::today( $user_id ) );
			$last  = new \DateTimeImmutable( $last_workout_date );
			$days_since_workout = (int) $today->diff( $last )->days;
		}

		// ── Nutrition stats (last 7 days) ─────────────────────────────────────
		$nutrition_row = $wpdb->get_row( $wpdb->prepare(
			"SELECT
			   AVG(daily_cal)  AS avg_cal,
			   AVG(daily_pro)  AS avg_pro,
			   COUNT(DISTINCT d) AS days_logged
			 FROM (
			   SELECT DATE(m.meal_datetime) AS d,
			          SUM(mi.calories)  AS daily_cal,
			          SUM(mi.protein_g) AS daily_pro
			   FROM {$p}fit_meal_items mi
			   JOIN {$p}fit_meals m ON m.id = mi.meal_id
			   WHERE m.user_id = %d AND m.confirmed = 1
			     AND DATE(m.meal_datetime) >= %s
			   GROUP BY DATE(m.meal_datetime)
			 ) t",
			$user_id, $since_7d
		) );

		$avg_calories_7d    = $nutrition_row && $nutrition_row->avg_cal  ? (int) round( (float) $nutrition_row->avg_cal )  : 0;
		$avg_protein_7d     = $nutrition_row && $nutrition_row->avg_pro  ? (int) round( (float) $nutrition_row->avg_pro )  : 0;
		$days_logged_7d     = $nutrition_row ? (int) $nutrition_row->days_logged : 0;
		$meals_logged_7d    = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_meals
			 WHERE user_id = %d AND confirmed = 1 AND DATE(meal_datetime) >= %s",
			$user_id,
			$since_7d
		) );

		$last_meal_logged_at = $wpdb->get_var( $wpdb->prepare(
			"SELECT meal_datetime FROM {$p}fit_meals
			 WHERE user_id = %d AND confirmed = 1 ORDER BY meal_datetime DESC LIMIT 1",
			$user_id
		) );
		$last_meal_logged_display = '';
		if ( $last_meal_logged_at ) {
			try {
				$last_meal_logged_display = ( new \DateTimeImmutable( (string) $last_meal_logged_at, UserTime::timezone( $user_id ) ) )->format( 'Y-m-d g:i A' );
			} catch ( \Exception $e ) {
				$last_meal_logged_display = (string) $last_meal_logged_at;
			}
		}

		// ── Pantry & saved meals counts ───────────────────────────────────────
		$pantry_count      = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_pantry_items WHERE user_id = %d",
			$user_id
		) );
		$saved_meals_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_saved_meals WHERE user_id = %d",
			$user_id
		) );
		$since_30d = UserTime::days_ago( $user_id, 29 );
		$saved_meal_logs_30d = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_meals
			 WHERE user_id = %d AND confirmed = 1 AND source = 'saved_meal' AND DATE(meal_datetime) >= %s",
			$user_id,
			$since_30d
		) );
		$top_saved_meal = $wpdb->get_row( $wpdb->prepare(
			"SELECT sm.name, COUNT(DISTINCT mi.meal_id) AS usage_count
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 JOIN {$p}fit_saved_meals sm
			   ON sm.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(mi.source_json, '$.saved_meal_id')) AS UNSIGNED)
			 WHERE m.user_id = %d
			   AND m.confirmed = 1
			   AND m.source = 'saved_meal'
			   AND DATE(m.meal_datetime) >= %s
			   AND mi.source_json IS NOT NULL
			 GROUP BY sm.id, sm.name
			 ORDER BY usage_count DESC, sm.updated_at DESC, sm.id DESC
			 LIMIT 1",
			$user_id,
			$since_30d
		) );

		// ── Adherence & goal trend summaries ──────────────────────────────────
		$adherence_summary  = self::compute_adherence_summary( $days_logged_7d, $workouts_7d );
		$goal_trend_summary = self::compute_goal_trend_summary(
			$goal->goal_type ?? '',
			$avg_calories_7d,
			(int) ( $goal->target_calories ?? 0 ),
			$avg_protein_7d,
			(int) ( $goal->target_protein_g ?? 0 )
		);

		$follow_up_overview = self::get_follow_up_overview( $user_id );

		$now = UserTime::now( $user_id );

		$context = [
			'first_name'                 => $profile->first_name ?? '',
			'goal_type'                  => $goal->goal_type ?? '',
			'experience'                 => $profile->training_experience ?? '',
			'target_calories'            => $goal->target_calories ?? null,
			'target_protein_g'           => $goal->target_protein_g ?? null,
			'latest_weight_lb'           => $latest_weight,
			'weight_change_last_14_days' => $weight_change_14d,
			'workouts_last_7_days'       => $workouts_7d,
			'days_since_last_workout'    => $days_since_workout,
			'avg_calories_last_7_days'   => $avg_calories_7d,
			'avg_protein_last_7_days'    => $avg_protein_7d,
			'days_with_meal_logs_last_7_days' => $days_logged_7d,
			'meal_logs_last_7_days'      => $meals_logged_7d,
			'last_meal_logged_at'        => $last_meal_logged_display,
			'pantry_item_count'          => $pantry_count,
			'saved_meals_count'          => $saved_meals_count,
			'saved_meal_logs_last_30_days' => $saved_meal_logs_30d,
			'top_saved_meal_name'        => $top_saved_meal->name ?? '',
			'top_saved_meal_uses_last_30_days' => isset( $top_saved_meal->usage_count ) ? (int) $top_saved_meal->usage_count : 0,
			'adherence_summary'          => $adherence_summary,
			'goal_trend_summary'         => $goal_trend_summary,
			'follow_up_pending_count'    => $follow_up_overview['pending_count'] ?? 0,
			'follow_up_overdue_count'    => $follow_up_overview['overdue_count'] ?? 0,
			'follow_up_missed_count'     => $follow_up_overview['missed_count'] ?? 0,
			'follow_up_completed_last_14_days' => $follow_up_overview['completed_last_14_days'] ?? 0,
			'follow_up_dismissed_last_14_days' => $follow_up_overview['dismissed_last_14_days'] ?? 0,
			'follow_up_recent_summary'   => $follow_up_overview['recent_summary'] ?? '',
			'current_local_date'         => $now->format( 'Y-m-d' ),
			'current_local_time'         => $now->format( 'g:i A' ),
			'current_local_datetime'     => $now->format( 'Y-m-d g:i A T' ),
			'user_timezone'              => UserTime::timezone_string( $user_id ),
		];

		return array_merge( $context, $context_overrides );
	}

	/**
	 * Produce a short adherence description from recent logging activity.
	 */
	private static function compute_adherence_summary( int $days_logged, int $workouts ): string {
		$parts = [];
		if ( $days_logged >= 6 ) {
			$parts[] = 'strong meal logging';
		} elseif ( $days_logged >= 4 ) {
			$parts[] = 'moderate meal logging';
		} elseif ( $days_logged > 0 ) {
			$parts[] = 'inconsistent meal logging';
		} else {
			$parts[] = 'no meal logs this week';
		}

		if ( $workouts >= 4 ) {
			$parts[] = 'strong workout consistency';
		} elseif ( $workouts >= 2 ) {
			$parts[] = 'moderate workout consistency';
		} elseif ( $workouts === 1 ) {
			$parts[] = 'only 1 workout this week';
		} else {
			$parts[] = 'no workouts this week';
		}

		return implode( ', ', $parts );
	}

	/**
	 * Produce a short goal trend string based on calorie and protein averages vs. targets.
	 */
	private static function compute_goal_trend_summary( string $goal_type, int $avg_cal, int $target_cal, int $avg_pro, int $target_pro ): string {
		if ( ! $goal_type || ( ! $avg_cal && ! $avg_pro ) ) {
			return '';
		}

		$issues = [];

		if ( $target_pro > 0 && $avg_pro > 0 ) {
			$pro_pct = $avg_pro / $target_pro;
			if ( $pro_pct < 0.75 ) {
				$issues[] = "protein well under target ({$avg_pro} g vs {$target_pro} g)";
			} elseif ( $pro_pct < 0.90 ) {
				$issues[] = "protein slightly under target ({$avg_pro} g vs {$target_pro} g)";
			}
		}

		if ( $target_cal > 0 && $avg_cal > 0 ) {
			$cal_delta = $avg_cal - $target_cal;
			if ( in_array( $goal_type, [ 'cut', 'recomp' ], true ) && $cal_delta > self::CALORIE_TOLERANCE_KCAL ) {
				$issues[] = "calories over target ({$avg_cal} kcal vs {$target_cal} kcal)";
			} elseif ( in_array( $goal_type, [ 'gain' ], true ) && $cal_delta < -self::CALORIE_TOLERANCE_KCAL ) {
				$issues[] = "calories under target ({$avg_cal} kcal vs {$target_cal} kcal)";
			}
		}

		if ( $issues ) {
			return 'Falling behind — ' . implode( '; ', $issues );
		}

		return 'On track';
	}

	// ── Thread memory / summary ───────────────────────────────────────────────

	/**
	 * After every 5 assistant turns, regenerate the thread summary so Johnny
	 * maintains useful long-term memory without growing the context window.
	 */
	private static function maybe_refresh_thread_summary( int $thread_id, int $user_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$assistant_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_ai_messages WHERE thread_id = %d AND role = 'assistant'",
			$thread_id
		) );

		// Require at least SUMMARY_MIN_TURNS turns before first summary; refresh every SUMMARY_REFRESH_INTERVAL turns.
		if ( $assistant_count < self::SUMMARY_MIN_TURNS || $assistant_count % self::SUMMARY_REFRESH_INTERVAL !== 0 ) {
			return;
		}

		$summary = self::generate_thread_summary( $thread_id, $user_id );
		if ( $summary ) {
			$wpdb->update(
				$p . 'fit_ai_threads',
				[ 'summary_text' => $summary ],
				[ 'id' => $thread_id ]
			);
			self::refresh_durable_memory( $user_id, $summary );
		}
	}

	/**
	 * Call OpenAI to produce a compact coaching memory summary for the thread.
	 * Reads the most recent 40 messages to keep the summary call fast.
	 */
	private static function generate_thread_summary( int $thread_id, int $user_id ): ?string {
		global $wpdb;
		$p = $wpdb->prefix;

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT role, message_text FROM {$p}fit_ai_messages
			 WHERE thread_id = %d AND role IN ('user','assistant')
			 ORDER BY id DESC LIMIT 40",
			$thread_id
		) );

		if ( count( $rows ) < self::SUMMARY_MIN_MESSAGES ) {
			return null;
		}

		$rows         = array_reverse( $rows );
		$conversation = implode( "\n\n", array_map(
			static fn( $m ) => ucfirst( $m->role ) . ': ' . $m->message_text,
			$rows
		) );

		$prompt_messages = [
			[
				'role'    => 'system',
				'content' => 'You are a memory assistant. Summarize the key coaching context from this conversation in 8-12 concise bullet points. Focus on: goals the user is pursuing, recurring struggles, plans suggested, coaching style preferences, commitments made, and notable wins or frustrations. Be specific and factual. No preamble, no headers — bullet points only.',
			],
			[
				'role'    => 'user',
				'content' => $conversation,
			],
		];

		$result = self::call_openai( $prompt_messages, self::DEFAULT_MODEL );
		if ( is_wp_error( $result ) ) {
			return null;
		}

		CostTracker::log_openai(
			$user_id,
			self::DEFAULT_MODEL,
			'/v1/responses',
			$result['tokens_in'],
			$result['tokens_out'],
			[ 'context' => 'thread_summary' ]
		);

		return trim( $result['reply'] ) ?: null;
	}

	private static function refresh_durable_memory( int $user_id, string $thread_summary ): void {
		$thread_summary = trim( $thread_summary );
		if ( '' === $thread_summary ) {
			return;
		}

		$current_memory = self::get_durable_memory( $user_id );
		$current_bullets = is_array( $current_memory['bullets'] ?? null ) ? $current_memory['bullets'] : [];
		$context_lines = self::format_context_block( self::get_user_context( $user_id ) );
		$prompt_messages = [
			[
				'role'    => 'system',
				'content' => 'You maintain long-term coaching memory for a fitness app. Return only valid JSON with shape {"bullets":["..."]}. Keep 4-8 bullets. Include durable patterns, preferences, recurring struggles, preferred coaching style, or commitments worth remembering across future conversations. Exclude one-off trivia and anything time-sensitive that will be stale quickly.',
			],
			[
				'role'    => 'user',
				'content' => "Current durable memory:\n" . implode( "\n", array_map( static fn( $item ) => '- ' . sanitize_text_field( (string) $item ), $current_bullets ) ) . "\n\nFresh thread summary:\n" . $thread_summary . "\n\nCurrent user context:\n" . implode( "\n", $context_lines ),
			],
		];

		$result = self::call_openai( $prompt_messages, self::DEFAULT_MODEL );
		if ( is_wp_error( $result ) ) {
			return;
		}

		$parsed = self::decode_json_reply( (string) $result['reply'] );
		$bullets = is_array( $parsed['bullets'] ?? null ) ? $parsed['bullets'] : [];
		$bullets = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );
		if ( empty( $bullets ) ) {
			return;
		}

		update_user_meta( $user_id, self::DURABLE_MEMORY_META_KEY, [
			'bullets'    => array_slice( $bullets, 0, 8 ),
			'updated_at' => current_time( 'mysql' ),
		] );
	}

	private static function store_queued_follow_ups( int $user_id, array $actions ): array {
		$current = self::get_pending_follow_ups( $user_id );
		$index = [];
		foreach ( $current as $item ) {
			$key = strtolower( trim( (string) ( $item['prompt'] ?? '' ) ) );
			if ( '' !== $key ) {
				$index[ $key ] = $item;
			}
		}

		$created = [];
		foreach ( $actions as $action ) {
			if ( ! is_array( $action ) || 'queue_follow_up' !== ( $action['type'] ?? '' ) ) {
				continue;
			}

			$payload = is_array( $action['payload'] ?? null ) ? $action['payload'] : [];
			$prompt = sanitize_textarea_field( (string) ( $payload['prompt'] ?? '' ) );
			$reason = sanitize_text_field( (string) ( $payload['reason'] ?? '' ) );
			$key = strtolower( trim( $prompt ) );
			if ( '' === $key || isset( $index[ $key ] ) ) {
				continue;
			}

			$due_at = sanitize_text_field( (string) ( $payload['due_at'] ?? '' ) );
			$item = [
				'id'         => wp_generate_uuid4(),
				'prompt'     => $prompt,
				'reason'     => $reason,
				'next_step'  => sanitize_text_field( (string) ( $payload['next_step'] ?? '' ) ),
				'starter_prompt' => sanitize_textarea_field( (string) ( $payload['starter_prompt'] ?? '' ) ),
				'commitment_key' => sanitize_key( (string) ( $payload['commitment_key'] ?? '' ) ),
				'due_at'     => $due_at,
				'status'     => '' !== $due_at ? 'snoozed' : 'pending',
				'created_at' => current_time( 'mysql' ),
			];
			$current[] = $item;
			$index[ $key ] = $item;
			$created[] = $item;
		}

		if ( count( $current ) > self::MAX_PENDING_FOLLOW_UPS ) {
			$current = array_slice( $current, -self::MAX_PENDING_FOLLOW_UPS );
		}

		update_user_meta( $user_id, self::FOLLOW_UP_META_KEY, array_values( $current ) );
		return $created;
	}

	private static function record_follow_up_event( int $user_id, array $event ): void {
		$history = self::get_follow_up_history( $user_id );
		$history[] = [
			'id'         => sanitize_text_field( (string) ( $event['id'] ?? wp_generate_uuid4() ) ),
			'prompt'     => sanitize_textarea_field( (string) ( $event['prompt'] ?? '' ) ),
			'reason'     => sanitize_text_field( (string) ( $event['reason'] ?? '' ) ),
			'state'      => sanitize_key( (string) ( $event['state'] ?? '' ) ),
			'changed_at' => sanitize_text_field( (string) ( $event['changed_at'] ?? current_time( 'mysql' ) ) ),
			'due_at'     => sanitize_text_field( (string) ( $event['due_at'] ?? '' ) ),
		];

		usort( $history, static fn( array $left, array $right ): int => strcmp( (string) ( $right['changed_at'] ?? '' ), (string) ( $left['changed_at'] ?? '' ) ) );
		update_user_meta( $user_id, self::FOLLOW_UP_HISTORY_META_KEY, array_slice( $history, 0, self::MAX_FOLLOW_UP_HISTORY_ITEMS ) );
	}

	private static function get_missed_follow_up_threshold( int $user_id ): string {
		$hours = max( 1, self::MISSED_FOLLOW_UP_HOURS );

		try {
			$now = new \DateTimeImmutable( UserTime::mysql( $user_id ), UserTime::timezone( $user_id ) );
			return $now->modify( '-' . $hours . ' hours' )->format( 'Y-m-d H:i:s' );
		} catch ( \Exception $e ) {
			return UserTime::days_ago( $user_id, 1 );
		}
	}

	// ── Weekly stats helper ───────────────────────────────────────────────────

	private static function compile_weekly_stats( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$since = UserTime::days_ago( $user_id, 6 );

		$workouts = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 AND session_date >= %s",
			$user_id,
			$since
		) );

		$avg_calories = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT AVG(daily_cal) FROM (
			   SELECT DATE(m.meal_datetime) AS d, SUM(mi.calories) AS daily_cal
			   FROM {$p}fit_meal_items mi
			   JOIN {$p}fit_meals m ON m.id = mi.meal_id
			   WHERE m.user_id = %d AND m.confirmed = 1
			     AND DATE(m.meal_datetime) >= %s
			   GROUP BY DATE(m.meal_datetime)
			 ) t",
			$user_id,
			$since
		) );

		$avg_protein = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT AVG(daily_pro) FROM (
			   SELECT DATE(m.meal_datetime) AS d, SUM(mi.protein_g) AS daily_pro
			   FROM {$p}fit_meal_items mi
			   JOIN {$p}fit_meals m ON m.id = mi.meal_id
			   WHERE m.user_id = %d AND m.confirmed = 1
			     AND DATE(m.meal_datetime) >= %s
			   GROUP BY DATE(m.meal_datetime)
			 ) t",
			$user_id,
			$since
		) );

		$weights = $wpdb->get_col( $wpdb->prepare(
			"SELECT weight_lb FROM {$p}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT 14",
			$user_id
		) );
		$weight_change = count( $weights ) >= 2 ? ( (float) $weights[0] - (float) $weights[ count( $weights ) - 1 ] ) : null;

		return [
			'workouts_completed' => $workouts,
			'avg_calories'       => (int) round( $avg_calories ),
			'avg_protein_g'      => (int) round( $avg_protein ),
			'weight_change_lb'   => $weight_change,
			'latest_weight_lb'   => $weights[0] ?? null,
		];
	}

	private static function dashboard_review_cache_payload( array $snapshot ): array {
		return [
			'date'              => (string) ( $snapshot['date'] ?? '' ),
			'goal_type'         => (string) ( $snapshot['goal']->goal_type ?? '' ),
			'target_calories'   => (int) ( $snapshot['goal']->target_calories ?? 0 ),
			'target_protein_g'  => (float) ( $snapshot['goal']->target_protein_g ?? 0 ),
			'target_steps'      => (int) ( $snapshot['steps']['target'] ?? 0 ),
			'target_sleep'      => (float) ( $snapshot['goal']->target_sleep_hours ?? 0 ),
			'calories'          => (int) ( $snapshot['nutrition_totals']['calories'] ?? 0 ),
			'protein_g'         => (float) ( $snapshot['nutrition_totals']['protein_g'] ?? 0 ),
			'meals_count'       => count( (array) ( $snapshot['meals_today'] ?? [] ) ),
			'steps_today'       => (int) ( $snapshot['steps']['today'] ?? 0 ),
			'sleep_hours'       => (float) ( $snapshot['sleep']->hours_sleep ?? 0 ),
			'sleep_quality'     => (string) ( $snapshot['sleep']->sleep_quality ?? '' ),
			'session_completed' => (bool) ( $snapshot['session']->completed ?? false ),
			'planned_day_type'  => (string) ( $snapshot['session']->planned_day_type ?? $snapshot['today_schedule']->day_type ?? '' ),
			'score_7d'          => (int) ( $snapshot['score_7d'] ?? 0 ),
			'streaks'           => (array) ( $snapshot['streaks'] ?? [] ),
			'recovery_mode'     => (string) ( $snapshot['recovery_summary']['mode'] ?? '' ),
			'recommended_time_tier' => (string) ( $snapshot['recovery_summary']['recommended_time_tier'] ?? '' ),
			'skip_warning'      => (bool) ( $snapshot['skip_warning'] ?? false ),
			'skip_count_30d'    => (int) ( $snapshot['skip_count_30d'] ?? 0 ),
		];
	}

	private static function build_dashboard_review_prompt( array $snapshot ): string {
		$goal = $snapshot['goal'] ?? (object) [];
		$nutrition = $snapshot['nutrition_totals'] ?? [];
		$steps = $snapshot['steps'] ?? [];
		$sleep = $snapshot['sleep'] ?? (object) [];
		$session = $snapshot['session'] ?? (object) [];
		$today_schedule = $snapshot['today_schedule'] ?? (object) [];
		$tomorrow = $snapshot['tomorrow_preview'] ?? (object) [];
		$recovery = $snapshot['recovery_summary'] ?? [];
		$streaks = $snapshot['streaks'] ?? [];
		$adjustment = $snapshot['calorie_adjustment_preview'] ?? [];

		$lines = [
			sprintf( 'Date: %s', (string) ( $snapshot['date'] ?? current_time( 'Y-m-d' ) ) ),
			sprintf( 'Goal: %s', (string) ( $goal->goal_type ?? 'maintain' ) ),
			sprintf( 'Nutrition today: %d calories, %.0f g protein, %.0f g carbs, %.0f g fat across %d meals.', (int) ( $nutrition['calories'] ?? 0 ), (float) ( $nutrition['protein_g'] ?? 0 ), (float) ( $nutrition['carbs_g'] ?? 0 ), (float) ( $nutrition['fat_g'] ?? 0 ), count( (array) ( $snapshot['meals_today'] ?? [] ) ) ),
			sprintf( 'Targets: %d calories, %.0f g protein, %d steps, %.1f hours sleep.', (int) ( $goal->target_calories ?? 0 ), (float) ( $goal->target_protein_g ?? 0 ), (int) ( $steps['target'] ?? 0 ), (float) ( $goal->target_sleep_hours ?? 0 ) ),
			sprintf( 'Steps today: %d.', (int) ( $steps['today'] ?? 0 ) ),
			sprintf( 'Sleep last night: %.1f hours%s.', (float) ( $sleep->hours_sleep ?? 0 ), ! empty( $sleep->sleep_quality ) ? sprintf( ' (%s quality)', (string) $sleep->sleep_quality ) : '' ),
			sprintf( 'Workout today: %s%s.', ! empty( $session->completed ) ? 'completed' : 'not completed', ! empty( $session->planned_day_type ) || ! empty( $today_schedule->day_type ) ? ' for ' . str_replace( '_', ' ', (string) ( $session->planned_day_type ?? $today_schedule->day_type ) ) : '' ),
			sprintf( 'Weekly score: %d.', (int) ( $snapshot['score_7d'] ?? 0 ) ),
			sprintf( 'Streaks: meals %d, training %d, sleep %d, cardio %d.', (int) ( $streaks['logging_days'] ?? 0 ), (int) ( $streaks['training_days'] ?? 0 ), (int) ( $streaks['sleep_days'] ?? 0 ), (int) ( $streaks['cardio_days'] ?? 0 ) ),
			sprintf( 'Recovery mode: %s. Headline: %s', (string) ( $recovery['mode'] ?? 'normal' ), (string) ( $recovery['headline'] ?? '' ) ),
			sprintf( 'Tomorrow preview: %s%s.', ! empty( $tomorrow->planned_day_type ) ? str_replace( '_', ' ', (string) $tomorrow->planned_day_type ) : 'recovery / open day', ! empty( $tomorrow->time_tier ) ? ' (' . (string) $tomorrow->time_tier . ')' : '' ),
		];

		if ( is_array( $adjustment ) && ! empty( $adjustment ) ) {
			$lines[] = 'Calorie adjustment preview: ' . wp_json_encode( $adjustment );
		}

		if ( ! empty( $snapshot['skip_warning'] ) ) {
			$lines[] = sprintf( 'Skip warning active: %d skips in the last 30 days.', (int) ( $snapshot['skip_count_30d'] ?? 0 ) );
		}

		$lines[] = 'Return only valid JSON with this exact shape: {title, message, next_step, encouragement, starter_prompt}.';
		$lines[] = 'Rules: title 4-10 words. message 2-3 sentences max reviewing current progress. next_step 1 sentence telling the user what to do next. encouragement 1 supportive sentence. starter_prompt 1 sentence the app can send back to Johnny for a deeper follow-up about today. Be specific to the data. Do not invent metrics. Keep the tone warm, direct, and encouraging.';

		return implode( "\n", $lines );
	}

	private static function normalise_dashboard_review_payload( array $parsed, array $snapshot ): array {
		$title = sanitize_text_field( (string) ( $parsed['title'] ?? '' ) );
		$message = sanitize_textarea_field( (string) ( $parsed['message'] ?? '' ) );
		$next_step = sanitize_textarea_field( (string) ( $parsed['next_step'] ?? '' ) );
		$encouragement = sanitize_textarea_field( (string) ( $parsed['encouragement'] ?? '' ) );
		$starter_prompt = sanitize_textarea_field( (string) ( $parsed['starter_prompt'] ?? '' ) );

		if ( '' === $title ) {
			$title = 'Johnny reviewed your board';
		}

		if ( '' === $message ) {
			$message = 'Johnny reviewed your current progress and sees a clear next move for today.';
		}

		if ( '' === $next_step ) {
			$next_step = 'Pick the highest-impact open action and close it before the day gets noisier.';
		}

		if ( '' === $encouragement ) {
			$encouragement = 'You do not need a perfect day. You just need the next solid rep.';
		}

		if ( '' === $starter_prompt ) {
			$starter_prompt = 'Review my current dashboard stats and tell me exactly what I should do next today.';
		}

		return [
			'title' => $title,
			'message' => $message,
			'next_step' => $next_step,
			'encouragement' => $encouragement,
			'starter_prompt' => $starter_prompt,
			'metrics' => self::dashboard_review_metrics( $snapshot ),
		];
	}

	private static function dashboard_review_metrics( array $snapshot ): array {
		$goal = $snapshot['goal'] ?? (object) [];
		$steps = $snapshot['steps'] ?? [];
		$nutrition = $snapshot['nutrition_totals'] ?? [];
		$sleep = $snapshot['sleep'] ?? (object) [];

		return array_values( array_filter( [
			sprintf( 'Weekly score %d', (int) ( $snapshot['score_7d'] ?? 0 ) ),
			sprintf( 'Steps %s / %s', number_format_i18n( (int) ( $steps['today'] ?? 0 ) ), number_format_i18n( (int) ( $steps['target'] ?? 0 ) ) ),
			! empty( $sleep->hours_sleep ) ? sprintf( 'Sleep %.1fh', (float) $sleep->hours_sleep ) : 'Sleep not logged',
			! empty( $goal->target_protein_g ) ? sprintf( 'Protein %d / %dg', (int) round( (float) ( $nutrition['protein_g'] ?? 0 ) ), (int) round( (float) $goal->target_protein_g ) ) : sprintf( 'Protein %dg', (int) round( (float) ( $nutrition['protein_g'] ?? 0 ) ) ),
		] ) );
	}

	private static function tool_registry(): array {
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
				'description' => 'Get detailed logged meals for a specific date, optionally narrowed to breakfast, lunch, dinner, snack, or shake.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'date'      => [ 'type' => 'string', 'description' => 'Date to inspect in YYYY-MM-DD format. Omit to use today.' ],
						'meal_type' => [ 'type' => 'string', 'description' => 'Optional meal type filter: breakfast, lunch, dinner, snack, or shake.' ],
						'limit'     => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => self::MAX_TOOL_MEAL_ROWS ],
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
						'limit' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => self::MAX_TOOL_PANTRY_ROWS ],
					],
					'additionalProperties' => false,
				],
			],
			'get_recipe_catalog' => [
				'read_only'   => true,
				'enabled'     => true,
				'description' => 'Get recipe suggestions from the current recipe list, optionally filtered by meal type or minimum protein.',
				'parameters'  => [
					'type'                 => 'object',
					'properties'           => [
						'meal_type'         => [ 'type' => 'string', 'description' => 'Optional meal type filter: breakfast, lunch, dinner, snack, or shake.' ],
						'minimum_protein_g' => [ 'type' => 'number', 'minimum' => 0 ],
						'limit'             => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => self::MAX_TOOL_RECIPE_ROWS ],
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
				'description' => 'Get the user’s current or today’s workout session and planned exercises.',
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
								'type'       => 'object',
								'properties' => [
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
								'type'       => 'object',
								'properties' => [
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
		];
	}

	private static function get_chat_function_tools( string $mode = 'general', array $context_overrides = [], string $user_message = '' ): array {
		$request_context = self::derive_tool_request_context( $mode, $context_overrides, $user_message );
		$tools = [];
		foreach ( self::tool_registry() as $name => $tool ) {
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

	private static function derive_tool_request_context( string $mode, array $context_overrides, string $user_message ): array {
		$message = strtolower( trim( $user_message ) );
		$current_screen = sanitize_key( (string) ( $context_overrides['current_screen'] ?? '' ) );
		$workout_keywords = [
			'workout', 'training', 'exercise', 'session', 'split', 'push day', 'pull day', 'leg day', 'upper body', 'lower body', 'bench', 'squat', 'deadlift', 'swap exercise', 'replace exercise',
		];
		$nutrition_keywords = [
			'meal', 'meals', 'breakfast', 'lunch', 'dinner', 'snack', 'shake', 'protein', 'calorie', 'macro', 'macros', 'recipe', 'recipes', 'pantry', 'grocery', 'food', 'eat', 'eating',
		];

		$workout_requested = self::message_contains_any( $message, $workout_keywords );
		$nutrition_requested = self::message_contains_any( $message, $nutrition_keywords );
		$workout_surface = in_array( $mode, [ 'coach', 'workout_review' ], true ) || in_array( $current_screen, [ 'workout', 'workouts' ], true );

		return [
			'workout_mutation_allowed' => $workout_requested || ( $workout_surface && ! $nutrition_requested ),
		];
	}

	private static function tool_allowed_for_request( string $tool_name, array $request_context ): bool {
		return match ( $tool_name ) {
			'create_training_plan', 'swap_workout_exercise' => ! empty( $request_context['workout_mutation_allowed'] ),
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

	private static function execute_chat_tool( int $user_id, string $tool_name, array $arguments = [], string $user_message = '' ): array {
		$arguments = self::normalise_tool_arguments_from_user_message( $user_id, $tool_name, $arguments, $user_message );

		return match ( $tool_name ) {
			'get_profile_summary'   => self::tool_profile_summary( $user_id ),
			'get_daily_targets'     => self::tool_daily_targets( $user_id ),
			'get_today_nutrition'   => self::tool_today_nutrition( $user_id ),
			'get_recent_meals'      => self::tool_recent_meals( $user_id, $arguments ),
			'get_pantry_snapshot'   => self::tool_pantry_snapshot( $user_id, $arguments ),
			'get_recipe_catalog'    => self::tool_recipe_catalog( $user_id, $arguments ),
			'get_recovery_snapshot' => self::tool_recovery_snapshot( $user_id ),
			'get_current_workout'   => self::tool_current_workout( $user_id ),
			'log_steps'             => self::tool_log_steps( $user_id, $arguments ),
			'log_food_from_description' => self::tool_log_food_from_description( $user_id, $arguments ),
			'create_training_plan'  => self::tool_create_training_plan( $user_id, $arguments ),
			'log_sleep'             => self::tool_log_sleep( $user_id, $arguments ),
			'add_pantry_items'      => self::tool_add_pantry_items( $user_id, $arguments ),
			'add_grocery_gap_items' => self::tool_add_grocery_gap_items( $user_id, $arguments ),
			'swap_workout_exercise' => self::tool_swap_workout_exercise( $user_id, $arguments ),
			'schedule_sms_reminder' => self::tool_schedule_sms_reminder( $user_id, $arguments ),
			default                 => [ 'error' => 'Tool not available.' ],
		};
	}

	private static function normalise_tool_arguments_from_user_message( int $user_id, string $tool_name, array $arguments, string $user_message ): array {
		if ( '' === trim( $user_message ) ) {
			return $arguments;
		}

		$relative_date = self::extract_relative_tool_date_from_message( $user_id, $tool_name, $user_message );
		if ( null === $relative_date ) {
			return $arguments;
		}

		if ( in_array( $tool_name, [ 'log_steps', 'log_sleep', 'get_recent_meals' ], true ) ) {
			$arguments['date'] = $relative_date;
		}

		return $arguments;
	}

	private static function extract_relative_tool_date_from_message( int $user_id, string $tool_name, string $user_message ): ?string {
		$message = strtolower( trim( $user_message ) );
		if ( '' === $message ) {
			return null;
		}

		if ( preg_match( '/\b(today|todays)\b/', $message ) ) {
			return UserTime::today( $user_id );
		}

		if ( preg_match( '/\b(yesterday)\b/', $message ) ) {
			return UserTime::yesterday( $user_id );
		}

		if ( preg_match( '/\b(tomorrow)\b/', $message ) ) {
			return UserTime::tomorrow( $user_id );
		}

		if ( 'log_sleep' === $tool_name && preg_match( '/\b(last night|lastnite)\b/', $message ) ) {
			return UserTime::yesterday( $user_id );
		}

		if ( 'log_sleep' === $tool_name && preg_match( '/\b(tonight)\b/', $message ) ) {
			return UserTime::today( $user_id );
		}

		return null;
	}

	private static function tool_profile_summary( int $user_id ): array {
		return self::get_user_context( $user_id );
	}

	private static function tool_daily_targets( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_steps, target_sleep_hours, goal_type
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		return [
			'target_calories'   => (int) ( $goal->target_calories ?? 0 ),
			'target_protein_g'  => (int) ( $goal->target_protein_g ?? 0 ),
			'target_carbs_g'    => (int) ( $goal->target_carbs_g ?? 0 ),
			'target_fat_g'      => (int) ( $goal->target_fat_g ?? 0 ),
			'target_steps'      => (int) ( $goal->target_steps ?? 0 ),
			'target_sleep_hours'=> (float) ( $goal->target_sleep_hours ?? 0 ),
			'goal_type'         => (string) ( $goal->goal_type ?? '' ),
		];
	}

	private static function tool_today_nutrition( int $user_id ): array {
		$today = UserTime::today( $user_id );
		$meal_payload = self::get_meal_breakdown_for_date( $user_id, $today );
		$totals = is_array( $meal_payload['totals'] ?? null ) ? $meal_payload['totals'] : [];
		$entries = is_array( $meal_payload['entries'] ?? null ) ? $meal_payload['entries'] : [];
		$meal_types = array_values( array_unique( array_values( array_filter( array_map( static fn( array $entry ): string => (string) ( $entry['meal_type'] ?? '' ), $entries ) ) ) ) );
		$dinner_entries = array_values( array_filter( $entries, static fn( array $entry ): bool => 'dinner' === ( $entry['meal_type'] ?? '' ) ) );
		$latest_dinner = ! empty( $dinner_entries ) ? end( $dinner_entries ) : null;

		return [
			'date'              => $today,
			'calories'          => (int) ( $totals['calories'] ?? 0 ),
			'protein_g'         => (float) ( $totals['protein_g'] ?? 0 ),
			'carbs_g'           => (float) ( $totals['carbs_g'] ?? 0 ),
			'fat_g'             => (float) ( $totals['fat_g'] ?? 0 ),
			'meal_count'        => count( $entries ),
			'meal_type_count'   => count( $meal_types ),
			'meal_types_logged' => $meal_types,
			'meals'             => $entries,
			'latest_dinner'     => is_array( $latest_dinner ) ? $latest_dinner : null,
		];
	}

	private static function tool_recent_meals( int $user_id, array $arguments = [] ): array {
		$date = self::normalise_tool_date( $user_id, (string) ( $arguments['date'] ?? '' ) );
		$limit = max( 1, min( self::MAX_TOOL_MEAL_ROWS, (int) ( $arguments['limit'] ?? self::MAX_TOOL_MEAL_ROWS ) ) );
		$meal_type = self::sanitize_meal_type_value( (string) ( $arguments['meal_type'] ?? '' ), false );
		$payload = self::get_meal_breakdown_for_date( $user_id, $date, $meal_type, $limit );

		return [
			'date'       => $date,
			'meal_type'  => $meal_type,
			'totals'     => $payload['totals'] ?? [],
			'meals'      => $payload['entries'] ?? [],
			'meal_count' => count( is_array( $payload['entries'] ?? null ) ? $payload['entries'] : [] ),
		];
	}

	private static function tool_pantry_snapshot( int $user_id, array $arguments = [] ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$limit = max( 1, min( self::MAX_TOOL_PANTRY_ROWS, (int) ( $arguments['limit'] ?? self::MAX_TOOL_PANTRY_ROWS ) ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, item_name, quantity, unit, expires_on, category_override, updated_at
			 FROM {$p}fit_pantry_items
			 WHERE user_id = %d
			 ORDER BY updated_at DESC, id DESC
			 LIMIT %d",
			$user_id,
			$limit
		), ARRAY_A );

		$total_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_pantry_items WHERE user_id = %d",
			$user_id
		) );

		$items = array_map( static function( array $row ): array {
			return [
				'id'         => (int) ( $row['id'] ?? 0 ),
				'item_name'  => sanitize_text_field( (string) ( $row['item_name'] ?? '' ) ),
				'quantity'   => isset( $row['quantity'] ) ? (float) $row['quantity'] : null,
				'unit'       => sanitize_text_field( (string) ( $row['unit'] ?? '' ) ),
				'expires_on' => sanitize_text_field( (string) ( $row['expires_on'] ?? '' ) ),
				'category'   => sanitize_key( (string) ( $row['category_override'] ?? '' ) ),
				'updated_at' => sanitize_text_field( (string) ( $row['updated_at'] ?? '' ) ),
			];
		}, is_array( $rows ) ? $rows : [] );

		return [
			'total_count' => $total_count,
			'items'       => $items,
		];
	}

	private static function tool_recipe_catalog( int $user_id, array $arguments = [] ): array {
		$limit = max( 1, min( self::MAX_TOOL_RECIPE_ROWS, (int) ( $arguments['limit'] ?? self::MAX_TOOL_RECIPE_ROWS ) ) );
		$meal_type = self::sanitize_meal_type_value( (string) ( $arguments['meal_type'] ?? '' ), false );
		$minimum_protein = isset( $arguments['minimum_protein_g'] ) ? max( 0, (float) $arguments['minimum_protein_g'] ) : 0;

		$request = new \WP_REST_Request( 'GET', '/fit/v1/nutrition/recipes' );
		$response = \Johnny5k\REST\AiController::get_recipe_suggestions( $request );
		$data = $response->get_data();
		$status = (int) $response->get_status();

		if ( $status >= 400 || ! is_array( $data ) ) {
			return [ 'error' => (string) ( $data['message'] ?? 'Could not load recipes.' ) ];
		}

		$recipes = array_values( array_filter( array_map( static function( $recipe ) {
			$payload = is_array( $recipe ) ? $recipe : (array) $recipe;
			return [
				'recipe_name'          => sanitize_text_field( (string) ( $payload['recipe_name'] ?? '' ) ),
				'meal_type'            => sanitize_key( (string) ( $payload['meal_type'] ?? '' ) ),
				'estimated_calories'   => (int) ( $payload['estimated_calories'] ?? 0 ),
				'estimated_protein_g'  => (float) ( $payload['estimated_protein_g'] ?? 0 ),
				'estimated_carbs_g'    => (float) ( $payload['estimated_carbs_g'] ?? 0 ),
				'estimated_fat_g'      => (float) ( $payload['estimated_fat_g'] ?? 0 ),
				'on_hand_ingredients'  => self::sanitize_string_list( is_array( $payload['on_hand_ingredients'] ?? null ) ? $payload['on_hand_ingredients'] : [] ),
				'missing_ingredients'  => self::sanitize_string_list( is_array( $payload['missing_ingredients'] ?? null ) ? $payload['missing_ingredients'] : [] ),
				'pantry_match_count'   => (int) ( $payload['pantry_match_count'] ?? 0 ),
				'pantry_missing_count' => (int) ( $payload['pantry_missing_count'] ?? 0 ),
			];
		}, $data ), static function( array $recipe ) use ( $meal_type, $minimum_protein ): bool {
			if ( '' !== $meal_type && $meal_type !== ( $recipe['meal_type'] ?? '' ) ) {
				return false;
			}

			return (float) ( $recipe['estimated_protein_g'] ?? 0 ) >= $minimum_protein;
		} ) );

		usort( $recipes, static function( array $left, array $right ): int {
			$protein_compare = (float) ( $right['estimated_protein_g'] ?? 0 ) <=> (float) ( $left['estimated_protein_g'] ?? 0 );
			if ( 0 !== $protein_compare ) {
				return $protein_compare;
			}

			return (int) ( $right['pantry_match_count'] ?? 0 ) <=> (int) ( $left['pantry_match_count'] ?? 0 );
		} );

		return [
			'meal_type'         => $meal_type,
			'minimum_protein_g' => $minimum_protein,
			'recipe_count'      => count( $recipes ),
			'recipes'           => array_slice( $recipes, 0, $limit ),
		];
	}

	private static function tool_recovery_snapshot( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$today = UserTime::today( $user_id );
		$yesterday = UserTime::yesterday( $user_id );

		$sleep = $wpdb->get_row( $wpdb->prepare(
			"SELECT hours_sleep, sleep_quality FROM {$p}fit_sleep_logs WHERE user_id = %d AND sleep_date = %s LIMIT 1",
			$user_id,
			$yesterday
		) );
		$steps = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT steps FROM {$p}fit_step_logs WHERE user_id = %d AND step_date = %s LIMIT 1",
			$user_id,
			$today
		) );
		$latest_weight = $wpdb->get_row( $wpdb->prepare(
			"SELECT weight_lb, metric_date FROM {$p}fit_body_metrics WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );
		$recent_cardio = $wpdb->get_results( $wpdb->prepare(
			"SELECT cardio_date, cardio_type, duration_minutes
			 FROM {$p}fit_cardio_logs WHERE user_id = %d ORDER BY cardio_date DESC LIMIT 3",
			$user_id
		) );

		return [
			'steps_today'     => $steps,
			'sleep_last_night'=> [
				'hours_sleep'   => (float) ( $sleep->hours_sleep ?? 0 ),
				'sleep_quality' => (string) ( $sleep->sleep_quality ?? '' ),
			],
			'latest_weight'   => [
				'weight_lb'   => isset( $latest_weight->weight_lb ) ? (float) $latest_weight->weight_lb : null,
				'metric_date' => $latest_weight->metric_date ?? null,
			],
			'recent_cardio'   => array_map( static function( object $row ): array {
				return [
					'cardio_date'      => $row->cardio_date,
					'cardio_type'      => $row->cardio_type,
					'duration_minutes' => (int) $row->duration_minutes,
				];
			}, $recent_cardio ?: [] ),
		];
	}

	private static function tool_current_workout( int $user_id ): array {
		$workout = self::get_current_workout_payload();
		if ( ! empty( $workout['error'] ) ) {
			return [ 'error' => $workout['error'] ];
		}

		$active_session = is_array( $workout['session'] ?? null ) ? $workout['session'] : [];
		$active_exercises = is_array( $workout['exercises'] ?? null ) ? $workout['exercises'] : [];
		$today_payload = self::get_latest_workout_session_payload_for_date( $user_id, UserTime::today( $user_id ) );
		$today_session = is_array( $today_payload['session'] ?? null ) ? $today_payload['session'] : $active_session;
		$today_exercises = is_array( $today_payload['exercises'] ?? null ) ? $today_payload['exercises'] : $active_exercises;
		$last_completed = self::get_latest_completed_workout_session_payload( $user_id );

		return [
			'session'      => $active_session,
			'session_mode' => (string) ( $workout['session_mode'] ?? 'normal' ),
			'exercises'    => array_map( static function( array $exercise ): array {
				return [
					'id'                  => (int) ( $exercise['id'] ?? 0 ),
					'exercise_id'         => (int) ( $exercise['exercise_id'] ?? 0 ),
					'exercise_name'       => (string) ( $exercise['exercise_name'] ?? '' ),
					'original_exercise_id'=> isset( $exercise['original_exercise_id'] ) ? (int) $exercise['original_exercise_id'] : null,
					'original_exercise_name' => (string) ( $exercise['original_exercise_name'] ?? '' ),
					'was_swapped'         => ! empty( $exercise['was_swapped'] ),
					'slot_type'           => (string) ( $exercise['slot_type'] ?? '' ),
					'target_sets'         => (int) ( $exercise['target_sets'] ?? 0 ),
					'target_rep_min'      => (int) ( $exercise['target_rep_min'] ?? 0 ),
					'target_rep_max'      => (int) ( $exercise['target_rep_max'] ?? 0 ),
					'swap_options'        => array_map( static function( array $option ): array {
						return [
							'id'          => (int) ( $option['id'] ?? 0 ),
							'name'        => (string) ( $option['name'] ?? '' ),
							'equipment'   => (string) ( $option['equipment'] ?? '' ),
							'difficulty'  => (string) ( $option['difficulty'] ?? '' ),
							'swap_reason' => (string) ( $option['swap_reason'] ?? '' ),
						];
					}, is_array( $exercise['swap_options'] ?? null ) ? $exercise['swap_options'] : [] ),
				];
			}, $active_exercises ),
			'has_active_session' => ! empty( $active_session['id'] ),
			'completed_today'    => ! empty( $today_session['completed'] ),
			'today_status'       => ! empty( $active_session['id'] ) ? 'active' : ( ! empty( $today_session['completed'] ) ? 'completed' : ( ! empty( $today_session['id'] ) ? 'scheduled' : 'none' ) ),
			'today_session'      => self::normalise_tool_session_summary( $today_session ),
			'today_exercises'    => array_map( [ __CLASS__, 'normalise_tool_exercise_summary' ], $today_exercises ),
			'last_completed_session' => self::normalise_tool_session_summary( is_array( $last_completed['session'] ?? null ) ? $last_completed['session'] : [] ),
		];
	}

	private static function get_active_goal_targets( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_steps, target_sleep_hours
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		return [
			'target_calories'    => (int) ( $goal->target_calories ?? 0 ),
			'target_protein_g'   => (float) ( $goal->target_protein_g ?? 0 ),
			'target_steps'       => (int) ( $goal->target_steps ?? 0 ),
			'target_sleep_hours' => (float) ( $goal->target_sleep_hours ?? 0 ),
		];
	}

	private static function get_daily_nutrition_totals_for_date( int $user_id, string $date ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$totals = $wpdb->get_row( $wpdb->prepare(
			"SELECT
				COALESCE(SUM(mi.calories), 0) AS calories,
				COALESCE(SUM(mi.protein_g), 0) AS protein_g,
				COUNT(DISTINCT m.id) AS meal_count
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d AND m.confirmed = 1 AND DATE(m.meal_datetime) = %s",
			$user_id,
			$date
		) );

		return [
			'calories'   => (int) ( $totals->calories ?? 0 ),
			'protein_g'  => (float) ( $totals->protein_g ?? 0 ),
			'meal_count' => (int) ( $totals->meal_count ?? 0 ),
		];
	}

	private static function get_meal_breakdown_for_date( int $user_id, string $date, string $meal_type = '', int $limit = self::MAX_TOOL_MEAL_ROWS ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$limit = max( 1, min( self::MAX_TOOL_MEAL_ROWS, $limit ) );

		$totals = $wpdb->get_row( $wpdb->prepare(
			"SELECT
				COALESCE(SUM(mi.calories), 0) AS calories,
				COALESCE(SUM(mi.protein_g), 0) AS protein_g,
				COALESCE(SUM(mi.carbs_g), 0) AS carbs_g,
				COALESCE(SUM(mi.fat_g), 0) AS fat_g
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
			$user_id,
			$date
		), ARRAY_A );

		$where_sql = '' !== $meal_type ? $wpdb->prepare( ' AND m.meal_type = %s', $meal_type ) : '';
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT
				m.id,
				m.meal_type,
				m.meal_datetime,
				COALESCE(SUM(mi.calories), 0) AS calories,
				COALESCE(SUM(mi.protein_g), 0) AS protein_g,
				COALESCE(SUM(mi.carbs_g), 0) AS carbs_g,
				COALESCE(SUM(mi.fat_g), 0) AS fat_g,
				GROUP_CONCAT(mi.food_name ORDER BY mi.id SEPARATOR ' | ') AS foods
			 FROM {$p}fit_meals m
			 LEFT JOIN {$p}fit_meal_items mi ON mi.meal_id = m.id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1{$where_sql}
			 GROUP BY m.id, m.meal_type, m.meal_datetime
			 ORDER BY m.meal_datetime ASC
			 LIMIT %d",
			$user_id,
			$date,
			$limit
		), ARRAY_A );

		$entries = array_map( static function( array $row ): array {
			$foods = array_values( array_filter( array_map( static fn( string $item ): string => sanitize_text_field( trim( $item ) ), explode( '|', (string) ( $row['foods'] ?? '' ) ) ) ) );
			return [
				'id'            => (int) ( $row['id'] ?? 0 ),
				'meal_type'     => sanitize_key( (string) ( $row['meal_type'] ?? '' ) ),
				'meal_datetime' => sanitize_text_field( (string) ( $row['meal_datetime'] ?? '' ) ),
				'calories'      => (int) ( $row['calories'] ?? 0 ),
				'protein_g'     => (float) ( $row['protein_g'] ?? 0 ),
				'carbs_g'       => (float) ( $row['carbs_g'] ?? 0 ),
				'fat_g'         => (float) ( $row['fat_g'] ?? 0 ),
				'foods'         => $foods,
				'food_summary'  => implode( ', ', array_slice( $foods, 0, 6 ) ),
			];
		}, is_array( $rows ) ? $rows : [] );

		return [
			'totals'  => [
				'calories'  => (int) ( $totals['calories'] ?? 0 ),
				'protein_g' => (float) ( $totals['protein_g'] ?? 0 ),
				'carbs_g'   => (float) ( $totals['carbs_g'] ?? 0 ),
				'fat_g'     => (float) ( $totals['fat_g'] ?? 0 ),
			],
			'entries' => $entries,
		];
	}

	private static function normalise_tool_session_summary( array $session ): array {
		return [
			'id'               => (int) ( $session['id'] ?? 0 ),
			'session_date'     => (string) ( $session['session_date'] ?? '' ),
			'planned_day_type' => (string) ( $session['planned_day_type'] ?? '' ),
			'actual_day_type'  => (string) ( $session['actual_day_type'] ?? '' ),
			'completed'        => ! empty( $session['completed'] ),
			'skip_requested'   => ! empty( $session['skip_requested'] ),
			'started_at'       => (string) ( $session['started_at'] ?? '' ),
			'completed_at'     => (string) ( $session['completed_at'] ?? '' ),
			'time_tier'        => (string) ( $session['time_tier'] ?? '' ),
			'readiness_score'  => isset( $session['readiness_score'] ) ? (int) $session['readiness_score'] : null,
		];
	}

	private static function normalise_tool_exercise_summary( array $exercise ): array {
		return [
			'id'             => (int) ( $exercise['id'] ?? 0 ),
			'exercise_name'  => (string) ( $exercise['exercise_name'] ?? '' ),
			'slot_type'      => (string) ( $exercise['slot_type'] ?? '' ),
			'target_sets'    => (int) ( $exercise['target_sets'] ?? 0 ),
			'target_rep_min' => (int) ( $exercise['target_rep_min'] ?? 0 ),
			'target_rep_max' => (int) ( $exercise['target_rep_max'] ?? 0 ),
			'was_swapped'    => ! empty( $exercise['was_swapped'] ),
		];
	}

	private static function get_latest_workout_session_payload_for_date( int $user_id, string $date ): array {
		global $wpdb;
		$session_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND session_date = %s ORDER BY id DESC LIMIT 1",
			$user_id,
			$date
		) );

		return $session_id > 0 ? self::get_workout_session_payload_by_id( $session_id ) : [];
	}

	private static function get_latest_completed_workout_session_payload( int $user_id ): array {
		global $wpdb;
		$session_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND completed = 1 ORDER BY session_date DESC, id DESC LIMIT 1",
			$user_id
		) );

		return $session_id > 0 ? self::get_workout_session_payload_by_id( $session_id ) : [];
	}

	private static function get_workout_session_payload_by_id( int $session_id ): array {
		$request = new \WP_REST_Request( 'GET', '/fit/v1/workout/' . $session_id );
		$request->set_param( 'id', $session_id );
		$response = \Johnny5k\REST\WorkoutController::get_session( $request );
		$data = $response->get_data();
		$status = (int) $response->get_status();

		if ( $status >= 400 ) {
			return [];
		}

		return [
			'session'      => self::normalise_array_value( $data['session'] ?? [] ),
			'exercises'    => array_map( [ __CLASS__, 'normalise_array_value' ], is_array( $data['exercises'] ?? null ) ? $data['exercises'] : [] ),
			'session_mode' => (string) ( $data['session_mode'] ?? 'normal' ),
		];
	}

	private static function tool_log_steps( int $user_id, array $arguments = [] ): array {
			$steps = isset( $arguments['steps'] ) ? (int) $arguments['steps'] : -1;
			if ( $steps < 0 ) {
				return [ 'error' => 'A non-negative step count is required.' ];
			}

			$request = new \WP_REST_Request( 'POST', '/fit/v1/body/steps' );
			$request->set_param( 'steps', $steps );

			$date = self::normalise_tool_date( $user_id, (string) ( $arguments['date'] ?? '' ) );
			if ( '' !== $date ) {
				$request->set_param( 'date', $date );
			}

			$response = \Johnny5k\REST\BodyMetricsController::log_steps( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not log steps.' ) ];
			}

			$date_logged = (string) ( $data['date'] ?? UserTime::today( $user_id ) );
			$date_display = self::format_tool_display_date( $user_id, $date_logged );
			$targets = self::get_active_goal_targets( $user_id );
			$target_steps = (int) ( $targets['target_steps'] ?? 0 );
			$steps_logged = (int) ( $data['steps'] ?? $steps );
			$remaining_steps = max( 0, $target_steps - $steps_logged );
			$coach_note = $target_steps > 0
				? sprintf( 'That puts you at %s of %s steps. %s', number_format_i18n( $steps_logged ), number_format_i18n( $target_steps ), $remaining_steps > 0 ? sprintf( '%s left to close the target.', number_format_i18n( $remaining_steps ) ) : 'Step target closed for the day.' )
				: 'Step target updated for the day.';

			return [
				'ok'      => true,
				'action'  => 'log_steps',
				'date'    => $date_logged,
				'date_display' => $date_display,
				'steps'   => $steps_logged,
				'target_steps' => $target_steps,
				'remaining_steps' => $remaining_steps,
				'coach_note' => $coach_note,
				'summary' => sprintf( 'Logged %s steps for %s. %s', number_format_i18n( $steps_logged ), $date_display, $coach_note ),
			];
		}

		private static function tool_log_food_from_description( int $user_id, array $arguments = [] ): array {
			$food_text = trim( (string) ( $arguments['food_text'] ?? '' ) );
			if ( '' === $food_text ) {
				return [ 'error' => 'A food description is required.' ];
			}

			$analysis = self::analyse_food_text( $user_id, $food_text );
			if ( is_wp_error( $analysis ) ) {
				return [ 'error' => $analysis->get_error_message() ];
			}

			$meal_type = sanitize_key( (string) ( $arguments['meal_type'] ?? 'lunch' ) );
			if ( ! in_array( $meal_type, [ 'breakfast', 'lunch', 'dinner', 'snack', 'shake' ], true ) ) {
				$meal_type = 'lunch';
			}

			$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/meal' );
			$request->set_param( 'meal_type', $meal_type );
			$request->set_param( 'source', 'ai' );
			$request->set_param( 'meal_datetime', self::normalise_tool_datetime( $user_id, (string) ( $arguments['meal_datetime'] ?? '' ) ) );
			$request->set_param( 'items', [ [
				'food_name'      => (string) ( $analysis['food_name'] ?? 'Food item' ),
				'serving_amount' => 1,
				'serving_unit'   => (string) ( $analysis['serving_size'] ?? 'serving' ),
				'calories'       => (int) ( $analysis['calories'] ?? 0 ),
				'protein_g'      => (float) ( $analysis['protein_g'] ?? 0 ),
				'carbs_g'        => (float) ( $analysis['carbs_g'] ?? 0 ),
				'fat_g'          => (float) ( $analysis['fat_g'] ?? 0 ),
				'fiber_g'        => (float) ( $analysis['fiber_g'] ?? 0 ),
				'sugar_g'        => (float) ( $analysis['sugar_g'] ?? 0 ),
				'sodium_mg'      => (float) ( $analysis['sodium_mg'] ?? 0 ),
				'micros'         => (array) ( $analysis['micros'] ?? [] ),
			] ] );

			$response = \Johnny5k\REST\AiController::log_meal( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not log that food.' ) ];
			}

			$food_name = (string) ( $analysis['food_name'] ?? 'Food item' );
			$meal_datetime = (string) ( $data['meal_datetime'] ?? self::normalise_tool_datetime( $user_id, (string) ( $arguments['meal_datetime'] ?? '' ) ) );
			$meal_date = substr( $meal_datetime, 0, 10 );
			$day_totals = self::get_daily_nutrition_totals_for_date( $user_id, $meal_date );
			$targets = self::get_active_goal_targets( $user_id );
			$estimated = (float) ( $analysis['confidence'] ?? 0 ) < 0.72;
			$coach_note = sprintf(
				'Today now sits at %d calories and %.0f g protein across %d meal%s.',
				(int) ( $day_totals['calories'] ?? 0 ),
				(float) ( $day_totals['protein_g'] ?? 0 ),
				(int) ( $day_totals['meal_count'] ?? 0 ),
				1 === (int) ( $day_totals['meal_count'] ?? 0 ) ? '' : 's'
			);
			if ( ! empty( $targets['target_calories'] ) ) {
				$coach_note .= sprintf( ' Target is %d calories.', (int) $targets['target_calories'] );
			}

			return [
				'ok'         => true,
				'action'     => 'log_food_from_description',
				'meal_id'    => (int) ( $data['meal_id'] ?? 0 ),
				'meal_type'  => $meal_type,
				'meal_date'  => $meal_date,
				'food_name'  => $food_name,
				'calories'   => (int) ( $analysis['calories'] ?? 0 ),
				'protein_g'  => (float) ( $analysis['protein_g'] ?? 0 ),
				'confidence' => (float) ( $analysis['confidence'] ?? 0 ),
				'notes'      => (string) ( $analysis['notes'] ?? '' ),
				'estimated'  => $estimated,
				'review_recommended' => $estimated,
				'coach_note' => $coach_note,
				'summary'    => sprintf( '%s %s to %s. %s', $estimated ? 'Logged an estimate for' : 'Logged', $food_name, $meal_type, $coach_note ),
			];
		}

		private static function tool_create_training_plan( int $user_id, array $arguments = [] ): array {
			$request = new \WP_REST_Request( 'POST', '/fit/v1/training/plan' );
			$name = sanitize_text_field( (string) ( $arguments['name'] ?? 'Johnny 5000 Plan' ) );
			$request->set_param( 'name', $name );

			$template_id = isset( $arguments['program_template_id'] ) ? (int) $arguments['program_template_id'] : 0;
			$template_name = sanitize_text_field( (string) ( $arguments['template_name'] ?? '' ) );
			if ( $template_id > 0 ) {
				$request->set_param( 'program_template_id', $template_id );
			} elseif ( '' !== $template_name ) {
				$request->set_param( 'template_name', $template_name );
			}

			$response = \Johnny5k\REST\TrainingController::create_plan( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not create a training plan.' ) ];
			}

			$plan_name = (string) ( $data['name'] ?? $name );

			return [
				'ok'                 => true,
				'action'             => 'create_training_plan',
				'plan_id'            => (int) ( $data['plan_id'] ?? 0 ),
				'name'               => $plan_name,
				'program_template_id'=> (int) ( $data['program_template_id'] ?? 0 ),
				'days_created'       => (int) ( $data['days_created'] ?? 0 ),
				'summary'            => sprintf( 'Created and activated %s with %d training days.', $plan_name, (int) ( $data['days_created'] ?? 0 ) ),
			];
		}

		private static function tool_log_sleep( int $user_id, array $arguments = [] ): array {
			$hours_sleep = isset( $arguments['hours_sleep'] ) ? (float) $arguments['hours_sleep'] : 0;
			if ( $hours_sleep <= 0 || $hours_sleep > 24 ) {
				return [ 'error' => 'A sleep duration between 0 and 24 hours is required.' ];
			}

			$request = new \WP_REST_Request( 'POST', '/fit/v1/body/sleep' );
			$request->set_param( 'hours_sleep', $hours_sleep );

			$date = self::normalise_tool_date( $user_id, (string) ( $arguments['date'] ?? '' ) );
			if ( '' !== $date ) {
				$request->set_param( 'date', $date );
			}

			$sleep_quality = sanitize_text_field( (string) ( $arguments['sleep_quality'] ?? '' ) );
			if ( '' !== $sleep_quality ) {
				$request->set_param( 'sleep_quality', $sleep_quality );
			}

			$response = \Johnny5k\REST\BodyMetricsController::log_sleep( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not log sleep.' ) ];
			}

			$date_logged = (string) ( $data['date'] ?? UserTime::today( $user_id ) );
			$date_display = self::format_tool_display_date( $user_id, $date_logged );
			$targets = self::get_active_goal_targets( $user_id );
			$target_sleep = (float) ( $targets['target_sleep_hours'] ?? 0 );
			$logged_sleep = (float) ( $data['hours_sleep'] ?? $hours_sleep );
			$sleep_gap = $target_sleep > 0 ? round( $logged_sleep - $target_sleep, 1 ) : 0;
			$coach_note = $target_sleep > 0
				? sprintf( 'Target is %.1f hours, so this is %s%.1f hours.', $target_sleep, $sleep_gap >= 0 ? '+' : '', $sleep_gap )
				: 'Sleep target updated for the day.';
			return [
				'ok'            => true,
				'action'        => 'log_sleep',
				'id'            => (int) ( $data['id'] ?? 0 ),
				'date'          => $date_logged,
				'date_display'  => $date_display,
				'hours_sleep'   => $logged_sleep,
				'target_sleep_hours' => $target_sleep,
				'sleep_quality' => $sleep_quality,
				'coach_note'    => $coach_note,
				'summary'       => sprintf( 'Logged %.1f hours of sleep for %s. %s', $logged_sleep, $date_display, $coach_note ),
			];
		}

		private static function tool_add_pantry_items( int $user_id, array $arguments = [] ): array {
			$items = self::build_tool_items_payload( $arguments, [ 'expires_on' ] );
			if ( empty( $items ) ) {
				return [ 'error' => 'At least one pantry item is required.' ];
			}

			$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/pantry/bulk' );
			$request->set_param( 'items', $items );

			$response = \Johnny5k\REST\AiController::add_pantry_items_bulk( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not update pantry.' ) ];
			}

			$item_names = array_values( array_filter( array_map( static function( array $item ): string {
				$result_item = is_array( $item['item'] ?? null ) ? $item['item'] : [];
				return sanitize_text_field( (string) ( $result_item['item_name'] ?? '' ) );
			}, is_array( $data['items'] ?? null ) ? $data['items'] : [] ) ) );

			return [
				'ok'            => true,
				'action'        => 'add_pantry_items',
				'created_count' => (int) ( $data['created_count'] ?? 0 ),
				'merged_count'  => (int) ( $data['merged_count'] ?? 0 ),
				'updated_count' => (int) ( $data['updated_count'] ?? 0 ),
				'item_names'    => $item_names,
				'coach_note'    => sprintf( 'Pantry now has %d item%s on hand.', count( $item_names ), 1 === count( $item_names ) ? '' : 's' ),
				'summary'       => self::build_bulk_action_summary( 'pantry', $item_names, $data ),
			];
		}

		private static function tool_add_grocery_gap_items( int $user_id, array $arguments = [] ): array {
			$items = self::build_tool_items_payload( $arguments, [ 'notes' ] );
			if ( empty( $items ) ) {
				return [ 'error' => 'At least one grocery gap item is required.' ];
			}

			$request = new \WP_REST_Request( 'POST', '/fit/v1/nutrition/grocery-gap/items' );
			$request->set_param( 'items', $items );

			$response = \Johnny5k\REST\AiController::add_grocery_gap_items( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not update grocery gap.' ) ];
			}

			$item_names = array_values( array_filter( array_map( static function( array $item ): string {
				$result_item = is_array( $item['item'] ?? null ) ? $item['item'] : [];
				return sanitize_text_field( (string) ( $result_item['item_name'] ?? '' ) );
			}, is_array( $data['items'] ?? null ) ? $data['items'] : [] ) ) );

			return [
				'ok'            => true,
				'action'        => 'add_grocery_gap_items',
				'created_count' => (int) ( $data['created_count'] ?? 0 ),
				'merged_count'  => (int) ( $data['merged_count'] ?? 0 ),
				'item_names'    => $item_names,
				'coach_note'    => 'Those items are now queued in grocery gap so the next shopping pass is easier to execute.',
				'summary'       => self::build_bulk_action_summary( 'grocery gap', $item_names, $data ),
			];
		}

		private static function tool_swap_workout_exercise( int $user_id, array $arguments = [] ): array {
			$workout = self::get_current_workout_payload();
			if ( ! empty( $workout['error'] ) ) {
				return [ 'error' => $workout['error'] ];
			}

			$session = is_array( $workout['session'] ?? null ) ? $workout['session'] : [];
			$exercises = is_array( $workout['exercises'] ?? null ) ? $workout['exercises'] : [];
			if ( empty( $session['id'] ) || empty( $exercises ) ) {
				return [ 'error' => 'There is no active workout session to swap exercises in right now.' ];
			}

			$session_exercise_id = isset( $arguments['session_exercise_id'] ) ? (int) $arguments['session_exercise_id'] : 0;
			$current_name = (string) ( $arguments['current_exercise_name'] ?? '' );
			$replacement_name = (string) ( $arguments['replacement_exercise_name'] ?? '' );

			$exercise = self::find_session_exercise_match( $exercises, $session_exercise_id, $current_name );
			if ( empty( $exercise ) ) {
				return [ 'error' => 'I could not find that exercise in the current workout.' ];
			}

			$replacement = self::find_named_match( is_array( $exercise['swap_options'] ?? null ) ? $exercise['swap_options'] : [], $replacement_name, [ 'name' ] );
			if ( empty( $replacement ) ) {
				$available = array_values( array_filter( array_map( static fn( array $option ): string => (string) ( $option['name'] ?? '' ), is_array( $exercise['swap_options'] ?? null ) ? $exercise['swap_options'] : [] ) ) );
				return [
					'error' => empty( $available )
						? 'That exercise cannot be swapped right now.'
						: 'That swap is not available right now. Available options: ' . implode( ', ', array_slice( $available, 0, 6 ) ) . '.',
				];
			}

			$request = new \WP_REST_Request( 'POST', '/fit/v1/workout/' . (int) $session['id'] . '/swap' );
			$request->set_param( 'id', (int) $session['id'] );
			$request->set_param( 'session_exercise_id', (int) ( $exercise['id'] ?? 0 ) );
			$request->set_param( 'new_exercise_id', (int) ( $replacement['id'] ?? 0 ) );

			$response = \Johnny5k\REST\WorkoutController::swap_exercise( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not swap that exercise.' ) ];
			}

			$new_exercise = is_array( $data['exercise'] ?? null ) ? $data['exercise'] : [];
			$new_name = (string) ( $new_exercise['name'] ?? ( $replacement['name'] ?? '' ) );

			return [
				'ok'                  => true,
				'action'              => 'swap_workout_exercise',
				'session_id'          => (int) $session['id'],
				'session_exercise_id' => (int) ( $exercise['id'] ?? 0 ),
				'previous_exercise'   => (string) ( $exercise['exercise_name'] ?? '' ),
				'new_exercise'        => $new_name,
				'coach_note'          => sprintf( 'The current workout now points you to %s instead.', $new_name ),
				'summary'             => sprintf( 'Swapped %s for %s in the current workout. The session is updated.', (string) ( $exercise['exercise_name'] ?? 'that exercise' ), $new_name ),
			];
		}

	private static function tool_schedule_sms_reminder( int $user_id, array $arguments = [] ): array {
		$message = sanitize_textarea_field( (string) ( $arguments['message'] ?? '' ) );
		$send_at_local = sanitize_text_field( (string) ( $arguments['send_at_local'] ?? '' ) );

		if ( '' === trim( $message ) ) {
			return [ 'error' => 'A reminder message is required.' ];
		}
		if ( '' === trim( $send_at_local ) ) {
			return [ 'error' => 'A future local date and time is required.' ];
		}

		$result = SmsService::schedule_user_reminder( $user_id, $send_at_local, $message );
		if ( is_wp_error( $result ) ) {
			return [ 'error' => $result->get_error_message() ];
		}

		$send_at_display = self::format_tool_display_datetime( $user_id, (string) ( $result['send_at_local'] ?? '' ) );
		$timezone_display = self::format_tool_timezone_label( $user_id, (string) ( $result['timezone'] ?? '' ) );
		$timing_phrase = self::build_tool_reminder_timing_phrase( $send_at_display, $timezone_display );

		return [
			'ok'            => true,
			'action'        => 'schedule_sms_reminder',
			'reminder_id'   => sanitize_text_field( (string) ( $result['id'] ?? '' ) ),
			'message'       => sanitize_textarea_field( (string) ( $result['message'] ?? $message ) ),
			'send_at_local' => sanitize_text_field( (string) ( $result['send_at_local'] ?? '' ) ),
			'timezone'      => sanitize_text_field( (string) ( $result['timezone'] ?? '' ) ),
			'send_at_display' => $send_at_display,
			'timezone_display' => $timezone_display,
			'coach_note'    => sprintf( 'SMS reminder locked for %s.', $timing_phrase ),
			'summary'       => sprintf( 'Scheduled an SMS reminder for %s.', $timing_phrase ),
		];
	}

		private static function get_current_workout_payload(): array {
			$request = new \WP_REST_Request( 'GET', '/fit/v1/workout/current' );
			$response = \Johnny5k\REST\WorkoutController::get_current_session( $request );
			$data = $response->get_data();
			$status = (int) $response->get_status();

			if ( $status >= 400 ) {
				return [ 'error' => (string) ( $data['message'] ?? 'Could not load the current workout.' ) ];
			}

			return [
				'session'      => self::normalise_array_value( $data['session'] ?? [] ),
				'exercises'    => array_map( [ __CLASS__, 'normalise_array_value' ], is_array( $data['exercises'] ?? null ) ? $data['exercises'] : [] ),
				'session_mode' => (string) ( $data['session_mode'] ?? 'normal' ),
			];
		}

		private static function build_tool_items_payload( array $arguments, array $extra_fields = [] ): array {
			$items = [];

			if ( is_array( $arguments['items'] ?? null ) ) {
				foreach ( $arguments['items'] as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}

					$payload = self::normalise_tool_item_payload( $item, $extra_fields );
					if ( '' !== ( $payload['item_name'] ?? '' ) ) {
						$items[] = $payload;
					}
				}
			}

			if ( ! empty( $items ) ) {
				return $items;
			}

			$payload = self::normalise_tool_item_payload( $arguments, $extra_fields );
			return '' === ( $payload['item_name'] ?? '' ) ? [] : [ $payload ];
		}

		private static function normalise_tool_item_payload( array $item, array $extra_fields = [] ): array {
			$payload = [
				'item_name' => sanitize_text_field( (string) ( $item['item_name'] ?? '' ) ),
			];

			if ( array_key_exists( 'quantity', $item ) && $item['quantity'] !== null && '' !== $item['quantity'] ) {
				$payload['quantity'] = (float) $item['quantity'];
			}
			if ( array_key_exists( 'unit', $item ) ) {
				$payload['unit'] = sanitize_text_field( (string) $item['unit'] );
			}

			foreach ( $extra_fields as $field ) {
				if ( array_key_exists( $field, $item ) ) {
					$payload[ $field ] = sanitize_text_field( (string) $item[ $field ] );
				}
			}

			return $payload;
		}

		private static function build_bulk_action_summary( string $label, array $item_names, array $data ): string {
			$created = (int) ( $data['created_count'] ?? 0 );
			$merged = (int) ( $data['merged_count'] ?? 0 );
			$updated = (int) ( $data['updated_count'] ?? 0 );
			$count = count( $item_names );
			$sample = implode( ', ', array_slice( $item_names, 0, 3 ) );

			$parts = [];
			if ( $created > 0 ) {
				$parts[] = sprintf( '%d added', $created );
			}
			if ( $merged > 0 ) {
				$parts[] = sprintf( '%d merged', $merged );
			}
			if ( $updated > 0 ) {
				$parts[] = sprintf( '%d updated', $updated );
			}

			$summary = sprintf( 'Updated %s with %d item%s', $label, $count, 1 === $count ? '' : 's' );
			if ( ! empty( $parts ) ) {
				$summary .= ' (' . implode( ', ', $parts ) . ')';
			}
			if ( '' !== $sample ) {
				$summary .= ': ' . $sample;
			}
			return $summary . '.';
		}

		private static function find_session_exercise_match( array $exercises, int $session_exercise_id, string $exercise_name ): array {
			if ( $session_exercise_id > 0 ) {
				foreach ( $exercises as $exercise ) {
					if ( (int) ( $exercise['id'] ?? 0 ) === $session_exercise_id ) {
						return $exercise;
					}
				}
			}

			return self::find_named_match( $exercises, $exercise_name, [ 'exercise_name', 'original_exercise_name' ] );
		}

		private static function find_named_match( array $items, string $query, array $fields ): array {
			$query_key = self::normalise_tool_name_key( $query );
			if ( '' === $query_key ) {
				return [];
			}

			foreach ( $items as $item ) {
				foreach ( $fields as $field ) {
					$value = self::normalise_tool_name_key( (string) ( $item[ $field ] ?? '' ) );
					if ( '' !== $value && $value === $query_key ) {
						return $item;
					}
				}
			}

			foreach ( $items as $item ) {
				foreach ( $fields as $field ) {
					$value = self::normalise_tool_name_key( (string) ( $item[ $field ] ?? '' ) );
					if ( '' !== $value && ( str_contains( $value, $query_key ) || str_contains( $query_key, $value ) ) ) {
						return $item;
					}
				}
			}

			return [];
		}

		private static function normalise_tool_name_key( string $value ): string {
			$value = strtolower( trim( $value ) );
			$value = preg_replace( '/[^a-z0-9]+/', ' ', $value );
			return trim( (string) $value );
		}

		private static function normalise_array_value( $value ): array {
			return is_array( $value ) ? $value : ( is_object( $value ) ? (array) $value : [] );
		}

		private static function normalise_tool_date( int $user_id, string $raw_date ): string {
			$raw_date = strtolower( trim( $raw_date ) );
			if ( '' === $raw_date || 'today' === $raw_date ) {
				return UserTime::today( $user_id );
			}
			if ( 'yesterday' === $raw_date ) {
				return UserTime::yesterday( $user_id );
			}
			if ( 'tomorrow' === $raw_date ) {
				return gmdate( 'Y-m-d', strtotime( UserTime::today( $user_id ) . ' +1 day' ) );
			}
			return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $raw_date ) ? $raw_date : UserTime::today( $user_id );
		}

		private static function normalise_tool_datetime( int $user_id, string $raw_datetime ): string {
			$raw_datetime = trim( $raw_datetime );
			if ( '' === $raw_datetime ) {
				return UserTime::mysql( $user_id );
			}

			if ( preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $raw_datetime ) ) {
				return strlen( $raw_datetime ) === 16 ? $raw_datetime . ':00' : $raw_datetime;
			}

			if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $raw_datetime ) ) {
				return $raw_datetime . ' 12:00:00';
			}

			return UserTime::mysql( $user_id );
		}

		private static function format_tool_display_date( int $user_id, string $raw_date ): string {
			$date = trim( $raw_date );
			if ( '' === $date ) {
				$date = UserTime::today( $user_id );
			}

			$datetime = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $date . ' 12:00:00', UserTime::timezone( $user_id ) );
			if ( false === $datetime ) {
				return $date;
			}

			return $datetime->format( 'M j' );
		}

		private static function format_tool_display_datetime( int $user_id, string $raw_datetime ): string {
			$datetime_value = trim( $raw_datetime );
			if ( '' === $datetime_value ) {
				return '';
			}

			$timezone = UserTime::timezone( $user_id );
			$formats = [ 'Y-m-d H:i:s', 'Y-m-d H:i', \DateTimeInterface::ATOM ];
			$datetime = false;

			foreach ( $formats as $format ) {
				$datetime = \DateTimeImmutable::createFromFormat( $format, $datetime_value, $timezone );
				if ( false !== $datetime ) {
					break;
				}
			}

			if ( false === $datetime ) {
				try {
					$datetime = new \DateTimeImmutable( $datetime_value, $timezone );
				} catch ( \Exception $e ) {
					return $datetime_value;
				}
			}

			return $datetime->setTimezone( $timezone )->format( 'l, F j \a\t g:i A' );
		}

		private static function format_tool_timezone_label( int $user_id, string $timezone_string = '' ): string {
			$timezone_name = '' !== trim( $timezone_string ) ? trim( $timezone_string ) : UserTime::timezone_string( $user_id );
			$named_zones = [
				'America/New_York' => 'Eastern Time',
				'America/Detroit' => 'Eastern Time',
				'America/Indiana/Indianapolis' => 'Eastern Time',
				'America/Chicago' => 'Central Time',
				'America/Denver' => 'Mountain Time',
				'America/Phoenix' => 'Mountain Time',
				'America/Los_Angeles' => 'Pacific Time',
				'America/Anchorage' => 'Alaska Time',
				'Pacific/Honolulu' => 'Hawaii Time',
			];

			if ( isset( $named_zones[ $timezone_name ] ) ) {
				return $named_zones[ $timezone_name ];
			}

			try {
				$timezone = new \DateTimeZone( $timezone_name );
				$now = new \DateTimeImmutable( 'now', $timezone );
				$abbreviation = strtoupper( $now->format( 'T' ) );
				if ( '' !== trim( $abbreviation ) ) {
					return $abbreviation;
				}
			} catch ( \Exception $e ) {
				// Fall through to a basic readable label.
			}

			return str_replace( '_', ' ', preg_replace( '#^.*/#', '', $timezone_name ) );
		}

		private static function build_tool_reminder_timing_phrase( string $send_at_display, string $timezone_display ): string {
			if ( '' !== $send_at_display && '' !== $timezone_display ) {
				return $send_at_display . ' ' . $timezone_display;
			}

			return '' !== $send_at_display ? $send_at_display : $timezone_display;
		}

	// ── OpenAI HTTP helper ────────────────────────────────────────────────────

	/**
	 * @param  array  $messages  OpenAI messages array.
	 * @param  string $model
	 * @param  array<string,mixed> $options
	 * @return array{reply:string, tokens_in:int, tokens_out:int, sources:array<int,array{url:string,title:string}>, used_web_search:bool, model:string, used_tools:array<int,string>, action_results:array<int,array<string,mixed>>}|WP_Error
	 */
	private static function call_openai( array $messages, string $model = self::DEFAULT_MODEL, array $options = [] ) {
		$api_key = get_option( 'jf_openai_api_key', '' );
		if ( ! $api_key ) {
			return new \WP_Error( 'no_api_key', 'OpenAI API key not configured.' );
		}

		$input           = $messages;
		$reply           = '';
		$sources         = [];
		$used_web_search = false;
		$used_tools      = [];
		$action_results  = [];
		$tokens_in       = 0;
		$tokens_out      = 0;
		$function_tools  = array_values( $options['function_tools'] ?? [] );
		$tool_executor   = $options['tool_executor'] ?? null;
		$previous_response_id = '';

		for ( $iteration = 0; $iteration < 4; $iteration++ ) {
			$payload = [
				'model' => $model,
				'input' => $input,
			];

			if ( '' !== $previous_response_id ) {
				$payload['previous_response_id'] = $previous_response_id;
			}

			$tools = [];
			if ( ! empty( $options['web_search'] ) ) {
				$tools[] = [ 'type' => 'web_search' ];
			}
			if ( $function_tools ) {
				$tools = array_merge( $tools, $function_tools );
			}
			if ( $tools ) {
				$payload['tools']       = $tools;
				$payload['tool_choice'] = 'auto';
			}

			$response = wp_remote_post(
				self::RESPONSES_ENDPOINT,
				[
					'headers' => [
						'Content-Type'  => 'application/json',
						'Authorization' => 'Bearer ' . $api_key,
					],
					'body'    => wp_json_encode( $payload ),
					'timeout' => 60,
				]
			);

			if ( is_wp_error( $response ) ) {
				return new \WP_Error( 'openai_http_error', $response->get_error_message() );
			}

			$http = wp_remote_retrieve_response_code( $response );
			$body = json_decode( wp_remote_retrieve_body( $response ), true );

			if ( $http !== 200 || empty( $body['output'] ) ) {
				$err_msg = $body['error']['message'] ?? 'Unknown OpenAI error.';
				return new \WP_Error( 'openai_api_error', $err_msg );
			}

			$tokens_in  = (int) ( $body['usage']['input_tokens']  ?? $tokens_in );
			$tokens_out = (int) ( $body['usage']['output_tokens'] ?? $tokens_out );
			$previous_response_id = (string) ( $body['id'] ?? $previous_response_id );
			$function_calls = [];

			foreach ( $body['output'] as $item ) {
				if ( ( $item['type'] ?? '' ) === 'web_search_call' ) {
					$used_web_search = true;
				}

				if ( ( $item['type'] ?? '' ) === 'function_call' ) {
					$function_calls[] = $item;
					continue;
				}

				if ( ( $item['type'] ?? '' ) === 'message' && isset( $item['content'] ) ) {
					foreach ( $item['content'] as $part ) {
						if ( ( $part['type'] ?? '' ) === 'output_text' ) {
							$reply .= $part['text'];

							foreach ( (array) ( $part['annotations'] ?? [] ) as $annotation ) {
								if ( ( $annotation['type'] ?? '' ) !== 'url_citation' || empty( $annotation['url'] ) ) {
									continue;
								}

								$url   = (string) $annotation['url'];
								$title = (string) ( $annotation['title'] ?? $url );

								if ( ! isset( $sources[ $url ] ) ) {
									$sources[ $url ] = [
										'url'   => $url,
										'title' => $title,
									];
								}
							}
						}
					}
				}
			}

			if ( ! $function_calls || ! is_callable( $tool_executor ) ) {
				break;
			}

			$next_input = [];
			foreach ( $function_calls as $call ) {
				$tool_name = (string) ( $call['name'] ?? '' );
				$arguments = json_decode( (string) ( $call['arguments'] ?? '{}' ), true );
				if ( ! is_array( $arguments ) ) {
					$arguments = [];
				}

				$tool_result = $tool_executor( $tool_name, $arguments );
				$used_tools[] = $tool_name;
				if ( is_array( $tool_result ) && empty( $tool_result['error'] ) && ! empty( $tool_result['action'] ) ) {
					$action_results[] = array_merge( [ 'tool_name' => $tool_name ], $tool_result );
				}
				$next_input[] = [
					'type'    => 'function_call_output',
					'call_id' => (string) ( $call['call_id'] ?? '' ),
					'output'  => wp_json_encode( $tool_result ),
				];
			}

			$input = $next_input;
		}

		return [
			'reply'           => $reply,
			'tokens_in'       => $tokens_in,
			'tokens_out'      => $tokens_out,
			'sources'         => array_values( $sources ),
			'used_web_search' => $used_web_search,
			'model'           => $model,
			'used_tools'      => array_values( array_unique( array_filter( $used_tools ) ) ),
			'action_results'  => $action_results,
		];
	}

	private static function should_enable_web_search( string $message ): bool {
		$message = strtolower( trim( $message ) );
		if ( $message === '' ) {
			return false;
		}

		$patterns = [
			'/\b(latest|current|today|tonight|tomorrow|yesterday|recent|recently|news)\b/',
			'/\b(look up|lookup|search( the)? web|google|find online|check online|browse)\b/',
			'/\b(weather|forecast|temperature|rain|snow|sunrise|sunset)\b/',
			'/\b(score|scores|standings|schedule|odds|injury report)\b/',
			'/\b(stock|stocks|market|price of|price for|price today|bitcoin|btc|ethereum|eth)\b/',
			'/\b(who is|who won|what happened|when is|when does)\b.*\b(today|now|currently|this week|this month|this year)\b/',
		];

		foreach ( $patterns as $pattern ) {
			if ( preg_match( $pattern, $message ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Parse a chat reply that may optionally wrap text plus structured actions in JSON.
	 *
	 * @return array{reply:string,actions:array<int,array<string,mixed>>}
	 */
	private static function parse_structured_chat_reply( string $raw_reply ): array {
		$reply   = trim( $raw_reply );
		$actions = [];
		$decoded = self::decode_json_reply( $raw_reply );

		$why = '';
		$context_used = [];
		$confidence = '';

		if ( is_array( $decoded ) && isset( $decoded['reply'] ) ) {
			$reply   = sanitize_textarea_field( (string) $decoded['reply'] );
			$actions = self::sanitize_structured_actions( is_array( $decoded['actions'] ?? null ) ? $decoded['actions'] : [] );
			$why = sanitize_textarea_field( (string) ( $decoded['why'] ?? '' ) );
			$context_used = self::sanitize_string_list( is_array( $decoded['context_used'] ?? null ) ? $decoded['context_used'] : [] );
			$confidence = sanitize_key( (string) ( $decoded['confidence'] ?? '' ) );
			if ( ! in_array( $confidence, [ 'high', 'medium', 'low' ], true ) ) {
				$confidence = '';
			}
		}

		$reply = self::clean_chat_reply_text( '' !== $reply ? $reply : trim( $raw_reply ) );

		return [
			'reply'        => $reply,
			'actions'      => $actions,
			'why'          => $why,
			'context_used' => $context_used,
			'confidence'   => $confidence,
		];
	}

	private static function clean_chat_reply_text( string $reply ): string {
		$clean = trim( $reply );
		if ( '' === $clean ) {
			return '';
		}

		$clean = preg_replace( '/^\s*#{1,6}\s*/m', '', $clean );
		$clean = preg_replace( '/^\s*(Next steps|Here\'s a plan based on today\'s data)\s*:?\s*$/im', '', $clean );
		$clean = preg_replace( '/\n{3,}/', "\n\n", $clean );

		return trim( $clean );
	}

	/**
	 * @param array<int,mixed> $actions
	 * @return array<int,array<string,mixed>>
	 */
	private static function sanitize_structured_actions( array $actions ): array {
		$clean = [];

		foreach ( $actions as $action ) {
			if ( ! is_array( $action ) ) {
				continue;
			}

			$type = sanitize_key( (string) ( $action['type'] ?? '' ) );
			if ( '' === $type ) {
				continue;
			}

			$payload = is_array( $action['payload'] ?? null ) ? $action['payload'] : [];
			$sanitised = self::sanitize_structured_action_payload( $type, $payload );
			if ( null === $sanitised ) {
				continue;
			}

			$clean[] = [
				'type'    => $type,
				'payload' => $sanitised,
			];
		}

		return array_values( $clean );
	}

	/**
	 * @param array<string,mixed> $payload
	 * @return array<string,mixed>|null
	 */
	private static function sanitize_structured_action_payload( string $type, array $payload ): ?array {
		switch ( $type ) {
			case 'open_screen':
				$screen = sanitize_key( (string) ( $payload['screen'] ?? '' ) );
				if ( ! in_array( $screen, self::SUPPORTED_ACTION_SCREENS, true ) ) {
					return null;
				}

				$result = [ 'screen' => $screen ];
				$meal_type = self::sanitize_meal_type_value( (string) ( $payload['meal_type'] ?? '' ), false );
				if ( '' !== $meal_type ) {
					$result['meal_type'] = $meal_type;
				}

				return $result;

			case 'show_nutrition_summary':
			case 'show_grocery_gap':
				return [];

			case 'highlight_goal_issue':
				$issue = sanitize_text_field( (string) ( $payload['issue'] ?? '' ) );
				$summary = sanitize_textarea_field( (string) ( $payload['summary'] ?? '' ) );
				if ( '' === $issue && '' === $summary ) {
					return [];
				}

				return array_filter([
					'issue' => $issue,
					'summary' => $summary,
				], static fn( $value ) => '' !== $value );

			case 'create_saved_meal_draft':
				$name = sanitize_text_field( (string) ( $payload['name'] ?? '' ) );
				if ( '' === $name ) {
					return null;
				}

				return [
					'name'      => $name,
					'meal_type' => self::sanitize_meal_type_value( (string) ( $payload['meal_type'] ?? 'lunch' ) ),
					'items'     => self::sanitize_meal_draft_items( is_array( $payload['items'] ?? null ) ? $payload['items'] : [] ),
				];

			case 'suggest_recipe_plan':
				$result = [];
				$title = sanitize_text_field( (string) ( $payload['title'] ?? '' ) );
				$meal_type = self::sanitize_meal_type_value( (string) ( $payload['meal_type'] ?? '' ), false );
				if ( '' !== $title ) {
					$result['title'] = $title;
				}
				if ( '' !== $meal_type ) {
					$result['meal_type'] = $meal_type;
				}

				return $result;

			case 'queue_follow_up':
				$prompt = sanitize_textarea_field( (string) ( $payload['prompt'] ?? '' ) );
				if ( '' === trim( $prompt ) ) {
					return null;
				}

				$result = [ 'prompt' => $prompt ];
				$reason = sanitize_text_field( (string) ( $payload['reason'] ?? '' ) );
				if ( '' !== $reason ) {
					$result['reason'] = $reason;
				}
				$due_at = sanitize_text_field( (string) ( $payload['due_at'] ?? '' ) );
				if ( '' !== $due_at ) {
					$result['due_at'] = $due_at;
				}
				$next_step = sanitize_text_field( (string) ( $payload['next_step'] ?? '' ) );
				if ( '' !== $next_step ) {
					$result['next_step'] = $next_step;
				}
				$starter_prompt = sanitize_textarea_field( (string) ( $payload['starter_prompt'] ?? '' ) );
				if ( '' !== $starter_prompt ) {
					$result['starter_prompt'] = $starter_prompt;
				}
				$commitment_key = sanitize_key( (string) ( $payload['commitment_key'] ?? '' ) );
				if ( '' !== $commitment_key ) {
					$result['commitment_key'] = $commitment_key;
				}

				return $result;

			case 'run_workflow':
				$workflow = sanitize_key( (string) ( $payload['workflow'] ?? '' ) );
				if ( ! in_array( $workflow, self::SUPPORTED_WORKFLOWS, true ) ) {
					return null;
				}

				$result = [
					'workflow' => $workflow,
					'steps'    => self::sanitize_string_list( is_array( $payload['steps'] ?? null ) ? $payload['steps'] : [] ),
				];
				$title = sanitize_text_field( (string) ( $payload['title'] ?? '' ) );
				if ( '' !== $title ) {
					$result['title'] = $title;
				}
				$summary = sanitize_textarea_field( (string) ( $payload['summary'] ?? '' ) );
				if ( '' !== $summary ) {
					$result['summary'] = $summary;
				}
				$screen = sanitize_key( (string) ( $payload['screen'] ?? '' ) );
				if ( in_array( $screen, self::SUPPORTED_ACTION_SCREENS, true ) ) {
					$result['screen'] = $screen;
				}
				$meal_type = self::sanitize_meal_type_value( (string) ( $payload['meal_type'] ?? '' ), false );
				if ( '' !== $meal_type ) {
					$result['meal_type'] = $meal_type;
				}
				$items = self::sanitize_meal_draft_items( is_array( $payload['items'] ?? null ) ? $payload['items'] : [] );
				if ( ! empty( $items ) ) {
					$result['items'] = $items;
				}
				$starter_prompt = sanitize_textarea_field( (string) ( $payload['starter_prompt'] ?? '' ) );
				if ( '' !== $starter_prompt ) {
					$result['starter_prompt'] = $starter_prompt;
				}

				return $result;

			default:
				return null;
		}
	}

	/**
	 * @param array<int,mixed> $items
	 * @return array<int,string>
	 */
	private static function sanitize_string_list( array $items ): array {
		return array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $items ) ) );
	}

	private static function sanitize_meal_type_value( string $meal_type, bool $default_to_lunch = true ): string {
		$meal_type = sanitize_key( $meal_type );
		if ( in_array( $meal_type, [ 'breakfast', 'lunch', 'dinner', 'snack' ], true ) ) {
			return $meal_type;
		}

		return $default_to_lunch ? 'lunch' : '';
	}

	/**
	 * @param array<int,mixed> $items
	 * @return array<int,array<string,mixed>>
	 */
	private static function sanitize_meal_draft_items( array $items ): array {
		$clean = [];

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$food_name = sanitize_text_field( (string) ( $item['food_name'] ?? '' ) );
			if ( '' === $food_name ) {
				continue;
			}

			$clean[] = array_filter([
				'food_id'        => isset( $item['food_id'] ) ? (int) $item['food_id'] : null,
				'food_name'      => $food_name,
				'serving_amount' => round( (float) ( $item['serving_amount'] ?? 1 ), 2 ),
				'serving_unit'   => sanitize_text_field( (string) ( $item['serving_unit'] ?? 'serving' ) ),
				'calories'       => max( 0, (int) round( (float) ( $item['calories'] ?? 0 ) ) ),
				'protein_g'      => round( (float) ( $item['protein_g'] ?? 0 ), 2 ),
				'carbs_g'        => round( (float) ( $item['carbs_g'] ?? 0 ), 2 ),
				'fat_g'          => round( (float) ( $item['fat_g'] ?? 0 ), 2 ),
			], static fn( $value ) => null !== $value && '' !== $value );
		}

		return array_values( $clean );
	}

	private static function decode_json_reply( string $reply ): ?array {
		$reply = trim( $reply );
		if ( '' === $reply ) {
			return null;
		}

		$parsed = json_decode( $reply, true );
		if ( JSON_ERROR_NONE === json_last_error() && is_array( $parsed ) ) {
			return $parsed;
		}

		if ( preg_match( '/```(?:json)?\s*(\{.*\}|\[.*\])\s*```/is', $reply, $matches ) ) {
			$parsed = json_decode( trim( $matches[1] ), true );
			if ( JSON_ERROR_NONE === json_last_error() && is_array( $parsed ) ) {
				return $parsed;
			}
		}

		$start = strpos( $reply, '{' );
		$end   = strrpos( $reply, '}' );
		if ( false !== $start && false !== $end && $end > $start ) {
			$parsed = json_decode( substr( $reply, $start, $end - $start + 1 ), true );
			if ( JSON_ERROR_NONE === json_last_error() && is_array( $parsed ) ) {
				return $parsed;
			}
		}

		return null;
	}

	private static function normalise_progress_photo_comparison( array $parsed ): string {
		$comparison = sanitize_textarea_field( (string) ( $parsed['comparison'] ?? '' ) );
		$confidence = sanitize_text_field( (string) ( $parsed['confidence'] ?? '' ) );
		$visible_changes = array_values( array_filter( array_map( static function( $item ): string {
			return sanitize_text_field( (string) $item );
		}, (array) ( $parsed['visible_changes'] ?? [] ) ) ) );

		if ( self::contains_progress_photo_disclaimer( $comparison ) ) {
			$comparison = '';
		}

		if ( '' === $comparison && $visible_changes ) {
			$comparison = 'Visible changes: ' . implode( '; ', $visible_changes ) . '.';
		}

		if ( '' !== $comparison && $confidence && ! self::contains_progress_photo_disclaimer( $confidence ) ) {
			$confidence = strtolower( $confidence );
			if ( in_array( $confidence, [ 'high', 'medium', 'low' ], true ) ) {
				$comparison .= ' Confidence: ' . $confidence . '.';
			}
		}

		return trim( preg_replace( '/\s+/', ' ', $comparison ) ?? '' );
	}

	private static function contains_progress_photo_disclaimer( string $text ): bool {
		$text = strtolower( trim( $text ) );
		if ( '' === $text ) {
			return false;
		}

		$patterns = [
			"can't compare",
			'cannot compare',
			"can't see",
			'cannot see',
			"can't view",
			'cannot view',
			"can't inspect",
			'cannot inspect',
			"can't access the photos",
			'cannot access the photos',
			"can't analyze photos",
			'cannot analyze photos',
		];

		foreach ( $patterns as $pattern ) {
			if ( false !== strpos( $text, $pattern ) ) {
				return true;
			}
		}

		return false;
	}

	private static function normalise_label_analysis( array $parsed ): array {
		$suggestions = [];
		foreach ( (array) ( $parsed['swap_suggestions'] ?? [] ) as $suggestion ) {
			if ( ! is_array( $suggestion ) ) {
				continue;
			}
			$title = sanitize_text_field( (string) ( $suggestion['title'] ?? '' ) );
			$body  = sanitize_textarea_field( (string) ( $suggestion['body'] ?? '' ) );
			if ( '' !== $title && '' !== $body ) {
				$suggestions[] = [ 'title' => $title, 'body' => $body ];
			}
		}

		$flags = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $parsed['flags'] ?? [] ) ) ) );
		$micros = self::normalise_micros( $parsed['micros'] ?? [] );

		return [
			'food_name'        => sanitize_text_field( (string) ( $parsed['food_name'] ?? $parsed['product_name'] ?? $parsed['name'] ?? '' ) ),
			'brand'            => sanitize_text_field( (string) ( $parsed['brand'] ?? '' ) ),
			'serving_size'     => sanitize_text_field( (string) ( $parsed['serving_size'] ?? '1 serving' ) ),
			'calories'         => (int) round( (float) ( $parsed['calories'] ?? 0 ) ),
			'protein_g'        => round( (float) ( $parsed['protein_g'] ?? 0 ), 2 ),
			'carbs_g'          => round( (float) ( $parsed['carbs_g'] ?? 0 ), 2 ),
			'fat_g'            => round( (float) ( $parsed['fat_g'] ?? 0 ), 2 ),
			'fiber_g'          => round( (float) ( $parsed['fiber_g'] ?? 0 ), 2 ),
			'sugar_g'          => round( (float) ( $parsed['sugar_g'] ?? 0 ), 2 ),
			'sodium_mg'        => round( (float) ( $parsed['sodium_mg'] ?? 0 ), 2 ),
			'micros'           => $micros,
			'fit_summary'      => sanitize_textarea_field( (string) ( $parsed['fit_summary'] ?? '' ) ),
			'flags'            => $flags,
			'swap_suggestions' => $suggestions,
		];
	}

	private static function normalise_food_analysis( array $parsed ): array {
		return [
			'food_name'    => sanitize_text_field( (string) ( $parsed['food_name'] ?? $parsed['product_name'] ?? $parsed['name'] ?? '' ) ),
			'brand'        => sanitize_text_field( (string) ( $parsed['brand'] ?? '' ) ),
			'serving_size' => sanitize_text_field( (string) ( $parsed['serving_size'] ?? '1 serving' ) ),
			'calories'     => (int) round( (float) ( $parsed['calories'] ?? 0 ) ),
			'protein_g'    => round( (float) ( $parsed['protein_g'] ?? 0 ), 2 ),
			'carbs_g'      => round( (float) ( $parsed['carbs_g'] ?? 0 ), 2 ),
			'fat_g'        => round( (float) ( $parsed['fat_g'] ?? 0 ), 2 ),
			'fiber_g'      => round( (float) ( $parsed['fiber_g'] ?? 0 ), 2 ),
			'sugar_g'      => round( (float) ( $parsed['sugar_g'] ?? 0 ), 2 ),
			'sodium_mg'    => round( (float) ( $parsed['sodium_mg'] ?? 0 ), 2 ),
			'micros'       => self::normalise_micros( $parsed['micros'] ?? [] ),
			'confidence'   => max( 0, min( 1, (float) ( $parsed['confidence'] ?? 0 ) ) ),
			'notes'        => sanitize_textarea_field( (string) ( $parsed['notes'] ?? '' ) ),
		];
	}

	private static function normalise_pantry_analysis( array $parsed ): array {
		$items = [];
		foreach ( (array) ( $parsed['items'] ?? [] ) as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$item_name = sanitize_text_field( (string) ( $item['item_name'] ?? $item['name'] ?? '' ) );
			if ( '' === $item_name ) {
				continue;
			}

			$quantity = null;
			if ( isset( $item['quantity'] ) && '' !== (string) $item['quantity'] ) {
				$quantity = (float) $item['quantity'];
			}

			$items[] = [
				'item_name' => $item_name,
				'quantity'  => null !== $quantity ? round( $quantity, 2 ) : null,
				'unit'      => sanitize_text_field( (string) ( $item['unit'] ?? '' ) ),
				'notes'     => sanitize_text_field( (string) ( $item['notes'] ?? '' ) ),
			];
		}

		return [
			'items' => $items,
			'notes' => sanitize_textarea_field( (string) ( $parsed['notes'] ?? '' ) ),
		];
	}

	private static function normalise_micros( $micros ): array {
		$normalised = [];
		foreach ( (array) $micros as $micro ) {
			if ( ! is_array( $micro ) ) {
				continue;
			}

			$key = sanitize_key( (string) ( $micro['key'] ?? $micro['label'] ?? '' ) );
			$label = sanitize_text_field( (string) ( $micro['label'] ?? $micro['key'] ?? '' ) );
			$amount = isset( $micro['amount'] ) ? (float) $micro['amount'] : null;
			$unit = sanitize_text_field( (string) ( $micro['unit'] ?? '' ) );

			if ( '' === $key || '' === $label || null === $amount ) {
				continue;
			}

			$normalised[] = [
				'key'    => $key,
				'label'  => $label,
				'amount' => round( $amount, 2 ),
				'unit'   => $unit,
			];
		}

		return $normalised;
	}

	private static function normalise_meal_analysis( array $parsed ): array {
		$items = [];
		foreach ( (array) ( $parsed['items'] ?? [] ) as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$items[] = [
				'food_name'      => sanitize_text_field( (string) ( $item['food_name'] ?? $item['name'] ?? 'Food item' ) ),
				'serving_amount' => max( 0.1, (float) ( $item['serving_amount'] ?? 1 ) ),
				'serving_unit'   => sanitize_text_field( (string) ( $item['serving_unit'] ?? $item['serving_size'] ?? 'serving' ) ),
				'calories'       => (int) round( (float) ( $item['calories'] ?? 0 ) ),
				'protein_g'      => round( (float) ( $item['protein_g'] ?? 0 ), 2 ),
				'carbs_g'        => round( (float) ( $item['carbs_g'] ?? 0 ), 2 ),
				'fat_g'          => round( (float) ( $item['fat_g'] ?? 0 ), 2 ),
			];
		}

		return [
			'meal_name'        => sanitize_text_field( (string) ( $parsed['meal_name'] ?? '' ) ),
			'items'            => $items,
			'total_calories'   => (int) round( (float) ( $parsed['total_calories'] ?? 0 ) ),
			'total_protein_g'  => round( (float) ( $parsed['total_protein_g'] ?? 0 ), 2 ),
			'total_carbs_g'    => round( (float) ( $parsed['total_carbs_g'] ?? 0 ), 2 ),
			'total_fat_g'      => round( (float) ( $parsed['total_fat_g'] ?? 0 ), 2 ),
			'confidence'       => max( 0, min( 1, (float) ( $parsed['confidence'] ?? 0 ) ) ),
		];
	}

	private static function normalise_exercise_library_item( array $exercise, string $fallback_name = '' ): array {
		$allowed_difficulty = [ 'beginner', 'intermediate', 'advanced' ];
		$allowed_progression = [ 'double_progression', 'load_progression', 'top_set_backoff' ];
		$allowed_day_types = [ 'push', 'pull', 'legs', 'arms_shoulders', 'cardio', 'rest' ];
		$allowed_slot_types = [ 'main', 'secondary', 'shoulders', 'accessory', 'abs', 'challenge' ];

		$difficulty = sanitize_key( (string) ( $exercise['difficulty'] ?? 'beginner' ) );
		if ( ! in_array( $difficulty, $allowed_difficulty, true ) ) {
			$difficulty = 'beginner';
		}

		$progression = sanitize_key( (string) ( $exercise['default_progression_type'] ?? 'double_progression' ) );
		if ( ! in_array( $progression, $allowed_progression, true ) ) {
			$progression = 'double_progression';
		}

		$day_types = array_values( array_filter( array_map(
			static function( $value ) use ( $allowed_day_types ): string {
				$key = sanitize_key( (string) $value );
				return in_array( $key, $allowed_day_types, true ) ? $key : '';
			},
			(array) ( $exercise['day_types'] ?? [] )
		) ) );

		$slot_types = array_values( array_filter( array_map(
			static function( $value ) use ( $allowed_slot_types ): string {
				$key = sanitize_key( (string) $value );
				return in_array( $key, $allowed_slot_types, true ) ? $key : '';
			},
			(array) ( $exercise['slot_types'] ?? [] )
		) ) );

		return [
			'name'                     => sanitize_text_field( (string) ( $exercise['name'] ?? $fallback_name ) ),
			'description'              => sanitize_textarea_field( (string) ( $exercise['description'] ?? '' ) ),
			'movement_pattern'         => sanitize_text_field( (string) ( $exercise['movement_pattern'] ?? '' ) ),
			'primary_muscle'           => sanitize_text_field( (string) ( $exercise['primary_muscle'] ?? '' ) ),
			'secondary_muscles'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $exercise['secondary_muscles'] ?? [] ) ) ) ),
			'equipment'                => sanitize_text_field( (string) ( $exercise['equipment'] ?? 'other' ) ),
			'difficulty'               => $difficulty,
			'age_friendliness_score'   => max( 1, min( 10, (int) ( $exercise['age_friendliness_score'] ?? 5 ) ) ),
			'joint_stress_score'       => max( 1, min( 10, (int) ( $exercise['joint_stress_score'] ?? 3 ) ) ),
			'spinal_load_score'        => max( 1, min( 10, (int) ( $exercise['spinal_load_score'] ?? 3 ) ) ),
			'default_rep_min'          => max( 1, (int) ( $exercise['default_rep_min'] ?? 8 ) ),
			'default_rep_max'          => max( 1, (int) ( $exercise['default_rep_max'] ?? 12 ) ),
			'default_sets'             => max( 1, (int) ( $exercise['default_sets'] ?? 3 ) ),
			'default_progression_type' => $progression,
			'coaching_cues'            => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $exercise['coaching_cues'] ?? [] ) ) ) ),
			'day_types'                => $day_types,
			'slot_types'               => $slot_types ?: [ 'accessory' ],
		];
	}

	private static function build_fallback_exercise_description( array $exercise ): string {
		$movement  = trim( str_replace( '_', ' ', (string) ( $exercise['movement_pattern'] ?? '' ) ) );
		$primary   = trim( str_replace( '_', ' ', (string) ( $exercise['primary_muscle'] ?? '' ) ) );
		$secondary = array_values( array_filter( array_map(
			static fn( $item ): string => trim( str_replace( '_', ' ', (string) $item ) ),
			(array) ( $exercise['secondary_muscles'] ?? [] )
		) ) );
		$equipment = trim( str_replace( '_', ' ', (string) ( $exercise['equipment'] ?? '' ) ) );

		$parts = [];
		if ( '' !== $movement && '' !== $primary ) {
			$parts[] = sprintf( 'A %s exercise focused on %s.', strtolower( $movement ), strtolower( $primary ) );
		} elseif ( '' !== $primary ) {
			$parts[] = sprintf( 'An exercise used to train %s.', strtolower( $primary ) );
		} else {
			$parts[] = 'A repeatable gym exercise that fits a structured training plan.';
		}

		if ( ! empty( $secondary ) ) {
			$parts[] = 'It also challenges ' . strtolower( implode( ', ', array_slice( $secondary, 0, 3 ) ) ) . '.';
		}

		if ( '' !== $equipment && 'other' !== strtolower( $equipment ) ) {
			$parts[] = 'Typically performed with ' . strtolower( $equipment ) . '.';
		}

		return sanitize_textarea_field( implode( ' ', $parts ) );
	}
}
