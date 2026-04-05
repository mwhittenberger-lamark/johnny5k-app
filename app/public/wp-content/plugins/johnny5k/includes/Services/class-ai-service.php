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
				'web_search' => $enable_web_search,
			]
		);
		if ( is_wp_error( $result ) ) return $result;

		$raw_reply  = $result['reply'];
		$tokens_in  = $result['tokens_in'];
		$tokens_out = $result['tokens_out'];

		// ── Parse structured actions if model returned JSON ───────────────────
		$reply   = $raw_reply;
		$actions = [];
		$decoded = json_decode( trim( $raw_reply ), true );
		if ( is_array( $decoded ) && isset( $decoded['reply'] ) ) {
			$reply   = (string) $decoded['reply'];
			$actions = is_array( $decoded['actions'] ?? null ) ? $decoded['actions'] : [];
		}

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
	 * (from the admin editor) with real-time user context and optional mode instructions.
	 *
	 * @param int    $user_id
	 * @param string $mode  One of: general, coach, nutrition, workout_review, accountability, planning, education
	 */
	public static function build_system_prompt( int $user_id, string $mode = 'general' ): string {
		$admin_prompt = get_option( 'jf_johnny_system_prompt', '' );

		// Use admin prompt if set; append behavioral rules so they always apply.
		// Fall back to the improved default persona if no admin prompt exists.
		if ( $admin_prompt ) {
			$persona = $admin_prompt . "\n\n" . self::behavioral_rules();
		} else {
			$persona = self::default_persona();
		}

		$context   = self::get_user_context( $user_id );
		$ctx_lines = self::format_context_block( $context );
		$ctx_block = $ctx_lines ? "\n\nUser context:\n" . implode( "\n", $ctx_lines ) : '';

		$mode_block = '';
		$mode_instr = self::get_mode_instructions( $mode );
		if ( $mode_instr ) {
			$mode_block = "\n\n" . $mode_instr;
		}

		// Brief action-capability note so the model can optionally return structured actions.
		$action_block = "\n\nAction capability: When genuinely useful, you may wrap your response as JSON — {\"reply\":\"...\",\"actions\":[{\"type\":\"action_name\",\"payload\":{}}]} — so the app can take action. Supported types: open_screen (payload: {\"screen\":\"name\"}), show_nutrition_summary, show_grocery_gap, highlight_goal_issue. If no action is needed, respond in plain text.";

		return $persona . $ctx_block . $mode_block . $action_block;
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

		if ( isset( $context['pantry_item_count'] ) )      $lines[] = "Pantry items: {$context['pantry_item_count']}";
		if ( isset( $context['saved_meals_count'] ) )      $lines[] = "Saved meals: {$context['saved_meals_count']}";

		if ( ! empty( $context['adherence_summary'] ) )    $lines[] = "Adherence: {$context['adherence_summary']}";
		if ( ! empty( $context['goal_trend_summary'] ) )   $lines[] = "Goal trend: {$context['goal_trend_summary']}";

		return $lines;
	}

	// ── User context helper ───────────────────────────────────────────────────

	/**
	 * Gather live user context for use in system prompts.
	 * Returns profile, goal, latest metrics, and recent behavioral data.
	 *
	 * @return array<string,mixed>
	 */
	private static function get_user_context( int $user_id ): array {
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

		// ── Pantry & saved meals counts ───────────────────────────────────────
		$pantry_count      = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_pantry_items WHERE user_id = %d",
			$user_id
		) );
		$saved_meals_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_saved_meals WHERE user_id = %d",
			$user_id
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

		return [
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
			'pantry_item_count'          => $pantry_count,
			'saved_meals_count'          => $saved_meals_count,
			'adherence_summary'          => $adherence_summary,
			'goal_trend_summary'         => $goal_trend_summary,
		];
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
			if ( in_array( $goal_type, [ 'cut', 'recomp' ], true ) && $cal_delta > 200 ) {
				$issues[] = "calories over target ({$avg_cal} kcal vs {$target_cal} kcal)";
			} elseif ( in_array( $goal_type, [ 'gain' ], true ) && $cal_delta < -200 ) {
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

		// Require at least 4 turns before first summary; refresh every 5 turns.
		if ( $assistant_count < 4 || $assistant_count % 5 !== 0 ) {
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

		if ( count( $rows ) < 6 ) {
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
