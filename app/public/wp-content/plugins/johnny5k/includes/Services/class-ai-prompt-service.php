<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class AiPromptService {

	/**
	 * Build the system prompt from persona, user context, and mode instructions.
	 *
	 * @param array<string,mixed> $context
	 * @param array<string,mixed> $context_overrides
	 */
	public static function build_system_prompt( array $context, string $memory_block, string $follow_up_block, string $mode = 'general', array $context_overrides = [] ): string {
		$admin_prompt = get_option( 'jf_johnny_system_prompt', '' );
		$support_block = SupportGuideService::build_prompt_block( (string) ( $context_overrides['latest_user_message'] ?? '' ), $context_overrides );

		if ( $admin_prompt ) {
			$persona = $admin_prompt . "\n\n" . self::behavioral_rules();
		} else {
			$persona = self::default_persona();
		}

		$ctx_lines   = self::format_context_block( $context );
		$ctx_block   = $ctx_lines ? "\n\nUser context:\n" . implode( "\n", $ctx_lines ) : '';
		$tool_note   = "\n\nYou may use Johnny5k backend tools to read live user data and perform supported actions. Before answering about meal count, what the user ate for dinner, exact serving amounts or units, pantry inventory, available recipes, exact workout reps or sets, or whether today's workout already happened, read the live data with the relevant tools instead of guessing from memory. When the user clearly asks you to log steps, log food, update pantry, adjust a workout, add an exercise to their custom exercise library, create a training plan, or schedule a text reminder, do it with the available tools instead of only describing what they should do. If a required detail is missing or the request is materially ambiguous, ask one short follow-up question instead of guessing. Never claim an action succeeded unless a tool confirmed it. Never create or edit a workout plan when the user is asking about meals, recipes, pantry, groceries, or macros. When the user says today, yesterday, tomorrow, tonight, or last night, resolve that against the current local date and time above. Do not invent a calendar date for relative time references. If the user did not provide a literal YYYY-MM-DD date, omit the date argument and let the backend resolve it from the user's local date. If you estimate food or recovery details, say plainly that it is an estimate and tell the user what detail would make it more accurate.";
		$format_note = "\n\nResponse format rules: default to one short paragraph or two short paragraphs. Do not use markdown headings. Do not produce canned sections like \"Next steps:\" or label-heavy templates like \"Calorie Target:\" unless the user explicitly asks for a breakdown. Do not pad with generic advice like \"track each meal\" or \"consider a workout\" unless it is specifically grounded in the user's current data. Prefer one concrete next move over a five-point plan. Do not end with an upsell question like \"Would you like recipe suggestions?\" unless the user asked for recipes, meal ideas, or options.";
		$mode_block  = '';
		$mode_instr  = self::get_mode_instructions( $mode, $context_overrides );

		if ( $mode_instr ) {
			$mode_block = "\n\n" . $mode_instr;
		}

		$action_block = "\n\nAction capability: When genuinely useful, you may wrap your response as JSON — {\"reply\":\"...\",\"why\":\"short reason grounded in the user's data\",\"confidence\":\"high|medium|low\",\"context_used\":[\"brief context bullet\"],\"actions\":[{\"type\":\"action_name\",\"payload\":{}}]} — so the app can take action and show your reasoning. Supported types: open_screen (payload may include {\"screen\":\"name\",\"route_path\":\"/nutrition\",\"focus_section\":\"savedMeals\",\"focus_tab\":\"sleep\",\"guide_id\":\"save-meal\",\"action_label\":\"Open saved meals\",\"notice\":\"...\",\"starter_prompt\":\"...\",\"meal_type\":\"dinner\"}), open_exercise_demo (payload: {\"exercise_name\":\"exercise\",\"query\":\"youtube search terms\"}), show_nutrition_summary, show_grocery_gap, highlight_goal_issue, create_saved_meal_draft (payload: {\"name\":\"meal name\",\"meal_type\":\"lunch\",\"items\":[]}), suggest_recipe_plan, queue_follow_up (payload: {\"prompt\":\"short follow-up prompt\",\"reason\":\"why ask later\",\"due_at\":\"YYYY-MM-DD HH:MM\",\"next_step\":\"what to do\",\"starter_prompt\":\"prompt to run later\"}), run_workflow (payload: {\"workflow\":\"fix_macros\",\"title\":\"short title\",\"summary\":\"why this workflow helps\",\"steps\":[\"step one\"],\"screen\":\"nutrition\",\"meal_type\":\"dinner\",\"starter_prompt\":\"prompt to kick it off\"}). If no action is needed, respond in plain text.";

		return $persona . $ctx_block . $memory_block . $follow_up_block . $support_block . $tool_note . $format_note . $mode_block . $action_block;
	}

	/**
	 * Default admin-editable persona fields.
	 *
	 * @return array{name:string,tagline:string,tone:string,rules:string,extra:string}
	 */
	public static function admin_persona_defaults(): array {
		return [
			'name'    => 'Johnny5k',
			'tagline' => 'The user\'s embedded fitness coach inside Johnny5k.',
			'tone'    => 'direct, calm, warm, observant, grounded',
			'rules'   => '',
			'extra'   => '',
		];
	}

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
	 * @param array<string,mixed> $context
	 * @return string[]
	 */
	public static function format_context_block( array $context ): array {
		$lines = [];

		if ( ! empty( $context['first_name'] ) ) {
			$lines[] = "Name: {$context['first_name']}";
		}
		if ( ! empty( $context['goal_type'] ) ) {
			$lines[] = "Goal: {$context['goal_type']}";
		}
		if ( ! empty( $context['experience'] ) ) {
			$lines[] = "Training experience: {$context['experience']}";
		}
		if ( ! empty( $context['target_calories'] ) ) {
			$lines[] = "Daily calorie target: {$context['target_calories']} kcal";
		}
		if ( ! empty( $context['target_protein_g'] ) ) {
			$lines[] = "Protein target: {$context['target_protein_g']} g";
		}
		if ( ! empty( $context['latest_weight_lb'] ) ) {
			$lines[] = "Latest weight: {$context['latest_weight_lb']} lb";
		}

		if ( isset( $context['weight_change_last_14_days'] ) && null !== $context['weight_change_last_14_days'] ) {
			$sign    = $context['weight_change_last_14_days'] >= 0 ? '+' : '';
			$lines[] = "Weight trend (14 days): {$sign}{$context['weight_change_last_14_days']} lb";
		}

		if ( isset( $context['workouts_last_7_days'] ) ) {
			$lines[] = "Workouts last 7 days: {$context['workouts_last_7_days']}";
		}

		if ( isset( $context['days_since_last_workout'] ) ) {
			$dsw     = $context['days_since_last_workout'];
			$lines[] = null === $dsw ? 'Last workout: no workouts on record' : "Days since last workout: {$dsw}";
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
		if ( ! empty( $context['latest_meal_item_summary'] ) ) {
			$lines[] = "Latest meal detail: {$context['latest_meal_item_summary']}";
		}
		if ( ! empty( $context['latest_workout_set_summary'] ) ) {
			$lines[] = "Latest workout detail: {$context['latest_workout_set_summary']}";
		}

		if ( isset( $context['pantry_item_count'] ) ) {
			$lines[] = "Pantry items: {$context['pantry_item_count']}";
		}
		if ( isset( $context['saved_meals_count'] ) ) {
			$lines[] = "Saved meals: {$context['saved_meals_count']}";
		}
		if ( isset( $context['saved_meal_logs_last_30_days'] ) ) {
			$lines[] = "Saved-meal uses (last 30 days): {$context['saved_meal_logs_last_30_days']}";
		}

		if ( ! empty( $context['top_saved_meal_name'] ) && isset( $context['top_saved_meal_uses_last_30_days'] ) ) {
			$lines[] = "Most-used saved meal (30 days): {$context['top_saved_meal_name']} ({$context['top_saved_meal_uses_last_30_days']} logs)";
		}

		if ( ! empty( $context['adherence_summary'] ) ) {
			$lines[] = "Adherence: {$context['adherence_summary']}";
		}
		if ( ! empty( $context['goal_trend_summary'] ) ) {
			$lines[] = "Goal trend: {$context['goal_trend_summary']}";
		}
		if ( isset( $context['follow_up_pending_count'] ) ) {
			$lines[] = "Pending Johnny follow-ups: {$context['follow_up_pending_count']}";
		}
		if ( isset( $context['follow_up_overdue_count'] ) ) {
			$lines[] = "Overdue Johnny follow-ups: {$context['follow_up_overdue_count']}";
		}
		if ( isset( $context['follow_up_missed_count'] ) ) {
			$lines[] = "Missed Johnny follow-ups: {$context['follow_up_missed_count']}";
		}
		if ( isset( $context['follow_up_completed_last_14_days'] ) ) {
			$lines[] = "Completed Johnny follow-ups (14 days): {$context['follow_up_completed_last_14_days']}";
		}
		if ( isset( $context['follow_up_dismissed_last_14_days'] ) ) {
			$lines[] = "Dismissed Johnny follow-ups (14 days): {$context['follow_up_dismissed_last_14_days']}";
		}
		if ( ! empty( $context['follow_up_recent_summary'] ) ) {
			$lines[] = "Recent Johnny follow-up outcomes: {$context['follow_up_recent_summary']}";
		}

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

	private static function default_persona(): string {
		return <<<PERSONA
You are Johnny5k, the user's embedded fitness coach inside the Johnny5k app.

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

	private static function get_mode_instructions( string $mode, array $context_overrides = [] ): string {
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
			case 'live_workout':
				return self::get_live_workout_mode_instructions( $context_overrides );
			case 'coach':
				return 'Mode: Coaching session. Act as a focused personal trainer. Ask a clarifying question if something is unclear. Hold the user accountable to their stated goals.';
			default:
				return '';
		}
	}

	private static function get_live_workout_mode_instructions( array $context_overrides = [] ): string {
		$event_type       = sanitize_key( (string) ( $context_overrides['event_type'] ?? '' ) );
		$current_exercise = sanitize_text_field( (string) ( $context_overrides['active_exercise'] ?? '' ) );
		$current_set      = max( 0, (int) ( $context_overrides['current_set_number'] ?? 0 ) );
		$rest_seconds     = max( 0, (int) ( $context_overrides['last_rest_seconds'] ?? 0 ) );
		$rep_target       = sanitize_text_field( (string) ( $context_overrides['active_target_reps'] ?? '' ) );

		$base = 'Mode: Live workout coaching. You are inside an active training session with the user right now. Respond like a coach in the room, not like a general advice chat. Keep replies to 1 or 2 short sentences unless the user explicitly asks for more. Every reply should either give a useful cue, a pacing instruction, a progression note, a recovery reminder, or a brief shot of encouragement grounded in the current workout state. You can give form and setup cues, but you cannot see the user, so never claim to have visually confirmed technique or say things like "great form," "that looked clean," or similar visual judgments unless the user explicitly reported that themselves. Never give broad lifestyle advice here unless the user explicitly asks for it. Do not restate the entire session context back to the user. Treat timing as real: between sets aim to keep rest around 30 to 60 seconds; between exercises aim to keep transitions around 2 to 3 minutes unless safety or a heavy compound lift clearly justifies longer.';

		$event_instruction = match ( $event_type ) {
			'set_saved' => 'The user just saved a set. Comment on the logged performance directly. If reps, load, or RiR suggest they are overshooting or sandbagging, say it plainly and give one adjustment for the next set.',
			'set_changed' => 'The user changed sets without logging yet. Give a fast cue about what to focus on for the upcoming set.',
			'exercise_changed' => 'The user changed exercises. Re-orient them quickly to the new movement and setup. If transition time is dragging, tell them to get moving.',
			'user_question' => 'The user asked a direct question mid-session. Answer clearly and briefly. If they ask about how to perform or demo the movement, prefer returning an open_exercise_demo action tied to the current exercise.',
			'session_opened' => 'The user just entered live workout mode. Set the tone, make it feel live, and point them at the next immediate move.',
			default => 'Treat this as a live workout state update and give the most useful next cue for the exact moment.',
		};

		$demo_instruction = 'When the user asks to see how to do the movement, asks for a demo, asks about form for the current lift, or asks how an exercise should look, return a structured open_exercise_demo action using the current exercise name and a YouTube-ready query. Keep the reply short and let the action do the navigation.';

		$detail_bits = array_filter( [
			'' !== $current_exercise ? sprintf( 'Current exercise: %s.', $current_exercise ) : '',
			$current_set > 0 ? sprintf( 'Current set: %d.', $current_set ) : '',
			'' !== $rep_target ? sprintf( 'Target reps: %s.', $rep_target ) : '',
			$rest_seconds > 0 ? sprintf( 'Rest elapsed: %d seconds.', $rest_seconds ) : '',
		] );

		return trim( implode( ' ', array_filter( [
			$base,
			$event_instruction,
			$demo_instruction,
			implode( ' ', $detail_bits ),
		] ) ) );
	}
}
