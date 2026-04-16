<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestNarrativeService {
	private const STORY_META_PREFIX = 'johnny5k_ironquest_story_run_';

	private const TENSION_STATES = [
		'controlled',
		'rising',
		'high',
		'critical',
	];

	public static function get_mission_context( string $location_slug, string $mission_slug ): array {
		$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		$mission  = [];

		foreach ( IronQuestRegistryService::get_location_missions( $location_slug ) as $candidate ) {
			if ( ( $candidate['slug'] ?? '' ) === sanitize_key( $mission_slug ) ) {
				$mission = $candidate;
				break;
			}
		}

		return [
			'location' => $location,
			'mission'  => $mission,
			'ai_anchor' => (array) ( $location['ai_prompt_anchor'] ?? [] ),
		];
	}

	public static function build_rest_context(
		int $user_id,
		string $location_slug,
		string $mission_slug,
		string $exercise_name = '',
		int $set_number = 0,
		string $result_band = '',
		string $readiness_band = ''
	): array {
		$profile = IronQuestProfileService::ensure_profile( $user_id );
		$context = self::get_mission_context( $location_slug, $mission_slug );

		return [
			'user_id'        => $user_id,
			'class_slug'     => (string) ( $profile['class_slug'] ?? '' ),
			'location_slug'  => sanitize_key( $location_slug ),
			'mission_slug'   => sanitize_key( $mission_slug ),
			'exercise_name'  => sanitize_text_field( $exercise_name ),
			'set_number'     => max( 0, $set_number ),
			'result_band'    => sanitize_key( $result_band ),
			'readiness_band' => sanitize_key( $readiness_band ),
			'location_name'  => (string) ( $context['location']['name'] ?? '' ),
			'mission_name'   => (string) ( $context['mission']['name'] ?? '' ),
			'ai_anchor'      => (array) ( $context['ai_anchor'] ?? [] ),
		];
	}

	public static function get_or_create_story_state( int $user_id, array $run ): array {
		$run_id = (int) ( $run['id'] ?? 0 );
		if ( $run_id <= 0 ) {
			return [];
		}

		$stored = get_user_meta( $user_id, self::story_meta_key( $run_id ), true );
		if ( is_array( $stored ) && ! empty( $stored ) ) {
			return self::normalize_story_state( $stored, $user_id, $run );
		}

		$state = self::build_initial_story_state( $user_id, $run );
		self::persist_story_state( $user_id, $run_id, $state );

		return $state;
	}

	public static function choose_opening_action( int $user_id, array $run, string $choice_id = '', string $stance = 'steady' ): array {
		$state       = self::get_or_create_story_state( $user_id, $run );
		$mission_ctx = self::get_mission_context( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) );
		$location    = (array) ( $mission_ctx['location'] ?? [] );
		$mission     = (array) ( $mission_ctx['mission'] ?? [] );
		$profile     = IronQuestProfileService::ensure_profile( $user_id );
		$choice = self::find_story_choice( $state, $choice_id );
		if ( empty( $choice ) ) {
			$choice = self::find_story_choice( $state, (string) ( $state['default_choice_id'] ?? '' ) );
		}
		if ( empty( $choice ) ) {
			$choices = (array) ( $state['choices'] ?? [] );
			$choice  = $choices[1] ?? $choices[0] ?? [];
		}

		$normalized_stance = self::normalize_stance( $stance );
		$roll              = self::build_story_roll( $choice, $normalized_stance, $state );
		$ai_outcome        = IronQuestAiNarrativeService::build_choice_outcome( $user_id, $profile, $location, $mission, $state, $choice, $roll );
		$outcome_text      = '' !== (string) ( $ai_outcome['outcome_text'] ?? '' )
			? (string) $ai_outcome['outcome_text']
			: self::build_choice_outcome_text( $state, $choice, $roll );
		$transcript        = self::append_transcript(
			(array) ( $state['transcript'] ?? [] ),
			[
				'kind'       => 'opening_choice',
				'title'      => 'Opening move',
				'text'       => $outcome_text,
				'choice_id'  => (string) ( $choice['id'] ?? '' ),
				'choice'     => (string) ( $choice['label'] ?? '' ),
				'roll_band'  => (string) ( $roll['roll_band'] ?? '' ),
			],
		);

		$state['phase']           = 'encounter';
		$state['encounter_phase'] = 'engaged';
		$state['stance']          = $normalized_stance;
		$state['selected_choice'] = [
			'id'    => (string) ( $choice['id'] ?? '' ),
			'label' => (string) ( $choice['label'] ?? '' ),
			'tone'  => (string) ( $choice['tone'] ?? '' ),
		];
		$state['opening_choice']    = (string) ( $choice['label'] ?? '' );
		$state['roll']              = $roll;
		$state['outcome_text']      = $outcome_text;
		$state['latest_beat']       = $outcome_text;
		$state['current_situation'] = '' !== (string) ( $ai_outcome['current_situation'] ?? '' )
			? (string) $ai_outcome['current_situation']
			: self::build_current_situation( $state, $choice, $roll );
		$state['decision_prompt']   = '' !== (string) ( $ai_outcome['decision_prompt'] ?? '' )
			? (string) $ai_outcome['decision_prompt']
			: 'Press into the encounter and let the next set decide the pace.';
		$state['tension']           = self::resolve_choice_tension( (string) ( $roll['roll_band'] ?? '' ) );
		$state['transcript']        = $transcript;
		$state['progress']          = self::merge_progress_state(
			(array) ( $state['progress'] ?? [] ),
			[
				'percent' => 24,
				'label'   => 'Opening exchange secured',
			],
		);

		self::persist_story_state( $user_id, (int) ( $run['id'] ?? 0 ), $state );

		return $state;
	}

	public static function advance_story_after_set( int $user_id, array $run, array $payload = [] ): array {
		$state       = self::get_or_create_story_state( $user_id, $run );
		$mission_ctx = self::get_mission_context( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) );
		$location    = (array) ( $mission_ctx['location'] ?? [] );
		$mission     = (array) ( $mission_ctx['mission'] ?? [] );
		$profile     = IronQuestProfileService::ensure_profile( $user_id );
		if ( empty( $state['selected_choice']['id'] ) ) {
			$state = self::choose_opening_action( $user_id, $run, '', (string) ( $payload['stance'] ?? 'steady' ) );
		}

		$event_type         = sanitize_key( (string) ( $payload['event_type'] ?? 'set_saved' ) );
		$exercise_name      = sanitize_text_field( (string) ( $payload['exercise_name'] ?? '' ) );
		$set_number         = max( 0, (int) ( $payload['set_number'] ?? 0 ) );
		$sets_total         = max( 0, (int) ( $payload['sets_total'] ?? 0 ) );
		$slot_type          = sanitize_key( (string) ( $payload['slot_type'] ?? '' ) );
		$exercise_order     = max( 1, (int) ( $payload['exercise_order'] ?? ( $state['encounter_index'] ?? 1 ) ) );
		$exercise_count     = max( 0, (int) ( $payload['exercise_count'] ?? 0 ) );
		$rep_target_min     = max( 0, (int) ( $payload['rep_target_min'] ?? 0 ) );
		$rep_target_max     = max( 0, (int) ( $payload['rep_target_max'] ?? 0 ) );
		$reps_completed     = max( 0, (int) ( $payload['reps_completed'] ?? 0 ) );
		$current_rir        = is_numeric( $payload['current_rir'] ?? null ) ? (float) $payload['current_rir'] : null;
		$completed_exercise = ! empty( $payload['completed_exercise'] );
		$has_next_exercise = ! empty( $payload['has_next_exercise'] );
		$next_exercise_name = sanitize_text_field( (string) ( $payload['next_exercise_name'] ?? '' ) );
		$next_slot_type    = sanitize_key( (string) ( $payload['next_slot_type'] ?? '' ) );
		$encounter_type    = self::resolve_encounter_type_for_exercise( $exercise_name, $slot_type, (string) ( $run['run_type'] ?? '' ) );
		$current_context   = (array) ( $state['exercise_context'] ?? [] );
		$set_result        = self::resolve_set_result( $reps_completed, $rep_target_min, $rep_target_max, $completed_exercise, $current_rir, $current_context, $exercise_name );
		$beat_context      = self::build_set_beat_context( $current_context, $exercise_name, $set_number, $sets_total, $set_result, $completed_exercise, $reps_completed, $current_rir );
		$fallback_latest_beat = self::build_set_story_text( $state, $exercise_name, $set_number, $sets_total, $set_result, $event_type, $completed_exercise, $encounter_type, $beat_context );
		$set_beat_bundle   = ! $completed_exercise
			? IronQuestAiNarrativeService::build_set_beat_bundle(
				$user_id,
				$profile,
				$location,
				$mission,
				$state,
				[
					'exercise_name'  => $exercise_name,
					'exercise_order' => $exercise_order,
					'exercise_count' => $exercise_count,
					'set_number'     => $set_number,
					'sets_total'     => $sets_total,
					'set_result'     => $set_result,
					'gear_effects'   => self::resolve_story_effects_for_ai_prompt( $state, $run, $exercise_name, 'gear' ),
					'spell_effects'  => self::resolve_story_effects_for_ai_prompt( $state, $run, $exercise_name, 'spell' ),
					'encounter_type' => $encounter_type,
				],
				$beat_context
			)
			: [];
		$latest_beat       = '' !== (string) ( $set_beat_bundle['latest_beat'] ?? '' )
			? (string) $set_beat_bundle['latest_beat']
			: $fallback_latest_beat;
		$current_percent   = max( 0, (int) ( $state['progress']['percent'] ?? 0 ) );
		$percent_gain      = $completed_exercise ? 34 : ( 'opening' === ( $beat_context['stage'] ?? '' ) ? 14 : 18 );
		$next_percent      = min( 92, $current_percent + $percent_gain );
		$next_tension      = self::advance_tension( (string) ( $state['tension'] ?? 'rising' ), $set_result );
		$next_encounter_index = max( $exercise_order + 1, max( 1, (int) ( $state['encounter_index'] ?? $exercise_order ) ) + 1 );

		$progress = self::merge_progress_state(
			(array) ( $state['progress'] ?? [] ),
			[
				'completed_sets'      => max( 0, (int) ( $state['progress']['completed_sets'] ?? 0 ) ) + 1,
				'completed_exercises' => max( 0, (int) ( $state['progress']['completed_exercises'] ?? 0 ) ) + ( $completed_exercise ? 1 : 0 ),
				'percent'             => $next_percent,
				'label'               => $completed_exercise
					? ( $has_next_exercise && '' !== $next_exercise_name ? sprintf( 'Encounter %d opened', $next_encounter_index ) : 'Encounter line broken' )
					: self::build_progress_label( $set_number, $beat_context, $set_result ),
			],
		);

		$state['phase']           = 'encounter';
		$state['encounter_phase'] = self::resolve_progress_phase( $next_percent );
		$state['tension']         = $next_tension;
		$state['latest_beat']     = $latest_beat;
		$state['encounter_type']  = $encounter_type;
		$state['encounter_index'] = max( 1, (int) ( $state['encounter_index'] ?? $exercise_order ) );
		$state['current_situation'] = $completed_exercise
			? self::build_transition_situation( $state, $exercise_name, $encounter_type )
			: ( '' !== (string) ( $set_beat_bundle['current_situation'] ?? '' )
				? (string) $set_beat_bundle['current_situation']
				: self::build_follow_up_situation( $state, $exercise_name, $set_result, $encounter_type, $beat_context ) );
		$state['decision_prompt'] = ! $completed_exercise && '' !== (string) ( $set_beat_bundle['decision_prompt'] ?? '' )
			? (string) $set_beat_bundle['decision_prompt']
			: 'Press into the encounter and let the next set decide the pace.';
		$state['exercise_context'] = [
			'exercise_name' => $exercise_name,
			'exercise_order'=> $exercise_order,
			'exercise_count'=> $exercise_count,
			'set_number'    => $set_number,
			'sets_total'    => $sets_total,
			'set_result'    => $set_result,
			'reps_completed'=> $reps_completed,
			'rep_target_min'=> $rep_target_min,
			'rep_target_max'=> $rep_target_max,
			'current_rir'   => null === $current_rir ? null : $current_rir,
			'stage'         => (string) ( $beat_context['stage'] ?? '' ),
			'trend'         => (string) ( $beat_context['trend'] ?? '' ),
			'encounter_type'=> $encounter_type,
		];
		$state['progress']  = $progress;
		$state['transcript'] = self::append_transcript(
			(array) ( $state['transcript'] ?? [] ),
			[
				'kind'           => $completed_exercise ? 'exercise_transition' : 'set_story',
				'title'          => $completed_exercise ? 'Encounter shift' : sprintf( 'Set %d', max( 1, $set_number ) ),
				'text'           => $latest_beat,
				'exercise_name'  => $exercise_name,
				'set_number'     => $set_number,
				'sets_total'     => $sets_total,
				'set_result'     => $set_result,
				'encounter_type' => $encounter_type,
			],
		);

		if ( $completed_exercise && $has_next_exercise && '' !== $next_exercise_name ) {
			$next_encounter_type      = self::resolve_encounter_type_for_exercise( $next_exercise_name, $next_slot_type, (string) ( $run['run_type'] ?? '' ) );
			$transition_bundle        = IronQuestAiNarrativeService::build_transition_bundle(
				$user_id,
				$profile,
				$location,
				$mission,
				$state,
				$state['exercise_context'],
				[
					'exercise_name'  => $next_exercise_name,
					'exercise_order' => $next_encounter_index,
					'exercise_count' => $exercise_count,
					'encounter_type' => $next_encounter_type,
				]
			);
			$next_choices             = ! empty( $transition_bundle['choices'] )
				? (array) $transition_bundle['choices']
				: self::build_next_encounter_choices( $state, $next_exercise_name, $next_encounter_type );
			$state['phase']           = 'opening';
			$state['encounter_phase'] = 'intro';
			$state['encounter_type']  = $next_encounter_type;
			$state['encounter_index'] = $next_encounter_index;
			$state['latest_beat']     = '' !== (string) ( $transition_bundle['latest_beat'] ?? '' )
				? (string) $transition_bundle['latest_beat']
				: $latest_beat;
			$state['current_situation'] = '' !== (string) ( $transition_bundle['current_situation'] ?? '' )
				? (string) $transition_bundle['current_situation']
				: self::build_next_encounter_situation( $state, $next_exercise_name, $next_encounter_type, $next_encounter_index, $exercise_count );
			$state['decision_prompt'] = '' !== (string) ( $transition_bundle['decision_prompt'] ?? '' )
				? (string) $transition_bundle['decision_prompt']
				: self::build_next_encounter_prompt( $next_exercise_name, $next_encounter_index, $exercise_count );
			$state['choices']         = $next_choices;
			$state['default_choice_id'] = (string) ( $next_choices[1]['id'] ?? $next_choices[0]['id'] ?? 'steady_approach' );
			$state['selected_choice'] = [];
			$state['opening_choice']  = '';
			$state['roll']            = [];
			$state['outcome_text']    = '';
		}

		self::persist_story_state( $user_id, (int) ( $run['id'] ?? 0 ), $state );

		return $state;
	}

	public static function complete_story( int $user_id, array $run, string $result_band, array $awards = [] ): array {
		$state         = self::get_or_create_story_state( $user_id, $run );
		$result_band   = sanitize_key( $result_band ?: 'victory' );
		$mission_ctx   = self::get_mission_context( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) );
		$location      = (array) ( $mission_ctx['location'] ?? [] );
		$mission       = (array) ( $mission_ctx['mission'] ?? [] );
		$profile       = IronQuestProfileService::ensure_profile( $user_id );
		$outcomes      = (array) ( $mission['outcomes'] ?? [] );
		$authored_summary = sanitize_textarea_field( (string) ( $outcomes[ $result_band ] ?? '' ) );
		if ( '' === $authored_summary ) {
			$ai_conclusion = IronQuestAiNarrativeService::build_conclusion_summary( $user_id, $profile, $location, $mission, $state, $result_band );
			$summary = '' !== (string) ( $ai_conclusion['summary'] ?? '' )
				? (string) $ai_conclusion['summary']
				: self::build_fallback_conclusion( $state, $mission, $result_band );
		} else {
			$summary = self::format_authored_conclusion( $authored_summary, $state, $mission, $result_band );
		}

		$xp   = max( 0, (int) ( $awards['xp'] ?? 0 ) );
		$gold = max( 0, (int) ( $awards['gold'] ?? 0 ) );

		$conclusion = [
			'title'   => sprintf( '%s complete', sanitize_text_field( (string) ( $mission['name'] ?? 'Mission' ) ) ),
			'summary' => $summary,
			'epilogue' => self::build_conclusion_epilogue( $state, $result_band, $xp, $gold ),
		];

		$state['phase']           = 'completed';
		$state['encounter_phase'] = 'complete';
		$state['result_band']     = $result_band;
		$state['conclusion']      = $conclusion;
		$state['latest_beat']     = $conclusion['summary'];
		$state['progress']        = self::merge_progress_state( (array) ( $state['progress'] ?? [] ), [ 'percent' => 100, 'label' => 'Mission complete' ] );
		$state['transcript']      = self::append_transcript(
			(array) ( $state['transcript'] ?? [] ),
			[
				'kind'       => 'mission_complete',
				'title'      => 'Mission complete',
				'text'       => trim( $conclusion['summary'] . ' ' . $conclusion['epilogue'] ),
				'result_band'=> $result_band,
			],
		);

		self::persist_story_state( $user_id, (int) ( $run['id'] ?? 0 ), $state );

		return $state;
	}

	private static function build_initial_story_state( int $user_id, array $run ): array {
		$profile     = IronQuestProfileService::ensure_profile( $user_id );
		$mission_ctx = self::get_mission_context( (string) ( $run['location_slug'] ?? '' ), (string) ( $run['mission_slug'] ?? '' ) );
		$location    = (array) ( $mission_ctx['location'] ?? [] );
		$mission     = (array) ( $mission_ctx['mission'] ?? [] );
		$enemy       = self::resolve_enemy_label( $location, $mission );
		$encounter_type = self::resolve_default_encounter_type( (string) ( $run['run_type'] ?? '' ), $mission );
		$opening_bundle = IronQuestAiNarrativeService::build_opening_bundle( $user_id, $run, $profile, $location, $mission, $enemy, $encounter_type );
		$opening     = '' !== (string) ( $opening_bundle['opening_text'] ?? '' )
			? (string) $opening_bundle['opening_text']
			: self::build_opening_text( $location, $mission, $enemy, $encounter_type );
		$choices     = ! empty( $opening_bundle['choices'] )
			? (array) $opening_bundle['choices']
			: self::build_story_choices( $profile, $location, $mission, $enemy, $encounter_type );
		$decision_prompt = '' !== (string) ( $opening_bundle['decision_prompt'] ?? '' )
			? (string) $opening_bundle['decision_prompt']
			: 'What do you do?';
		$current_situation = '' !== (string) ( $opening_bundle['current_situation'] ?? '' )
			? (string) $opening_bundle['current_situation']
			: self::resolve_current_situation( $mission, $enemy, $encounter_type );

		return [
			'run_id'            => (int) ( $run['id'] ?? 0 ),
			'encounter_index'   => 1,
			'phase'             => 'opening',
			'encounter_phase'   => 'intro',
			'stance'            => 'steady',
			'location_name'     => sanitize_text_field( (string) ( $location['name'] ?? '' ) ),
			'mission_name'      => sanitize_text_field( (string) ( $mission['name'] ?? '' ) ),
			'objective'         => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
			'opening_text'      => $opening,
			'decision_prompt'   => $decision_prompt,
			'choices'           => $choices,
			'default_choice_id' => (string) ( $choices[1]['id'] ?? $choices[0]['id'] ?? 'steady_approach' ),
			'current_situation' => $current_situation,
			'enemy'             => $enemy,
			'encounter_type'    => $encounter_type,
			'tension'           => 'rising',
			'roll'              => [],
			'outcome_text'      => '',
			'latest_beat'       => '',
			'opening_choice'    => '',
			'selected_choice'   => [],
			'exercise_context'  => [],
			'progress'          => [
				'completed_sets'      => 0,
				'completed_exercises' => 0,
				'percent'             => 0,
				'label'               => 'Mission opened',
			],
			'transcript'        => [
				[
					'kind'  => 'opening',
					'title' => 'Mission opening',
					'text'  => $opening,
				],
			],
			'conclusion'        => [],
			'result_band'       => '',
			'class_slug'        => sanitize_key( (string) ( $profile['class_slug'] ?? '' ) ),
		];
	}

	private static function build_opening_text( array $location, array $mission, string $enemy, string $encounter_type ): string {
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? 'the region' ) );
		$mission_name  = sanitize_text_field( (string) ( $mission['name'] ?? 'the mission' ) );
		$goal          = sanitize_text_field( (string) ( $mission['goal'] ?? 'hold the line' ) );
		$narrative     = sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) );
		$tone          = sanitize_text_field( (string) ( $location['tone'] ?? '' ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		$lead = sprintf( '%1$s is live now. %2$s is in front of you, and %3$s has taken the shape of a %4$s.', $location_name, $enemy, $mission_name, $encounter_label );
		$middle = '' !== $narrative
			? $narrative
			: sprintf( 'The goal is clear: %s.', strtolower( $goal ) );
		$close = '' !== $tone
			? sprintf( 'The room feels %1$s. Stay measured and use the first sets to %2$s before the %3$s turns against you.', strtolower( $tone ), $encounter_objective, $encounter_label )
			: sprintf( 'Stay measured and use the first sets to %1$s before the %2$s turns against you.', $encounter_objective, $encounter_label );

		return trim( implode( "\n\n", [ $lead, $middle, $close ] ) );
	}

	private static function build_story_choices( array $profile, array $location, array $mission, string $enemy, string $encounter_type ): array {
		$class_label = self::humanize_slug( (string) ( $profile['class_slug'] ?? 'hero' ) );
		$goal        = sanitize_text_field( (string) ( $mission['goal'] ?? 'win the ground' ) );
		$threat      = sanitize_text_field( (string) ( $mission['threat'] ?? $enemy ) );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		return [
			[
				'id'    => 'direct_assault',
				'tone'  => 'aggressive',
				'label' => sprintf( 'Take the initiative and %1$s before %2$s turns into a problem', $encounter_objective, strtolower( $goal ) ),
			],
			[
				'id'    => 'steady_approach',
				'tone'  => 'cautious',
				'label' => sprintf( 'Settle your pace, read the pressure, and find the cleanest way to %1$s through %2$s', $encounter_objective, strtolower( $threat ) ),
			],
			[
				'id'    => 'class_play',
				'tone'  => 'creative',
				'label' => sprintf( 'Use your %1$s instincts, change the angle, and create room to %2$s', strtolower( $class_label ), $encounter_objective ),
			],
		];
	}

	private static function build_story_roll( array $choice, string $stance, array $state ): array {
		$base_roll = random_int( 1, 20 );
		$modifier  = self::stance_roll_modifier( $stance ) + self::choice_roll_modifier( (string) ( $choice['tone'] ?? '' ) ) + self::class_roll_modifier( (string) ( $state['class_slug'] ?? '' ) );
		$final     = $base_roll + $modifier;
		$band      = self::resolve_roll_band( $final );

		return [
			'dice_roll'             => $base_roll,
			'roll_modifiers_total'  => $modifier,
			'roll_final'            => $final,
			'roll_band'             => $band,
		];
	}

	private static function build_choice_outcome_text( array $state, array $choice, array $roll ): string {
		$enemy      = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$choice_txt = sanitize_text_field( (string) ( $choice['label'] ?? 'make your move' ) );
		$band       = sanitize_key( (string) ( $roll['roll_band'] ?? '' ) );
		$encounter_type = (string) ( $state['encounter_type'] ?? 'skirmish' );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		if ( in_array( $band, [ 'dominant_success', 'strong_success' ], true ) ) {
			return sprintf( 'Your opening move works. The %1$s gives a little ground, and %2$s gives you a clean chance to %3$s inside the %4$s.', strtolower( $enemy ), $choice_txt, $encounter_objective, $encounter_label );
		}

		if ( 'moderate_success' === $band || 'low_success' === $band ) {
			return sprintf( 'You get moving first, but the %1$s answers right away. %2$s buys position, not comfort, and you still need to %3$s inside the %4$s.', strtolower( $enemy ), $choice_txt, $encounter_objective, $encounter_label );
		}

		return sprintf( 'You do not get control on the first move. The %1$s gets loud early, and the next sets need to help you %2$s inside the %3$s.', strtolower( $enemy ), $encounter_objective, $encounter_label );
	}

	private static function build_set_story_text( array $state, string $exercise_name, int $set_number, int $sets_total, string $set_result, string $event_type, bool $completed_exercise, string $encounter_type, array $beat_context = [] ): string {
		$enemy        = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$exercise     = '' !== $exercise_name ? $exercise_name : 'the lift';
		$roll_band    = sanitize_key( (string) ( $state['roll']['roll_band'] ?? '' ) );
		$set_label    = $sets_total > 0 ? sprintf( 'set %1$d of %2$d', max( 1, $set_number ), $sets_total ) : sprintf( 'set %d', max( 1, $set_number ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$success_shift = self::encounter_success_phrase( $encounter_type, $exercise );
		$pressure_shift = self::encounter_pressure_phrase( $encounter_type, $exercise );
		$transition_shift = self::encounter_transition_phrase( $encounter_type, $exercise );
		$stage          = sanitize_key( (string) ( $beat_context['stage'] ?? '' ) );
		$trend          = sanitize_key( (string) ( $beat_context['trend'] ?? '' ) );

		if ( $completed_exercise || 'exercise_completed' === $event_type ) {
			if ( in_array( $set_result, [ 'target_met', 'push_set', 'breakthrough', 'surge', 'recovered' ], true ) ) {
				return sprintf( 'You close %1$s well on %2$s. %3$s, the %4$s opens up, and the %5$s has to react.', $exercise, $set_label, self::capitalize_first( $success_shift ), $encounter_label, strtolower( $enemy ) );
			}

			return sprintf( 'You finish %1$s and keep the %2$s moving. %3$s, but the %4$s is not done yet.', $exercise, $encounter_label, self::capitalize_first( $transition_shift ), strtolower( $enemy ) );
		}

		if ( 'opening' === $stage ) {
			if ( in_array( $set_result, [ 'target_met', 'surge', 'breakthrough', 'push_set' ], true ) ) {
				return sprintf( 'The first exchange on %1$s goes your way. %2$s, and the %3$s starts to give you room.', $exercise, self::capitalize_first( $success_shift ), $encounter_label );
			}

			if ( in_array( $set_result, [ 'close_call', 'strain' ], true ) ) {
				return sprintf( 'The first exchange on %1$s is tight. %2$s, and the %3$s is still pressing back.', $exercise, self::capitalize_first( $pressure_shift ), $encounter_label );
			}

			return sprintf( 'The first exchange on %1$s goes against you. %2$s, and the %3$s is asking for a steadier answer.', $exercise, self::capitalize_first( $pressure_shift ), $encounter_label );
		}

		if ( 'recovered' === $set_result ) {
			return sprintf( 'Set %1$d settles the encounter down. %2$s, and the %3$s stops dictating every step.', max( 1, $set_number ), self::capitalize_first( $success_shift ), $encounter_label );
		}

		if ( in_array( $set_result, [ 'surge', 'breakthrough' ], true ) ) {
			return sprintf( 'Set %1$d turns the tempo. %2$s, and the %3$s moves sharply in your favor.', max( 1, $set_number ), self::capitalize_first( $success_shift ), $encounter_label );
		}

		if ( 'slipped' === $set_result ) {
			return sprintf( 'Set %1$d gives some ground back. %2$s, and the %3$s tightens again.', max( 1, $set_number ), self::capitalize_first( $pressure_shift ), $encounter_label );
		}

		if ( in_array( $set_result, [ 'target_met', 'push_set' ], true ) ) {
			if ( 'closing' === $stage ) {
				return sprintf( 'Set %1$d keeps the pressure on late. %2$s, and the %3$s is starting to tilt your way for good.', max( 1, $set_number ), self::capitalize_first( $success_shift ), $encounter_label );
			}

			if ( 'up' === $trend ) {
				return sprintf( 'Set %1$d builds on the last one. %2$s, and the %3$s is losing its footing.', max( 1, $set_number ), self::capitalize_first( $success_shift ), $encounter_label );
			}

			return sprintf( '%1$s goes well on %2$s. %3$s, and the %4$s starts moving your way.', $exercise, $set_label, self::capitalize_first( $success_shift ), $encounter_label );
		}

		if ( in_array( $set_result, [ 'close_call', 'strain' ], true ) ) {
			return sprintf( '%1$s gets done, but barely. %2$s, and the %3$s is still tight.', self::capitalize_first( $set_label ), self::capitalize_first( $pressure_shift ), $encounter_label );
		}

		if ( in_array( $roll_band, [ 'struggle', 'failure' ], true ) ) {
			return sprintf( '%1$s is rough. %2$s, and the %3$s is asking for a cleaner next set.', $exercise, self::capitalize_first( $pressure_shift ), $encounter_label );
		}

		return sprintf( 'You finish %1$s and reset. The %2$s is still there, and %3$s.', $set_label, strtolower( $enemy ), $pressure_shift );
	}

	private static function build_fallback_conclusion( array $state, array $mission, string $result_band ): string {
		$mission_name = sanitize_text_field( (string) ( $mission['name'] ?? 'The mission' ) );
		$enemy        = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$encounter_type = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		if ( 'failure' === $result_band ) {
			return sprintf( '%1$s stays unfinished for now. The %2$s keeps control of the %3$s before you can %4$s, but the route back is still open.', $mission_name, strtolower( $enemy ), $encounter_label, $encounter_objective );
		}

		if ( 'partial' === $result_band ) {
			return sprintf( '%1$s moves your way, but not cleanly. The %2$s gives some ground, and the %3$s opens long enough for you to %4$s.', $mission_name, strtolower( $enemy ), $encounter_label, $encounter_objective );
		}

		return sprintf( '%1$s breaks your way. The %2$s cannot hold the lane, and the %3$s stays with you because you kept finding ways to %4$s.', $mission_name, strtolower( $enemy ), $encounter_label, $encounter_objective );
	}

	private static function format_authored_conclusion( string $summary, array $state, array $mission, string $result_band ): string {
		$encounter_type      = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$encounter_label     = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );
		$enemy               = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$mission_name        = sanitize_text_field( (string) ( $mission['name'] ?? 'Mission' ) );
		$goal                = sanitize_text_field( (string) ( $mission['goal'] ?? '' ) );
		$placeholders_used   = 1 === preg_match( '/\{[a-z_]+\}/', $summary );

		$rendered = strtr(
			$summary,
			[
				'{mission_name}'         => $mission_name,
				'{mission_goal}'         => strtolower( $goal ),
				'{enemy}'                => strtolower( $enemy ),
				'{encounter_label}'      => $encounter_label,
				'{encounter_objective}'  => $encounter_objective,
				'{encounter_proof}'      => self::encounter_epilogue_phrase( $encounter_type ),
				'{result_band}'          => sanitize_key( $result_band ),
			]
		);

		if ( $placeholders_used ) {
			return trim( $rendered );
		}

		return trim( $rendered . ' ' . self::build_authored_conclusion_coda( $encounter_type, $result_band ) );
	}

	private static function build_authored_conclusion_coda( string $encounter_type, string $result_band ): string {
		$encounter_label     = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		if ( 'failure' === sanitize_key( $result_band ) ) {
			return sprintf( 'The %1$s turned before you could %2$s.', $encounter_label, $encounter_objective );
		}

		if ( 'partial' === sanitize_key( $result_band ) ) {
			return sprintf( 'The %1$s bent your way long enough to %2$s, but not long enough to end the threat cleanly.', $encounter_label, $encounter_objective );
		}

		return sprintf( 'The %1$s stayed on your terms because you kept finding ways to %2$s.', $encounter_label, $encounter_objective );
	}

	private static function build_conclusion_epilogue( array $state, string $result_band, int $xp, int $gold ): string {
		$progress_sets = max( 0, (int) ( $state['progress']['completed_sets'] ?? 0 ) );
		$encounter_proof = self::encounter_epilogue_phrase( sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) ) );
		if ( 'failure' === $result_band ) {
			return sprintf( '%1$d completed sets still moved the mission forward. %2$s The payout is modest, but the work still counted.', $progress_sets, $encounter_proof );
		}

		return sprintf( '%1$d completed sets carried the mission through. %2$s The ledger closes with +%3$d XP and +%4$d gold.', $progress_sets, $encounter_proof, $xp, $gold );
	}

	private static function resolve_enemy_label( array $location, array $mission ): string {
		$mission_threat = sanitize_text_field( (string) ( $mission['threat'] ?? '' ) );
		if ( '' !== $mission_threat ) {
			return $mission_threat;
		}

		$enemies = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $location['ai_prompt_anchor']['enemy_types'] ?? [] ) ) ) );
		return $enemies[0] ?? 'the threat';
	}

	private static function resolve_current_situation( array $mission, string $enemy, string $encounter_type ): string {
		$goal = sanitize_text_field( (string) ( $mission['goal'] ?? '' ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );
		if ( '' !== $goal ) {
			return sprintf( 'The %1$s is in front of you and the %2$s is already taking shape. The goal is still %3$s, and the session needs to help you %4$s.', strtolower( $enemy ), $encounter_label, strtolower( $goal ), $encounter_objective );
		}

		return sprintf( 'The %1$s controls the first step, and you need to %2$s before the %3$s locks in.', strtolower( $enemy ), $encounter_objective, $encounter_label );
	}

	private static function build_current_situation( array $state, array $choice, array $roll ): string {
		$enemy = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$band  = sanitize_key( (string) ( $roll['roll_band'] ?? '' ) );
		$encounter_type = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		if ( in_array( $band, [ 'dominant_success', 'strong_success' ], true ) ) {
			return sprintf( 'The %1$s is reacting now. Your opening %2$s gave you some room inside the %3$s, but the next set still needs to help you %4$s.', strtolower( $enemy ), sanitize_text_field( (string) ( $choice['tone'] ?? 'move' ) ), $encounter_label, $encounter_objective );
		}

		if ( 'failure' === $band || 'struggle' === $band ) {
			return sprintf( 'The %1$s got the pace first. The %2$s is tightening, and the next sets need to buy back enough room to %3$s.', strtolower( $enemy ), $encounter_label, $encounter_objective );
		}

		return sprintf( 'The %1$s is engaged and watching for mistakes. The %2$s has started, and the workout still needs to help you %3$s.', strtolower( $enemy ), $encounter_label, $encounter_objective );
	}

	private static function build_follow_up_situation( array $state, string $exercise_name, string $set_result, string $encounter_type, array $beat_context = [] ): string {
		$enemy    = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$exercise = '' !== $exercise_name ? $exercise_name : 'the lift';
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$success_shift = self::encounter_success_phrase( $encounter_type, $exercise );
		$pressure_shift = self::encounter_pressure_phrase( $encounter_type, $exercise );
		$stage = sanitize_key( (string) ( $beat_context['stage'] ?? '' ) );

		if ( in_array( $set_result, [ 'target_met', 'push_set', 'surge', 'breakthrough', 'recovered' ], true ) ) {
			if ( 'opening' === $stage ) {
				return sprintf( 'The encounter is live now. %1$s is giving you some room inside the %2$s, but the next set still has to confirm it.', $exercise, $encounter_label );
			}

			return sprintf( 'The %1$s is starting to give. %2$s is helping you stay ahead inside the %3$s while %4$s.', strtolower( $enemy ), $exercise, $encounter_label, $success_shift );
		}

		if ( in_array( $set_result, [ 'close_call', 'strain', 'slipped' ], true ) ) {
			return sprintf( '%1$s is still tight. %2$s, and one cleaner set will reopen the space you need inside the %3$s.', $exercise, self::capitalize_first( $pressure_shift ), $encounter_label );
		}

		return sprintf( 'The %1$s is still pressing into %2$s. %3$s, so take a short rest and answer it quickly.', strtolower( $enemy ), $exercise, self::capitalize_first( $pressure_shift ) );
	}

	private static function build_transition_situation( array $state, string $exercise_name, string $encounter_type ): string {
		$enemy    = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$exercise = '' !== $exercise_name ? $exercise_name : 'that encounter';
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$transition_shift = self::encounter_transition_phrase( $encounter_type, $exercise );

		return sprintf( '%1$s is done, but the %2$s is not. %3$s, and the %4$s is already forming around the next answer.', $exercise, strtolower( $enemy ), self::capitalize_first( $transition_shift ), $encounter_label );
	}

	private static function build_next_encounter_choices( array $state, string $exercise_name, string $encounter_type ): array {
		$exercise = sanitize_text_field( $exercise_name ?: 'the next movement' );
		$enemy = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$class_label = self::humanize_slug( (string) ( $state['class_slug'] ?? 'hero' ) );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		return [
			[
				'id'    => 'direct_assault',
				'tone'  => 'aggressive',
				'label' => sprintf( 'Step into %1$s fast and %2$s before %3$s settles in', $exercise, $encounter_objective, strtolower( $enemy ) ),
			],
			[
				'id'    => 'steady_approach',
				'tone'  => 'cautious',
				'label' => sprintf( 'Use %1$s to settle your pace first, then %2$s cleanly', $exercise, $encounter_objective ),
			],
			[
				'id'    => 'class_play',
				'tone'  => 'creative',
				'label' => sprintf( 'Lean on your %1$s instincts and create a better angle through %2$s', strtolower( $class_label ), $exercise ),
			],
		];
	}

	private static function build_next_encounter_situation( array $state, string $exercise_name, string $encounter_type, int $encounter_index, int $exercise_count ): string {
		$exercise = sanitize_text_field( $exercise_name ?: 'the next movement' );
		$enemy = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_total = $exercise_count > 0 ? sprintf( 'Encounter %1$d of %2$d', max( 1, $encounter_index ), $exercise_count ) : sprintf( 'Encounter %d', max( 1, $encounter_index ) );

		return sprintf( '%1$s is next. %2$s waits deeper in the route, and %3$s is shaping up as a %4$s.', $encounter_total, $enemy, $exercise, $encounter_label );
	}

	private static function build_next_encounter_prompt( string $exercise_name, int $encounter_index, int $exercise_count ): string {
		$exercise = sanitize_text_field( $exercise_name ?: 'the next movement' );
		if ( $exercise_count > 0 ) {
			return sprintf( 'Choose how you enter encounter %1$d of %2$d around %3$s.', max( 1, $encounter_index ), $exercise_count, $exercise );
		}

		return sprintf( 'Choose how you enter the next encounter around %s.', $exercise );
	}

	private static function build_progress_label( int $set_number, array $beat_context, string $set_result ): string {
		$stage = sanitize_key( (string) ( $beat_context['stage'] ?? '' ) );

		if ( 'opening' === $stage ) {
			return 'First exchange underway';
		}

		if ( in_array( $set_result, [ 'surge', 'breakthrough' ], true ) ) {
			return sprintf( 'Set %d turned the exchange', max( 1, $set_number ) );
		}

		if ( 'recovered' === $set_result ) {
			return sprintf( 'Set %d recovered control', max( 1, $set_number ) );
		}

		if ( in_array( $set_result, [ 'slipped', 'close_call', 'strain', 'struggle' ], true ) ) {
			return sprintf( 'Set %d raised the pressure', max( 1, $set_number ) );
		}

		return sprintf( 'Set %d shifted the fight', max( 1, $set_number ) );
	}

	private static function build_set_beat_context( array $previous_context, string $exercise_name, int $set_number, int $sets_total, string $set_result, bool $completed_exercise, int $reps_completed, ?float $current_rir ): array {
		$same_exercise = sanitize_text_field( (string) ( $previous_context['exercise_name'] ?? '' ) ) === sanitize_text_field( $exercise_name );
		$previous_reps = $same_exercise ? max( 0, (int) ( $previous_context['reps_completed'] ?? 0 ) ) : 0;
		$previous_result = $same_exercise ? sanitize_key( (string) ( $previous_context['set_result'] ?? '' ) ) : '';
		$stage = $completed_exercise
			? 'resolution'
			: ( $set_number <= 1 ? 'opening' : ( $sets_total > 0 && $set_number >= max( 2, $sets_total - 1 ) ? 'closing' : 'middle' ) );
		$trend = 'flat';

		if ( in_array( $set_result, [ 'recovered' ], true ) ) {
			$trend = 'recovered';
		} elseif ( in_array( $set_result, [ 'slipped' ], true ) ) {
			$trend = 'down';
		} elseif ( $same_exercise && $previous_reps > 0 ) {
			if ( $reps_completed > $previous_reps ) {
				$trend = 'up';
			} elseif ( $reps_completed < $previous_reps ) {
				$trend = 'down';
			}
		}

		$strain = 'low';
		if ( in_array( $set_result, [ 'strain', 'slipped', 'struggle' ], true ) || ( null !== $current_rir && $current_rir <= 0 ) ) {
			$strain = 'high';
		} elseif ( in_array( $set_result, [ 'close_call' ], true ) || ( null !== $current_rir && $current_rir <= 1.5 ) ) {
			$strain = 'medium';
		}

		return [
			'same_exercise'  => $same_exercise,
			'previous_result'=> $previous_result,
			'previous_reps'  => $previous_reps,
			'stage'          => $stage,
			'trend'          => $trend,
			'strain'         => $strain,
		];
	}

	private static function encounter_objective_phrase( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'keep the weight moving without letting it own your posture',
			'breach' => 'drive the lane open before resistance stacks up',
			'duel' => 'pick one weak point and punish it cleanly',
			'rhythm_trial' => 'break the machine tempo before it breaks yours',
			'advance' => 'keep ground under your feet and make every step count',
			'pursuit' => 'run the distance before the route can close',
			'warding' => 'hold the line without letting tension fold you in',
			'siege' => 'keep pressure on the gate until it gives',
			'hunt' => 'track the opening before it disappears',
			'close_combat' => 'stay inside the exchange and hit first',
			default => 'keep the encounter from settling against you',
		};
	}

	private static function encounter_success_phrase( string $encounter_type, string $exercise ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => sprintf( '%s keeps the load obedient instead of punishing your frame', $exercise ),
			'breach' => sprintf( '%s drives a fresh gap through the resistance in front of you', $exercise ),
			'duel' => sprintf( '%s lands like a clean answer on one exposed weakness', $exercise ),
			'rhythm_trial' => sprintf( '%s snaps the machine tempo back into your hands', $exercise ),
			'advance' => sprintf( '%s keeps the march moving and denies the stall', $exercise ),
			'pursuit' => sprintf( '%s keeps the chase in your favor before the route bends away', $exercise ),
			'warding' => sprintf( '%s steadies the circle and refuses the collapse', $exercise ),
			'siege' => sprintf( '%s keeps the battering line heavy and relentless', $exercise ),
			'hunt' => sprintf( '%s pins the opening before the prey can slip free', $exercise ),
			'close_combat' => sprintf( '%s keeps you chest-to-chest and on the stronger side of the clash', $exercise ),
			default => sprintf( '%s keeps the momentum tilted toward you', $exercise ),
		};
	}

	private static function encounter_pressure_phrase( string $encounter_type, string $exercise ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => sprintf( 'the load is starting to pull at your structure around %s', $exercise ),
			'breach' => sprintf( 'the lane is clogging up around %s faster than you want', $exercise ),
			'duel' => sprintf( 'the single-target duel around %s is getting exacting and mean', $exercise ),
			'rhythm_trial' => sprintf( 'the machine tempo around %s is trying to trap you in its pattern', $exercise ),
			'advance' => sprintf( 'the march around %s is shortening your room to recover', $exercise ),
			'pursuit' => sprintf( 'the route around %s is slipping and asking for speed you may not have yet', $exercise ),
			'warding' => sprintf( 'the circle around %s is wavering and wants you to break first', $exercise ),
			'siege' => sprintf( 'the siege line around %s is grinding into your breathing', $exercise ),
			'hunt' => sprintf( 'the hunt around %s is tightening every time you hesitate', $exercise ),
			'close_combat' => sprintf( 'the close-quarters exchange around %s is getting crowded and violent', $exercise ),
			default => sprintf( 'the encounter around %s is escalating faster than you want', $exercise ),
		};
	}

	private static function encounter_transition_phrase( string $encounter_type, string $exercise ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => sprintf( '%s is finished, but you are still carrying the demand of the mission forward', $exercise ),
			'breach' => sprintf( '%s punched a lane open, but the mission is already shoving fresh resistance into it', $exercise ),
			'duel' => sprintf( '%s won the exchange, but the mission is already choosing the next weak point for you', $exercise ),
			'rhythm_trial' => sprintf( '%s broke the machine pace, but the next section is already trying to set a new one', $exercise ),
			'advance' => sprintf( '%s moved you forward, but the march is not done asking for control', $exercise ),
			'pursuit' => sprintf( '%s kept the route alive, but the chase is bending toward the next turn already', $exercise ),
			'warding' => sprintf( '%s held the circle, but the next stretch wants to break it from another angle', $exercise ),
			'siege' => sprintf( '%s cracked the line, but the wall behind it still has to come down', $exercise ),
			'hunt' => sprintf( '%s pinned the opening, but the mission is already drawing the prey somewhere else', $exercise ),
			'close_combat' => sprintf( '%s won the collision, but there is another body and another angle waiting immediately after', $exercise ),
			default => sprintf( '%s is done, but the mission is already shaping the next exchange', $exercise ),
		};
	}

	private static function encounter_epilogue_phrase( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'You proved you can carry ugly work without losing shape.',
			'breach' => 'You proved you can keep driving when the lane narrows and the resistance stacks up.',
			'duel' => 'You proved you can find one weakness and keep answering it cleanly.',
			'rhythm_trial' => 'You proved you can break imposed tempo and keep your own cadence under pressure.',
			'advance' => 'You proved you can keep moving the line forward when every step asks for more control.',
			'pursuit' => 'You proved you can stay on the route long enough to own the chase.',
			'warding' => 'You proved you can hold shape while pressure leans hard on every seam.',
			'siege' => 'You proved you can keep pressure on the wall until something finally gives.',
			'hunt' => 'You proved you can keep tracking the opening before it disappears.',
			'close_combat' => 'You proved you can stay inside the clash and keep the stronger answer ready.',
			'boss_duel' => 'You proved you can stay present when the whole mission narrows around one dominant threat.',
			default => 'You proved you can keep the encounter from settling against you.',
		};
	}

	private static function resolve_set_result( int $reps_completed, int $rep_target_min, int $rep_target_max, bool $completed_exercise, ?float $current_rir = null, array $previous_context = [], string $exercise_name = '' ): string {
		$same_exercise = sanitize_text_field( (string) ( $previous_context['exercise_name'] ?? '' ) ) === sanitize_text_field( $exercise_name );
		$previous_result = $same_exercise ? sanitize_key( (string) ( $previous_context['set_result'] ?? '' ) ) : '';
		$previous_reps = $same_exercise ? max( 0, (int) ( $previous_context['reps_completed'] ?? 0 ) ) : 0;

		if ( $completed_exercise && $rep_target_max > 0 && $reps_completed > $rep_target_max ) {
			return 'breakthrough';
		}

		if ( $completed_exercise && $rep_target_max > 0 && $reps_completed >= $rep_target_max ) {
			return 'push_set';
		}

		if ( $rep_target_max > 0 && $reps_completed > $rep_target_max ) {
			return 'surge';
		}

		if ( $rep_target_min > 0 && $reps_completed >= $rep_target_min ) {
			if ( $same_exercise && in_array( $previous_result, [ 'close_call', 'strain', 'slipped', 'struggle' ], true ) ) {
				return 'recovered';
			}

			if ( null !== $current_rir && $current_rir <= 0 ) {
				return 'strain';
			}

			return 'target_met';
		}

		if ( $reps_completed > 0 ) {
			if ( $same_exercise && $previous_reps > 0 && $reps_completed < $previous_reps ) {
				return 'slipped';
			}

			return 'close_call';
		}

		return 'struggle';
	}

	private static function resolve_roll_band( int $final_roll ): string {
		if ( $final_roll >= 22 ) {
			return 'dominant_success';
		}
		if ( $final_roll >= 18 ) {
			return 'strong_success';
		}
		if ( $final_roll >= 14 ) {
			return 'moderate_success';
		}
		if ( $final_roll >= 10 ) {
			return 'low_success';
		}
		if ( $final_roll >= 6 ) {
			return 'struggle';
		}

		return 'failure';
	}

	private static function resolve_choice_tension( string $roll_band ): string {
		if ( in_array( $roll_band, [ 'dominant_success', 'strong_success' ], true ) ) {
			return 'controlled';
		}
		if ( in_array( $roll_band, [ 'moderate_success', 'low_success' ], true ) ) {
			return 'rising';
		}

		return 'high';
	}

	private static function advance_tension( string $current_tension, string $set_result ): string {
		$current_index = array_search( $current_tension, self::TENSION_STATES, true );
		$current_index = false === $current_index ? 1 : (int) $current_index;

		if ( 'push_set' === $set_result ) {
			return self::TENSION_STATES[ max( 0, $current_index - 1 ) ];
		}

		if ( 'target_met' === $set_result ) {
			return self::TENSION_STATES[ max( 1, $current_index ) ];
		}

		if ( 'close_call' === $set_result ) {
			return self::TENSION_STATES[ min( count( self::TENSION_STATES ) - 1, $current_index + 1 ) ];
		}

		return self::TENSION_STATES[ min( count( self::TENSION_STATES ) - 1, $current_index + 2 ) ];
	}

	private static function resolve_progress_phase( int $progress_percent ): string {
		if ( $progress_percent >= 55 ) {
			return 'final_push';
		}

		if ( $progress_percent >= 30 ) {
			return 'clash';
		}

		return 'engaged';
	}

	private static function resolve_story_effects_for_ai_prompt( array $state, array $run, string $exercise_name, string $effect_type ): array {
		$effect_type   = 'spell' === $effect_type ? 'spell' : 'gear';
		$effects_key   = $effect_type . '_effects';
		$candidate_sets = [
			$state[ $effects_key ] ?? null,
			$run[ $effects_key ] ?? null,
			$run['ironquest_' . $effects_key ] ?? null,
		];

		foreach ( $candidate_sets as $candidate ) {
			if ( ! is_array( $candidate ) ) {
				continue;
			}

			$clean = array_values(
				array_filter(
					array_map(
						static function ( $effect ): string {
							return is_scalar( $effect ) ? sanitize_text_field( (string) $effect ) : '';
						},
						$candidate
					)
				)
			);

			if ( $clean ) {
				return $clean;
			}
		}

		return apply_filters( 'johnny5k_ironquest_story_effects', [], $effect_type, $state, $run, $exercise_name );
	}

	private static function resolve_default_encounter_type( string $run_type, array $mission ): string {
		$mission_type = sanitize_key( (string) ( $mission['mission_type'] ?? '' ) );
		if ( 'cardio' === sanitize_key( $run_type ) || 'runner_task' === $mission_type ) {
			return 'pursuit';
		}

		if ( 'boss' === $mission_type ) {
			return 'boss_duel';
		}

		if ( in_array( $mission_type, [ 'endurance_and_tension', 'pressure_and_intensity' ], true ) ) {
			return 'siege';
		}

		return 'skirmish';
	}

	private static function resolve_encounter_type_for_exercise( string $exercise_name, string $slot_type = '', string $run_type = '' ): string {
		$name = strtolower( sanitize_text_field( $exercise_name ) );
		$slot_type = sanitize_key( $slot_type );
		$run_type = sanitize_key( $run_type );

		if ( 'cardio' === $run_type || 'cardio' === $slot_type || str_contains( $name, 'run' ) || str_contains( $name, 'bike' ) || str_contains( $name, 'rower' ) || str_contains( $name, 'relay' ) || str_contains( $name, 'sprint' ) ) {
			return 'pursuit';
		}

		if ( 'abs' === $slot_type || str_contains( $name, 'plank' ) || str_contains( $name, 'crunch' ) || str_contains( $name, 'hollow' ) ) {
			return 'warding';
		}

		if ( str_contains( $name, 'carry' ) || str_contains( $name, 'yoke' ) || str_contains( $name, 'sandbag' ) || str_contains( $name, 'farmer' ) || str_contains( $name, 'suitcase' ) ) {
			return 'burden';
		}

		if ( str_contains( $name, 'sled' ) || str_contains( $name, 'drag' ) || str_contains( $name, 'push' ) && str_contains( $name, 'sled' ) ) {
			return 'breach';
		}

		if ( str_contains( $name, 'curl' ) || str_contains( $name, 'lateral raise' ) || str_contains( $name, 'tricep' ) || str_contains( $name, 'pressdown' ) || str_contains( $name, 'extension' ) || str_contains( $name, 'fly' ) || str_contains( $name, 'calf' ) ) {
			return 'duel';
		}

		if ( str_contains( $name, 'machine' ) || str_contains( $name, 'leg press' ) || str_contains( $name, 'hack squat' ) || str_contains( $name, 'cable' ) || str_contains( $name, 'smith' ) ) {
			return 'rhythm_trial';
		}

		if ( str_contains( $name, 'bench' ) || str_contains( $name, 'press' ) || str_contains( $name, 'dip' ) ) {
			return 'close_combat';
		}

		if ( str_contains( $name, 'row' ) || str_contains( $name, 'pull' ) || str_contains( $name, 'chin' ) || str_contains( $name, 'lat' ) ) {
			return 'hunt';
		}

		if ( str_contains( $name, 'squat' ) || str_contains( $name, 'deadlift' ) || str_contains( $name, 'hinge' ) || str_contains( $name, 'rdl' ) ) {
			return 'siege';
		}

		if ( str_contains( $name, 'lunge' ) || str_contains( $name, 'step up' ) || str_contains( $name, 'split squat' ) ) {
			return 'advance';
		}

		return 'skirmish';
	}

	private static function encounter_flavor_label( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'close_combat' => 'close-quarters clash',
			'hunt' => 'stalking exchange',
			'siege' => 'siege line',
			'advance' => 'forward drive',
			'burden' => 'burden march',
			'breach' => 'breach run',
			'duel' => 'single-target duel',
			'rhythm_trial' => 'machine rhythm trial',
			'pursuit' => 'running pursuit',
			'warding' => 'holding circle',
			'boss_duel' => 'boss duel',
			default => 'skirmish',
		};
	}

	private static function stance_roll_modifier( string $stance ): int {
		return match ( self::normalize_stance( $stance ) ) {
			'aggressive' => 2,
			'cautious' => 1,
			default => 0,
		};
	}

	private static function choice_roll_modifier( string $tone ): int {
		return match ( sanitize_key( $tone ) ) {
			'aggressive' => 1,
			'creative' => 2,
			default => 0,
		};
	}

	private static function class_roll_modifier( string $class_slug ): int {
		return match ( sanitize_key( $class_slug ) ) {
			'warrior', 'paladin' => 1,
			'rogue', 'ranger' => 2,
			'mage', 'sorcerer' => 1,
			default => 0,
		};
	}

	private static function normalize_stance( string $stance ): string {
		$normalized = sanitize_key( $stance );
		if ( in_array( $normalized, [ 'steady', 'aggressive', 'cautious' ], true ) ) {
			return $normalized;
		}

		return 'steady';
	}

	private static function find_story_choice( array $state, string $choice_id ): array {
		$choice_id = sanitize_key( $choice_id );
		foreach ( (array) ( $state['choices'] ?? [] ) as $choice ) {
			if ( sanitize_key( (string) ( $choice['id'] ?? '' ) ) === $choice_id ) {
				return [
					'id'    => sanitize_key( (string) ( $choice['id'] ?? '' ) ),
					'label' => sanitize_text_field( (string) ( $choice['label'] ?? '' ) ),
					'tone'  => sanitize_key( (string) ( $choice['tone'] ?? '' ) ),
				];
			}
		}

		return [];
	}

	private static function normalize_story_state( array $state, int $user_id, array $run ): array {
		$normalized = $state;
		$normalized['run_id'] = (int) ( $run['id'] ?? ( $state['run_id'] ?? 0 ) );
		$normalized['encounter_index'] = max( 1, (int) ( $state['encounter_index'] ?? 1 ) );
		$normalized['phase'] = sanitize_key( (string) ( $state['phase'] ?? 'opening' ) );
		$normalized['encounter_phase'] = sanitize_key( (string) ( $state['encounter_phase'] ?? ( $run['encounter_phase'] ?? 'intro' ) ) );
		$normalized['stance'] = self::normalize_stance( (string) ( $state['stance'] ?? 'steady' ) );
		$normalized['location_name'] = sanitize_text_field( (string) ( $state['location_name'] ?? '' ) );
		$normalized['mission_name'] = sanitize_text_field( (string) ( $state['mission_name'] ?? '' ) );
		$normalized['objective'] = sanitize_text_field( (string) ( $state['objective'] ?? '' ) );
		$normalized['opening_text'] = sanitize_textarea_field( (string) ( $state['opening_text'] ?? '' ) );
		$normalized['decision_prompt'] = sanitize_text_field( (string) ( $state['decision_prompt'] ?? '' ) );
		$normalized['choices'] = array_values( array_filter( array_map( [ __CLASS__, 'sanitize_story_choice' ], (array) ( $state['choices'] ?? [] ) ) ) );
		$normalized['default_choice_id'] = sanitize_key( (string) ( $state['default_choice_id'] ?? '' ) );
		$normalized['current_situation'] = sanitize_text_field( (string) ( $state['current_situation'] ?? '' ) );
		$normalized['enemy'] = sanitize_text_field( (string) ( $state['enemy'] ?? '' ) );
		$normalized['encounter_type'] = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$normalized['tension'] = sanitize_key( (string) ( $state['tension'] ?? 'rising' ) );
		$normalized['roll'] = [
			'dice_roll'            => max( 0, (int) ( $state['roll']['dice_roll'] ?? 0 ) ),
			'roll_modifiers_total' => (int) ( $state['roll']['roll_modifiers_total'] ?? 0 ),
			'roll_final'           => (int) ( $state['roll']['roll_final'] ?? 0 ),
			'roll_band'            => sanitize_key( (string) ( $state['roll']['roll_band'] ?? '' ) ),
		];
		$normalized['outcome_text'] = sanitize_textarea_field( (string) ( $state['outcome_text'] ?? '' ) );
		$normalized['latest_beat'] = sanitize_textarea_field( (string) ( $state['latest_beat'] ?? '' ) );
		$normalized['opening_choice'] = sanitize_text_field( (string) ( $state['opening_choice'] ?? '' ) );
		$normalized['selected_choice'] = self::sanitize_story_choice( (array) ( $state['selected_choice'] ?? [] ) );
		$normalized['exercise_context'] = [
			'exercise_name' => sanitize_text_field( (string) ( $state['exercise_context']['exercise_name'] ?? '' ) ),
			'exercise_order'=> max( 0, (int) ( $state['exercise_context']['exercise_order'] ?? 0 ) ),
			'exercise_count'=> max( 0, (int) ( $state['exercise_context']['exercise_count'] ?? 0 ) ),
			'set_number'    => max( 0, (int) ( $state['exercise_context']['set_number'] ?? 0 ) ),
			'sets_total'    => max( 0, (int) ( $state['exercise_context']['sets_total'] ?? 0 ) ),
			'set_result'    => sanitize_key( (string) ( $state['exercise_context']['set_result'] ?? '' ) ),
			'reps_completed'=> max( 0, (int) ( $state['exercise_context']['reps_completed'] ?? 0 ) ),
			'rep_target_min'=> max( 0, (int) ( $state['exercise_context']['rep_target_min'] ?? 0 ) ),
			'rep_target_max'=> max( 0, (int) ( $state['exercise_context']['rep_target_max'] ?? 0 ) ),
			'current_rir'   => is_numeric( $state['exercise_context']['current_rir'] ?? null ) ? (float) $state['exercise_context']['current_rir'] : null,
			'stage'         => sanitize_key( (string) ( $state['exercise_context']['stage'] ?? '' ) ),
			'trend'         => sanitize_key( (string) ( $state['exercise_context']['trend'] ?? '' ) ),
			'encounter_type'=> sanitize_key( (string) ( $state['exercise_context']['encounter_type'] ?? '' ) ),
		];
		$normalized['progress'] = self::merge_progress_state( (array) ( $state['progress'] ?? [] ), [] );
		$normalized['transcript'] = array_values( array_filter( array_map( [ __CLASS__, 'sanitize_story_entry' ], (array) ( $state['transcript'] ?? [] ) ) ) );
		$normalized['conclusion'] = [
			'title'    => sanitize_text_field( (string) ( $state['conclusion']['title'] ?? '' ) ),
			'summary'  => sanitize_textarea_field( (string) ( $state['conclusion']['summary'] ?? '' ) ),
			'epilogue' => sanitize_textarea_field( (string) ( $state['conclusion']['epilogue'] ?? '' ) ),
		];
		$normalized['result_band'] = sanitize_key( (string) ( $state['result_band'] ?? '' ) );
		$normalized['class_slug'] = sanitize_key( (string) ( $state['class_slug'] ?? ( IronQuestProfileService::ensure_profile( $user_id )['class_slug'] ?? '' ) ) );

		return $normalized;
	}

	private static function sanitize_story_choice( array $choice ): array {
		$id = sanitize_key( (string) ( $choice['id'] ?? '' ) );
		$label = sanitize_text_field( (string) ( $choice['label'] ?? '' ) );
		if ( '' === $id && '' === $label ) {
			return [];
		}

		return [
			'id'    => $id,
			'label' => $label,
			'tone'  => sanitize_key( (string) ( $choice['tone'] ?? '' ) ),
		];
	}

	private static function sanitize_story_entry( array $entry ): array {
		$text = sanitize_textarea_field( (string) ( $entry['text'] ?? '' ) );
		if ( '' === $text ) {
			return [];
		}

		return [
			'kind'          => sanitize_key( (string) ( $entry['kind'] ?? '' ) ),
			'title'         => sanitize_text_field( (string) ( $entry['title'] ?? '' ) ),
			'text'          => $text,
			'choice_id'     => sanitize_key( (string) ( $entry['choice_id'] ?? '' ) ),
			'choice'        => sanitize_text_field( (string) ( $entry['choice'] ?? '' ) ),
			'roll_band'     => sanitize_key( (string) ( $entry['roll_band'] ?? '' ) ),
			'exercise_name' => sanitize_text_field( (string) ( $entry['exercise_name'] ?? '' ) ),
			'set_number'    => max( 0, (int) ( $entry['set_number'] ?? 0 ) ),
			'sets_total'    => max( 0, (int) ( $entry['sets_total'] ?? 0 ) ),
			'set_result'    => sanitize_key( (string) ( $entry['set_result'] ?? '' ) ),
			'encounter_type'=> sanitize_key( (string) ( $entry['encounter_type'] ?? '' ) ),
			'result_band'   => sanitize_key( (string) ( $entry['result_band'] ?? '' ) ),
		];
	}

	private static function merge_progress_state( array $progress, array $overrides ): array {
		$base = [
			'completed_sets'      => max( 0, (int) ( $progress['completed_sets'] ?? 0 ) ),
			'completed_exercises' => max( 0, (int) ( $progress['completed_exercises'] ?? 0 ) ),
			'percent'             => max( 0, min( 100, (int) ( $progress['percent'] ?? 0 ) ) ),
			'label'               => sanitize_text_field( (string) ( $progress['label'] ?? '' ) ),
		];

		foreach ( $overrides as $key => $value ) {
			if ( 'label' === $key ) {
				$base['label'] = sanitize_text_field( (string) $value );
				continue;
			}
			$base[ $key ] = max( 0, (int) $value );
		}

		return $base;
	}

	private static function append_transcript( array $transcript, array $entry ): array {
		$transcript[] = self::sanitize_story_entry( $entry );
		$transcript   = array_values( array_filter( $transcript ) );

		if ( count( $transcript ) > 8 ) {
			$transcript = array_slice( $transcript, -8 );
		}

		return $transcript;
	}

	private static function persist_story_state( int $user_id, int $run_id, array $state ): void {
		if ( $run_id <= 0 ) {
			return;
		}

		update_user_meta( $user_id, self::story_meta_key( $run_id ), self::normalize_story_state( $state, $user_id, [ 'id' => $run_id ] ) );
	}

	private static function story_meta_key( int $run_id ): string {
		return self::STORY_META_PREFIX . max( 0, $run_id );
	}

	private static function humanize_slug( string $value ): string {
		$normalized = sanitize_key( $value );
		if ( '' === $normalized ) {
			return 'Hero';
		}

		return trim( preg_replace( '/\s+/', ' ', ucwords( str_replace( [ '_', '-' ], ' ', $normalized ) ) ) ?? '' );
	}

	private static function capitalize_first( string $value ): string {
		if ( '' === $value ) {
			return '';
		}

		return strtoupper( substr( $value, 0, 1 ) ) . substr( $value, 1 );
	}
}
