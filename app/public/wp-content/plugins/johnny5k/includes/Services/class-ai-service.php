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
	public static function chat( int $user_id, string $thread_key, string $user_message, string $mode = 'general' ) {
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
			'content' => self::build_system_prompt( $user_id, $mode ),
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
				'function_tools'=> self::get_chat_function_tools(),
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

		// ── Persist assistant reply (plain text only) ─────────────────────────
		$wpdb->insert( $p . 'fit_ai_messages', [
			'thread_id'    => $thread_id,
			'role'         => 'assistant',
			'message_text' => $reply,
		] );

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
		$tool_note = "\n\nYou may use Johnny5k backend tools to read live user data and perform supported actions. When the user clearly asks you to log steps, log food, or create a training plan, do it with the available tools instead of only describing what they should do. If a required detail is missing, ask one short follow-up question. Never claim an action succeeded unless a tool confirmed it. When the user says today, yesterday, tomorrow, tonight, or last night, resolve that against the current local date and time above. Do not invent a calendar date for relative time references. If the user did not provide a literal YYYY-MM-DD date, omit the date argument and let the backend resolve it from the user's local date.";

		$mode_block = '';
		$mode_instr = self::get_mode_instructions( $mode );
		if ( $mode_instr ) {
			$mode_block = "\n\n" . $mode_instr;
		}

		// Brief action-capability note so the model can optionally return structured actions.
		$action_block = "\n\nAction capability: When genuinely useful, you may wrap your response as JSON — {\"reply\":\"...\",\"actions\":[{\"type\":\"action_name\",\"payload\":{}}]} — so the app can take action. Supported types: open_screen (payload: {\"screen\":\"name\"}), show_nutrition_summary, show_grocery_gap, highlight_goal_issue, create_saved_meal_draft (payload: {\"name\":\"meal name\",\"meal_type\":\"lunch\",\"items\":[]}), suggest_recipe_plan, queue_follow_up (payload: {\"prompt\":\"short follow-up prompt\"}). If no action is needed, respond in plain text.";

		return $persona . $ctx_block . $tool_note . $mode_block . $action_block;
	}

	private static function default_persona(): string {
		return <<<PERSONA
You are Johnny 5000, the user's embedded fitness coach inside the Johnny5k app.

You are direct, calm, warm, observant, and grounded. You do not sound corporate, generic, or like a chatbot. You speak like a strong, experienced coach who actually knows the user's data and gives a damn.

Behavior rules:
- Notice patterns and name them clearly.
- Use the user's current data whenever it helps.
- Give one useful next step early in your response.
- Avoid generic motivational fluff — skip "great job" filler unless it means something.
- Be honest when the user is off track, but never demeaning.
- Stay concise unless the user asks for detail.
- Vary your sentence openings and rhythm.
- Sound like a real person, not a feature.
- If you do not know something, say so plainly.
- If asked whether you are an AI, be honest and matter-of-fact about it.
PERSONA;
	}

	private static function behavioral_rules(): string {
		return <<<RULES
Behavior rules (always apply):
- Notice patterns and name them clearly.
- Use the user's current data whenever it helps.
- Give one useful next step early.
- Avoid generic motivational fluff.
- Be honest when the user is off track, but never demeaning.
- Stay concise unless detail is requested.
- Vary sentence openings and rhythm.
- Sound like a real person, not a feature.
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
				return 'Mode: Nutrition coaching. Be practical and macro-aware. Focus on food swaps, meal timing, and hitting macro targets. Give specific, actionable food suggestions tied to the user\'s current numbers.';
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
				'description' => 'Get today’s logged nutrition totals and meal count.',
				'parameters'  => [ 'type' => 'object', 'properties' => $empty_object, 'additionalProperties' => false ],
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
				'description' => 'Log food or a meal from a short natural-language description when the user asks Johnny to log what they ate.',
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
		];
	}

	private static function get_chat_function_tools(): array {
		$tools = [];
		foreach ( self::tool_registry() as $name => $tool ) {
			if ( empty( $tool['enabled'] ) ) {
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

	private static function execute_chat_tool( int $user_id, string $tool_name, array $arguments = [], string $user_message = '' ): array {
		$arguments = self::normalise_tool_arguments_from_user_message( $user_id, $tool_name, $arguments, $user_message );

		return match ( $tool_name ) {
			'get_profile_summary'   => self::tool_profile_summary( $user_id ),
			'get_daily_targets'     => self::tool_daily_targets( $user_id ),
			'get_today_nutrition'   => self::tool_today_nutrition( $user_id ),
			'get_recovery_snapshot' => self::tool_recovery_snapshot( $user_id ),
			'get_current_workout'   => self::tool_current_workout( $user_id ),
			'log_steps'             => self::tool_log_steps( $user_id, $arguments ),
			'log_food_from_description' => self::tool_log_food_from_description( $user_id, $arguments ),
			'create_training_plan'  => self::tool_create_training_plan( $user_id, $arguments ),
			'log_sleep'             => self::tool_log_sleep( $user_id, $arguments ),
			'add_pantry_items'      => self::tool_add_pantry_items( $user_id, $arguments ),
			'add_grocery_gap_items' => self::tool_add_grocery_gap_items( $user_id, $arguments ),
			'swap_workout_exercise' => self::tool_swap_workout_exercise( $user_id, $arguments ),
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

		if ( in_array( $tool_name, [ 'log_steps', 'log_sleep' ], true ) ) {
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
		global $wpdb;
		$p = $wpdb->prefix;
		$today = UserTime::today( $user_id );

		$totals = $wpdb->get_row( $wpdb->prepare(
			"SELECT
				COALESCE(SUM(mi.calories), 0) AS calories,
				COALESCE(SUM(mi.protein_g), 0) AS protein_g,
				COALESCE(SUM(mi.carbs_g), 0) AS carbs_g,
				COALESCE(SUM(mi.fat_g), 0) AS fat_g,
				COUNT(DISTINCT m.id) AS meal_count
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
			$user_id,
			$today
		) );

		return [
			'date'       => $today,
			'calories'   => (int) ( $totals->calories ?? 0 ),
			'protein_g'  => (float) ( $totals->protein_g ?? 0 ),
			'carbs_g'    => (float) ( $totals->carbs_g ?? 0 ),
			'fat_g'      => (float) ( $totals->fat_g ?? 0 ),
			'meal_count' => (int) ( $totals->meal_count ?? 0 ),
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

		$session = is_array( $workout['session'] ?? null ) ? $workout['session'] : [];
		$exercises = is_array( $workout['exercises'] ?? null ) ? $workout['exercises'] : [];

		return [
			'session'      => $session,
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
			}, $exercises ),
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

			return [
				'ok'      => true,
				'action'  => 'log_steps',
				'date'    => $date_logged,
				'date_display' => $date_display,
				'steps'   => (int) ( $data['steps'] ?? $steps ),
				'summary' => sprintf( 'Logged %s steps for %s.', number_format_i18n( (int) ( $data['steps'] ?? $steps ) ), $date_display ),
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

			return [
				'ok'         => true,
				'action'     => 'log_food_from_description',
				'meal_id'    => (int) ( $data['meal_id'] ?? 0 ),
				'meal_type'  => $meal_type,
				'food_name'  => $food_name,
				'calories'   => (int) ( $analysis['calories'] ?? 0 ),
				'protein_g'  => (float) ( $analysis['protein_g'] ?? 0 ),
				'confidence' => (float) ( $analysis['confidence'] ?? 0 ),
				'notes'      => (string) ( $analysis['notes'] ?? '' ),
				'summary'    => sprintf( 'Logged %s to %s.', $food_name, $meal_type ),
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
			return [
				'ok'            => true,
				'action'        => 'log_sleep',
				'id'            => (int) ( $data['id'] ?? 0 ),
				'date'          => $date_logged,
				'date_display'  => $date_display,
				'hours_sleep'   => (float) ( $data['hours_sleep'] ?? $hours_sleep ),
				'sleep_quality' => $sleep_quality,
				'summary'       => sprintf( 'Logged %.1f hours of sleep for %s.', (float) ( $data['hours_sleep'] ?? $hours_sleep ), $date_display ),
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
				'summary'             => sprintf( 'Swapped %s for %s in the current workout.', (string) ( $exercise['exercise_name'] ?? 'that exercise' ), $new_name ),
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

		if ( is_array( $decoded ) && isset( $decoded['reply'] ) ) {
			$reply   = sanitize_textarea_field( (string) $decoded['reply'] );
			$actions = self::sanitize_structured_actions( is_array( $decoded['actions'] ?? null ) ? $decoded['actions'] : [] );
		}

		return [
			'reply'   => '' !== $reply ? $reply : trim( $raw_reply ),
			'actions' => $actions,
		];
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

				return $result;

			default:
				return null;
		}
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
}
