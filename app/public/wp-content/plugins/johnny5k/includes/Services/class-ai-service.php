<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

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

	// ── Chat with Johnny 5000 ─────────────────────────────────────────────────

	/**
	 * Send a user message in a thread and return Johnny's reply.
	 *
	 * Persists conversation to wp_fit_ai_messages via the supplied thread_key.
	 *
	 * @param  int    $user_id
	 * @param  string $thread_key  Unique identifier for this conversation thread.
	 * @param  string $user_message
	 * @return array{reply:string, tokens_in:int, tokens_out:int, sources:array<int,array{url:string,title:string}>, used_web_search:bool, model:string}|WP_Error
	 */
	public static function chat( int $user_id, string $thread_key, string $user_message ) {
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
			$thread_id = $wpdb->insert_id;
		} else {
			$thread_id = (int) $thread->id;
		}

		// Load conversation history (last 20 messages to stay within context limits)
		$history = $wpdb->get_results( $wpdb->prepare(
			"SELECT role, message_text FROM {$p}fit_ai_messages
			 WHERE thread_id = %d ORDER BY id ASC",
			$thread_id
		) );

		$messages = [];

		// System prompt (Johnny's personality + user context)
		$messages[] = [
			'role'    => 'system',
			'content' => self::build_system_prompt( $user_id ),
		];

		// History
		foreach ( array_slice( $history, -18 ) as $h ) {
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
				'web_search' => $enable_web_search,
			]
		);
		if ( is_wp_error( $result ) ) return $result;

		$reply      = $result['reply'];
		$tokens_in  = $result['tokens_in'];
		$tokens_out = $result['tokens_out'];

		// ── Persist assistant reply ───────────────────────────────────────────
		$wpdb->insert( $p . 'fit_ai_messages', [
			'thread_id'    => $thread_id,
			'role'         => 'assistant',
			'message_text' => $reply,
		] );

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
			]
		);

		return [
			'reply'           => $reply,
			'tokens_in'       => $tokens_in,
			'tokens_out'      => $tokens_out,
			'sources'         => $result['sources'],
			'used_web_search' => $result['used_web_search'],
			'model'           => $result['model'],
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
				'Extract the serving size, calories, protein, carbs, fat, fiber, sodium from this nutrition label. The user goal is %1$s, calorie target is %2$s, protein target is %3$s. Return only valid JSON with this exact shape: {serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, fit_summary, flags:[string], swap_suggestions:[{title, body}]}. Keep fit_summary to one sentence. Flags should be short lowercase phrases. swap_suggestions should give 1-3 concrete healthier variations or replacement ideas that match the user goal.',
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
					[ 'type' => 'text',       'text'      => $prompt ],
					[ 'type' => 'image_url',  'image_url' => [ 'url' => $image_base64_url ] ],
				],
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o' );
		if ( is_wp_error( $result ) ) return $result;

		CostTracker::log_openai( $user_id, 'gpt-4o', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => $context ] );

		$parsed = json_decode( $result['reply'], true );
		if ( json_last_error() !== JSON_ERROR_NONE ) {
			return new \WP_Error( 'ai_parse_error', 'Could not parse AI nutrition response.' );
		}

		return $parsed;
	}

	/**
	 * Generate a progress photo comparison message.
	 *
	 * @param  int          $user_id
	 * @param  string       $first_photo_url
	 * @param  string       $latest_photo_url
	 * @return string|WP_Error  Encouraging feedback text.
	 */
	public static function analyse_progress_photo( int $user_id, string $first_photo_url, string $latest_photo_url ) {
		$profile = self::get_user_context( $user_id );

		$messages = [
			[
				'role'    => 'system',
				'content' => self::build_system_prompt( $user_id ),
			],
			[
				'role'    => 'user',
				'content' => [
					[ 'type' => 'text', 'text' => "Here are two progress photos of me — the first was taken when I started and the second is the most recent. My goal is {$profile['goal_type']}. Please compare them, acknowledge any visible changes, and give me your honest and motivating assessment. Keep it to 3–4 sentences max." ],
					[ 'type' => 'image_url', 'image_url' => [ 'url' => $first_photo_url  ] ],
					[ 'type' => 'image_url', 'image_url' => [ 'url' => $latest_photo_url ] ],
				],
			],
		];

		$result = self::call_openai( $messages, 'gpt-4o' );
		if ( is_wp_error( $result ) ) return $result;

		CostTracker::log_openai( $user_id, 'gpt-4o', '/v1/responses', $result['tokens_in'], $result['tokens_out'], [ 'context' => 'progress_photo' ] );

		return $result['reply'];
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
	 * (from the admin editor) with real-time user context.
	 */
	public static function build_system_prompt( int $user_id ): string {
		$persona   = get_option( 'jf_johnny_system_prompt', self::default_persona() );
		$context   = self::get_user_context( $user_id );

		$ctx_lines = [];
		if ( ! empty( $context['first_name'] ) )    $ctx_lines[] = "User's name: {$context['first_name']}";
		if ( ! empty( $context['goal_type'] ) )      $ctx_lines[] = "Current goal: {$context['goal_type']}";
		if ( ! empty( $context['experience'] ) )     $ctx_lines[] = "Training experience: {$context['experience']}";
		if ( ! empty( $context['target_calories'] ) ) $ctx_lines[] = "Daily calorie target: {$context['target_calories']} kcal";
		if ( ! empty( $context['target_protein_g'] ) ) $ctx_lines[] = "Protein target: {$context['target_protein_g']} g";
		if ( ! empty( $context['latest_weight_lb'] ) ) $ctx_lines[] = "Latest logged weight: {$context['latest_weight_lb']} lb";

		$ctx_block = $ctx_lines ? "\n\nUser context:\n" . implode( "\n", $ctx_lines ) : '';

		return $persona . $ctx_block;
	}

	private static function default_persona(): string {
		return <<<PERSONA
You are Johnny 5000 — the user's cool, buff, knowledgeable, and genuinely kind fitness coach and friend. You're built, confident, and real. You speak plainly and don't sugarcoat things, but you're always in the user's corner.

Your tone: direct, warm, occasionally funny. Not corporate. Not overly enthusiastic. Like a big brother who happens to know everything about fitness and nutrition.

If users ask whether you are an AI, be honest and matter-of-fact about it. You're an AI built to be their personal trainer and friend — no shame in that.

Keep responses concise unless detailed guidance is explicitly requested. Always tie advice back to the user's specific goal and current data when available.
PERSONA;
	}

	// ── User context helper ───────────────────────────────────────────────────

	private static function get_user_context( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );
		$latest_weight = $wpdb->get_var( $wpdb->prepare(
			"SELECT weight_lb FROM {$p}fit_body_metrics WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );

		return [
			'first_name'       => $profile->first_name ?? '',
			'goal_type'        => $goal->goal_type ?? '',
			'experience'       => $profile->training_experience ?? '',
			'target_calories'  => $goal->target_calories ?? null,
			'target_protein_g' => $goal->target_protein_g ?? null,
			'latest_weight_lb' => $latest_weight ? (float) $latest_weight : null,
		];
	}

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

	// ── OpenAI HTTP helper ────────────────────────────────────────────────────

	/**
	 * @param  array  $messages  OpenAI messages array.
	 * @param  string $model
	 * @param  array<string,mixed> $options
	 * @return array{reply:string, tokens_in:int, tokens_out:int, sources:array<int,array{url:string,title:string}>, used_web_search:bool, model:string}|WP_Error
	 */
	private static function call_openai( array $messages, string $model = self::DEFAULT_MODEL, array $options = [] ) {
		$api_key = get_option( 'jf_openai_api_key', '' );
		if ( ! $api_key ) {
			return new \WP_Error( 'no_api_key', 'OpenAI API key not configured.' );
		}

		$payload = [
			'model'    => $model,
			'input'    => $messages,
		];
		if ( ! empty( $options['web_search'] ) ) {
			$payload['tools']       = [ [ 'type' => 'web_search' ] ];
			$payload['tool_choice'] = 'auto';
		}

		$payload = wp_json_encode( $payload );

		$response = wp_remote_post(
			self::RESPONSES_ENDPOINT,
			[
				'headers' => [
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $api_key,
				],
				'body'    => $payload,
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

		// Responses API: output is an array of output items
		$reply           = '';
		$sources         = [];
		$used_web_search = false;
		foreach ( $body['output'] as $item ) {
			if ( ( $item['type'] ?? '' ) === 'web_search_call' ) {
				$used_web_search = true;
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

		$tokens_in  = (int) ( $body['usage']['input_tokens']  ?? 0 );
		$tokens_out = (int) ( $body['usage']['output_tokens'] ?? 0 );

		return [
			'reply'           => $reply,
			'tokens_in'       => $tokens_in,
			'tokens_out'      => $tokens_out,
			'sources'         => array_values( $sources ),
			'used_web_search' => $used_web_search,
			'model'           => $model,
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
}
