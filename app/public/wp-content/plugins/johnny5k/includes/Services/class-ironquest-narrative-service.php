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
		$scene_state       = self::update_scene_state_for_opening( (array) ( $state['scene_state'] ?? [] ), (string) ( $roll['roll_band'] ?? '' ) );
		$state_with_scene  = $state;
		$state_with_scene['scene_state'] = $scene_state;
		$outcome_text      = '' !== (string) ( $ai_outcome['outcome_text'] ?? '' )
			? (string) $ai_outcome['outcome_text']
			: self::build_choice_outcome_text( $state_with_scene, $choice, $roll );
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
		$state['scene_state']       = $scene_state;
			$state['current_situation'] = '' !== (string) ( $ai_outcome['current_situation'] ?? '' )
				? (string) $ai_outcome['current_situation']
				: self::build_current_situation( $state_with_scene, $choice, $roll );
			$state['decision_prompt']   = '' !== (string) ( $ai_outcome['decision_prompt'] ?? '' )
				? (string) $ai_outcome['decision_prompt']
				: 'Press into the encounter and let the next set decide the pace.';
			$state['debug_prompt']      = sanitize_textarea_field( (string) ( $ai_outcome['debug_prompt'] ?? '' ) );
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
		$encounter_seed    = self::resolve_encounter_seed( $mission, max( 1, $exercise_order ), $encounter_type, (string) ( $state['enemy'] ?? '' ) );
		$current_context   = (array) ( $state['exercise_context'] ?? [] );
		$set_result        = self::resolve_set_result( $reps_completed, $rep_target_min, $rep_target_max, $completed_exercise, $current_rir, $current_context, $exercise_name );
		$beat_context      = self::build_set_beat_context( $current_context, $exercise_name, $set_number, $sets_total, $set_result, $completed_exercise, $reps_completed, $current_rir );
		$hp_loss_this_set  = self::resolve_hp_loss_for_set( $set_result, $beat_context );
		if ( $hp_loss_this_set > 0 ) {
			$profile = IronQuestProfileService::set_hp(
				$user_id,
				max( 0, (int) ( $profile['hp_current'] ?? 100 ) - $hp_loss_this_set ),
				max( 1, (int) ( $profile['hp_max'] ?? 100 ) )
			);
		}
		$scene_state       = self::update_scene_state_for_set( (array) ( $state['scene_state'] ?? [] ), $encounter_seed, $set_result, $completed_exercise, $beat_context );
		$state_with_scene  = $state;
		$state_with_scene['encounter_type'] = $encounter_type;
		$state_with_scene['encounter_seed'] = $encounter_seed;
		$state_with_scene['scene_state']    = $scene_state;
		$story_engine_bundle = self::build_story_engine_set_progression_bundle(
			$mission,
			$run,
			$state_with_scene,
			[
				'slot'           => 'set_progression',
				'set_result'     => $set_result,
				'exercise_order' => $exercise_order,
				'stage'          => (string) ( $beat_context['stage'] ?? '' ),
				'tension'        => (string) ( $state['tension'] ?? 'rising' ),
				'stance'         => (string) ( $state['stance'] ?? 'steady' ),
				'progress_phase' => (string) ( $state['encounter_phase'] ?? 'intro' ),
				'mechanics'      => [
					'hp_loss_this_set'   => $hp_loss_this_set,
					'completed_exercise' => $completed_exercise,
				],
			],
			$encounter_seed,
			$scene_state,
			$completed_exercise
		);
		$fallback_latest_beat = '' !== (string) ( $story_engine_bundle['latest_beat'] ?? '' )
			? (string) $story_engine_bundle['latest_beat']
			: self::build_set_story_text( $state_with_scene, $exercise_name, $set_number, $sets_total, $set_result, $event_type, $completed_exercise, $encounter_type, $beat_context );
		// Rest-time beats are read on the clock, so they come from the pre-written
		// story engine bank (fast, deterministic) rather than a live AI call —
		// a synchronous AI request here was the source of the rest-screen lag.
		// Pre-writing/varying this content is the story workbench's job, offline.
		$set_beat_bundle   = [];
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
		$state['story_engine']    = is_array( $story_engine_bundle['story_engine'] ?? null )
			? (array) $story_engine_bundle['story_engine']
			: (array) ( $state['story_engine'] ?? [] );
		$state['encounter_type']  = $encounter_type;
		$state['encounter_seed']  = $encounter_seed;
		$state['scene_state']     = $scene_state;
		$state['hp_current']      = max( 0, (int) ( $profile['hp_current'] ?? 0 ) );
		$state['hp_max']          = max( 1, (int) ( $profile['hp_max'] ?? 100 ) );
		$state['hp_loss_this_set'] = $hp_loss_this_set;
		$state['encounter_index'] = max( 1, (int) ( $state['encounter_index'] ?? $exercise_order ) );
		$state['current_situation'] = $completed_exercise
			? self::build_transition_situation( $state_with_scene, $exercise_name, $encounter_type )
			: ( '' !== (string) ( $set_beat_bundle['current_situation'] ?? '' )
				? (string) $set_beat_bundle['current_situation']
				: ( '' !== (string) ( $story_engine_bundle['current_situation'] ?? '' )
					? (string) $story_engine_bundle['current_situation']
					: self::build_follow_up_situation( $state_with_scene, $exercise_name, $set_result, $encounter_type, $beat_context ) ) );
			$state['decision_prompt'] = ! $completed_exercise && '' !== (string) ( $set_beat_bundle['decision_prompt'] ?? '' )
				? (string) $set_beat_bundle['decision_prompt']
				: ( '' !== (string) ( $story_engine_bundle['decision_prompt'] ?? '' )
					? (string) $story_engine_bundle['decision_prompt']
					: 'Press into the encounter and let the next set decide the pace.' );
			$state['debug_prompt'] = ! $completed_exercise
				? sanitize_textarea_field( (string) ( $set_beat_bundle['debug_prompt'] ?? '' ) )
				: sanitize_textarea_field( (string) ( $state['debug_prompt'] ?? '' ) );
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
			$next_encounter_seed      = self::resolve_encounter_seed( $mission, $next_encounter_index, $next_encounter_type, (string) ( $state['enemy'] ?? '' ) );
			$next_scene_state         = self::build_scene_state_from_seed( $next_encounter_seed, $next_encounter_index, $exercise_count );
			$transition_story_engine_bundle = self::build_story_engine_transition_bundle(
				$mission,
				$run,
				$state,
				$state['exercise_context'],
				[
					'exercise_name'  => $next_exercise_name,
					'exercise_order' => $next_encounter_index,
					'exercise_count' => $exercise_count,
					'encounter_type' => $next_encounter_type,
					'encounter_seed' => $next_encounter_seed,
				],
				$next_scene_state
			);
			$transition_state         = $state;
			$transition_state['encounter_type'] = $next_encounter_type;
			$transition_state['encounter_seed'] = $next_encounter_seed;
			$transition_state['scene_state']    = $next_scene_state;
			// Same reasoning as the set-progression beat above: the between-exercise
			// rest beat comes from the pre-written story engine, not a live AI call.
			$transition_bundle        = [];
			$next_choices             = ! empty( $transition_bundle['choices'] )
				? (array) $transition_bundle['choices']
				: self::build_next_encounter_choices( $transition_state, $next_exercise_name, $next_encounter_type );
			$state['phase']           = 'opening';
			$state['encounter_phase'] = 'intro';
			$state['encounter_type']  = $next_encounter_type;
			$state['encounter_seed']  = $next_encounter_seed;
			$state['scene_state']     = $next_scene_state;
			$state['encounter_index'] = $next_encounter_index;
			$state['story_engine']    = is_array( $transition_story_engine_bundle['story_engine'] ?? null )
				? (array) $transition_story_engine_bundle['story_engine']
				: (array) ( $state['story_engine'] ?? [] );
			$state['latest_beat']     = '' !== (string) ( $transition_bundle['latest_beat'] ?? '' )
				? (string) $transition_bundle['latest_beat']
				: ( '' !== (string) ( $transition_story_engine_bundle['latest_beat'] ?? '' )
					? (string) $transition_story_engine_bundle['latest_beat']
					: $latest_beat );
			$state['current_situation'] = '' !== (string) ( $transition_bundle['current_situation'] ?? '' )
				? (string) $transition_bundle['current_situation']
				: ( '' !== (string) ( $transition_story_engine_bundle['current_situation'] ?? '' )
					? (string) $transition_story_engine_bundle['current_situation']
					: self::build_next_encounter_situation( $transition_state, $next_exercise_name, $next_encounter_type, $next_encounter_index, $exercise_count ) );
				$state['decision_prompt'] = '' !== (string) ( $transition_bundle['decision_prompt'] ?? '' )
					? (string) $transition_bundle['decision_prompt']
					: ( '' !== (string) ( $transition_story_engine_bundle['decision_prompt'] ?? '' )
						? (string) $transition_story_engine_bundle['decision_prompt']
						: self::build_next_encounter_prompt( $transition_state, $next_exercise_name, $next_encounter_index, $exercise_count ) );
				$state['debug_prompt']    = sanitize_textarea_field( (string) ( $transition_bundle['debug_prompt'] ?? '' ) );
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
			$state['debug_prompt']    = sanitize_textarea_field( (string) ( $ai_conclusion['debug_prompt'] ?? '' ) );
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
		$encounter_seed = self::resolve_encounter_seed( $mission, 1, $encounter_type, $enemy );
		$scene_state    = self::build_scene_state_from_seed( $encounter_seed, 1, 0 );
		$opening_bundle = IronQuestAiNarrativeService::build_opening_bundle( $user_id, $run, $profile, $location, $mission, $enemy, $encounter_type, $encounter_seed, $scene_state );
		$opening     = '' !== (string) ( $opening_bundle['opening_text'] ?? '' )
			? (string) $opening_bundle['opening_text']
			: self::build_opening_text( $location, $mission, $enemy, $encounter_type, $encounter_seed );
		$choices     = ! empty( $opening_bundle['choices'] )
			? (array) $opening_bundle['choices']
			: self::build_story_choices( $profile, $location, $mission, $enemy, $encounter_type, $encounter_seed );
		$decision_prompt = '' !== (string) ( $opening_bundle['decision_prompt'] ?? '' )
			? (string) $opening_bundle['decision_prompt']
			: 'What do you do?';
		$current_situation = '' !== (string) ( $opening_bundle['current_situation'] ?? '' )
			? (string) $opening_bundle['current_situation']
			: self::resolve_current_situation( $mission, $enemy, $encounter_type, $encounter_seed );

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
				'debug_prompt'      => sanitize_textarea_field( (string) ( $opening_bundle['debug_prompt'] ?? '' ) ),
				'enemy'             => $enemy,
			'encounter_type'    => $encounter_type,
			'encounter_seed'    => $encounter_seed,
			'scene_state'       => $scene_state,
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
			'story_engine'      => [
				'recent_template_ids' => [],
				'recent_tags'         => [],
				'recent_phrases'      => [],
				'slot_counts'         => [],
				'last_selected'       => [],
				'variation_seed'      => sanitize_text_field( sprintf( 'run-%d', max( 0, (int) ( $run['id'] ?? 0 ) ) ) ),
			],
			'conclusion'        => [],
			'result_band'       => '',
			'class_slug'        => sanitize_key( (string) ( $profile['class_slug'] ?? '' ) ),
		];
	}

	private static function build_opening_text( array $location, array $mission, string $enemy, string $encounter_type, array $encounter_seed = [] ): string {
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? 'the region' ) );
		$mission_name  = sanitize_text_field( (string) ( $mission['name'] ?? 'the mission' ) );
		$narrative     = sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) );
		$tone          = sanitize_text_field( (string) ( $location['tone'] ?? '' ) );
		$seed          = self::resolve_seed_details( $encounter_seed, $encounter_type, $enemy );

			$lead = sprintf( '%1$s is live now. %2$s has taken the shape of %3$s around %4$s, and %5$s.', $location_name, $mission_name, strtolower( $seed['title'] ?: self::encounter_flavor_label( $encounter_type ) ), strtolower( $seed['landmark'] ?: $seed['prop'] ), strtolower( $seed['enemy_posture'] ?: $seed['threat'] ) );
			$middle = '' !== $narrative
				? $narrative
				: sprintf( 'The goal is clear: %1$s inside this %2$s. %3$s.', strtolower( $seed['objective'] ), strtolower( self::encounter_flavor_label( $encounter_type ) ), self::capitalize_first( $seed['sensory_detail'] ?: $seed['hazard'] ) );
			$close = '' !== $tone
				? sprintf( 'The room feels %1$s. %2$s, and use the first exchanges to %3$s before %4$s.', strtolower( $tone ), self::capitalize_first( $seed['stakes'] ?: $seed['pressure'] ), strtolower( $seed['objective'] ), strtolower( $seed['transition'] ) )
				: sprintf( '%1$s, and use the first exchanges to %2$s before %3$s.', self::capitalize_first( $seed['stakes'] ?: $seed['pressure'] ), strtolower( $seed['objective'] ), strtolower( $seed['transition'] ) );

		return trim( implode( "\n\n", [ $lead, $middle, $close ] ) );
	}

	private static function build_story_choices( array $profile, array $location, array $mission, string $enemy, string $encounter_type, array $encounter_seed = [] ): array {
		$class_label = self::humanize_slug( (string) ( $profile['class_slug'] ?? 'hero' ) );
		$seed        = self::resolve_seed_details( $encounter_seed, $encounter_type, $enemy );

		return self::build_scene_specific_choices( $seed, $class_label, $encounter_type, 'opening' );
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
		$band       = sanitize_key( (string) ( $roll['roll_band'] ?? '' ) );
		$encounter_type = (string) ( $state['encounter_type'] ?? 'skirmish' );
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), $encounter_type, $enemy );
		$landmark = strtolower( $seed['landmark'] ?: $seed['prop'] );
		$sensory = self::capitalize_first( $seed['sensory_detail'] ?: $seed['hazard'] );

		if ( in_array( $band, [ 'dominant_success', 'strong_success' ], true ) ) {
			return sprintf( 'Your opening move lands at %1$s. %2$s. %3$s, and you get room to %4$s before %5$s can recover.', $landmark, self::capitalize_first( $seed['success_turn'] ), $sensory, strtolower( $seed['objective'] ), strtolower( $seed['threat'] ) );
		}

		if ( 'moderate_success' === $band || 'low_success' === $band ) {
			return sprintf( 'You move first at %1$s, but not cleanly. %2$s. %3$s is still contested, and you still need to %4$s.', $landmark, $sensory, self::capitalize_first( $seed['struggle_turn'] ), strtolower( $seed['objective'] ) );
		}

		return sprintf( 'The first move goes against you at %1$s. %2$s. %3$s, and the next exchange has to help you %4$s before %5$s.', $landmark, $sensory, self::capitalize_first( $seed['struggle_turn'] ), strtolower( $seed['objective'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
	}

	private static function build_set_story_text( array $state, string $exercise_name, int $set_number, int $sets_total, string $set_result, string $event_type, bool $completed_exercise, string $encounter_type, array $beat_context = [] ): string {
		$enemy        = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$roll_band    = sanitize_key( (string) ( $state['roll']['roll_band'] ?? '' ) );
		$scene_state  = self::sanitize_scene_state( (array) ( $state['scene_state'] ?? [] ) );
		$seed         = self::resolve_seed_details( $scene_state, $encounter_type, $enemy );
		$scene_state  = array_merge( $scene_state, $seed );
		$stage          = sanitize_key( (string) ( $beat_context['stage'] ?? '' ) );
		$trend          = sanitize_key( (string) ( $beat_context['trend'] ?? '' ) );
		$phase          = sanitize_key( (string) ( $scene_state['phase'] ?? 'opening' ) );
		$turn_text      = self::resolve_scene_turn_text( $scene_state, $set_result, $completed_exercise );
		$landmark       = strtolower( $seed['prop'] ?: $seed['landmark'] );
		$sensory        = self::capitalize_first( $seed['sensory_detail'] ?: $seed['hazard'] );
		$stakes_now     = strtolower( (string) ( $scene_state['stakes_now'] ?? ( $seed['stakes'] ?: $seed['pressure'] ) ) );

		if ( $completed_exercise || 'exercise_completed' === $event_type ) {
			if ( in_array( $set_result, [ 'target_met', 'push_set', 'breakthrough', 'surge', 'recovered' ], true ) ) {
				return sprintf( 'You secure %1$s at %2$s. %3$s. %4$s, and %5$s finally gives ground.', strtolower( $seed['objective'] ), $landmark, $sensory, self::capitalize_first( $turn_text ), strtolower( $seed['threat'] ) );
			}

			return sprintf( 'You wrench this phase forward at %1$s without fully securing %2$s. %3$s. %4$s, but %5$s is still waiting there.', $landmark, strtolower( $seed['objective'] ), $sensory, self::capitalize_first( $turn_text ), strtolower( $seed['threat'] ) );
		}

		if ( 'opening' === $stage ) {
			if ( in_array( $set_result, [ 'target_met', 'surge', 'breakthrough', 'push_set' ], true ) ) {
				return sprintf( 'The first exchange opens space at %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $seed['success_turn'] ), $sensory );
			}

			if ( in_array( $set_result, [ 'close_call', 'strain' ], true ) ) {
				return sprintf( 'The first exchange is tight at %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $seed['struggle_turn'] ), $sensory );
			}

			return sprintf( 'The first exchange goes against you at %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $seed['struggle_turn'] ), $sensory );
		}

		if ( 'recovered' === $set_result ) {
			return sprintf( 'You recover the line at %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), $sensory );
		}

		if ( in_array( $set_result, [ 'surge', 'breakthrough' ], true ) ) {
			return sprintf( 'The tempo turns hard in your favor around %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), $sensory );
		}

		if ( 'slipped' === $set_result ) {
			return sprintf( 'You give ground back at %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), $sensory );
		}

		if ( in_array( $set_result, [ 'target_met', 'push_set' ], true ) ) {
			if ( 'turning_point' === $phase ) {
				return sprintf( 'You finally bend %1$s onto your timing. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), self::capitalize_first( $stakes_now ) );
			}

			if ( 'closing' === $stage ) {
				return sprintf( 'You keep the pressure on late at %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), self::capitalize_first( $stakes_now ) );
			}

			if ( 'up' === $trend ) {
				return sprintf( 'You build on the last push and keep %1$s alive. %2$s. %3$s.', strtolower( $seed['objective'] ), self::capitalize_first( $turn_text ), $sensory );
			}

			return sprintf( 'You move %1$s forward at %2$s. %3$s. %4$s.', strtolower( $seed['objective'] ), $landmark, self::capitalize_first( $turn_text ), $sensory );
		}

		if ( in_array( $set_result, [ 'close_call', 'strain' ], true ) ) {
			if ( 'crisis' === $phase ) {
				return sprintf( 'The encounter starts to buckle around %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), self::capitalize_first( $stakes_now ) );
			}

			return sprintf( 'You hold through it at %1$s, but barely. %2$s. %3$s.', $landmark, self::capitalize_first( $seed['pressure'] ), $sensory );
		}

		if ( in_array( $roll_band, [ 'struggle', 'failure' ], true ) ) {
			return sprintf( 'The exchange is rough around %1$s. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), self::capitalize_first( $stakes_now ) );
		}

		return sprintf( 'You regroup at %1$s for one more push. %2$s. %3$s.', $landmark, self::capitalize_first( $turn_text ), $sensory );
	}

	private static function build_fallback_conclusion( array $state, array $mission, string $result_band ): string {
		$mission_name = sanitize_text_field( (string) ( $mission['name'] ?? 'The mission' ) );
		$enemy        = sanitize_text_field( (string) ( $state['enemy'] ?? 'threat' ) );
		$encounter_type = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), $encounter_type, $enemy );
		$landmark = strtolower( $seed['landmark'] ?: $seed['prop'] ?: $encounter_label );

		if ( 'failure' === $result_band ) {
			return sprintf( '%1$s stays unfinished for now. At %2$s, %3$s keeps control of the %4$s before you can %5$s, but the route back is still open.', $mission_name, $landmark, strtolower( $enemy ), $encounter_label, $encounter_objective );
		}

		if ( 'partial' === $result_band ) {
			return sprintf( '%1$s moves your way, but not cleanly. At %2$s, %3$s gives some ground, and the %4$s opens long enough for you to %5$s.', $mission_name, $landmark, strtolower( $enemy ), $encounter_label, $encounter_objective );
		}

		return sprintf( '%1$s breaks your way. At %2$s, %3$s cannot hold the lane, and the %4$s stays with you because you kept finding ways to %5$s.', $mission_name, $landmark, strtolower( $enemy ), $encounter_label, $encounter_objective );
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

	private static function resolve_current_situation( array $mission, string $enemy, string $encounter_type, array $encounter_seed = [] ): string {
		$seed = self::resolve_seed_details( $encounter_seed, $encounter_type, $enemy );

			return sprintf( '%1$s around %2$s is still live. %3$s, and you need to %4$s before %5$s.', self::capitalize_first( $seed['threat'] ), strtolower( $seed['landmark'] ?: $seed['prop'] ), self::capitalize_first( $seed['hazard'] ?: $seed['pressure'] ), strtolower( $seed['objective'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
	}

	private static function build_current_situation( array $state, array $choice, array $roll ): string {
		$band  = sanitize_key( (string) ( $roll['roll_band'] ?? '' ) );
		$encounter_type = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), $encounter_type, (string) ( $state['enemy'] ?? 'threat' ) );

		if ( in_array( $band, [ 'dominant_success', 'strong_success' ], true ) ) {
				return sprintf( 'You have room at %1$s now, but %2$s and the next push still needs to %3$s before %4$s.', strtolower( $seed['landmark'] ?: $seed['prop'] ), strtolower( $seed['hazard'] ?: $seed['pressure'] ), strtolower( $seed['objective'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
		}

		if ( 'failure' === $band || 'struggle' === $band ) {
				return sprintf( '%1$s has the pace for now at %2$s, and the next push needs to buy back room there to %3$s.', self::capitalize_first( $seed['threat'] ), strtolower( $seed['landmark'] ?: $seed['prop'] ), strtolower( $seed['objective'] ) );
		}

			return sprintf( '%1$s is still contested, and you need to %2$s before %3$s.', self::capitalize_first( $seed['landmark'] ?: $seed['prop'] ), strtolower( $seed['objective'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
	}

	private static function build_follow_up_situation( array $state, string $exercise_name, string $set_result, string $encounter_type, array $beat_context = [] ): string {
		$scene_state = self::sanitize_scene_state( (array) ( $state['scene_state'] ?? [] ) );
		$seed = self::resolve_seed_details( $scene_state, $encounter_type, (string) ( $state['enemy'] ?? 'threat' ) );
		$stage = sanitize_key( (string) ( $beat_context['stage'] ?? '' ) );
		$phase = sanitize_key( (string) ( $scene_state['phase'] ?? 'opening' ) );
		$objective_status = sanitize_key( (string) ( $scene_state['objective_status'] ?? 'contested' ) );
		$landmark = $seed['landmark'] ?: $seed['prop'];

		if ( in_array( $set_result, [ 'target_met', 'push_set', 'surge', 'breakthrough', 'recovered' ], true ) ) {
			if ( 'opening' === $stage ) {
				return sprintf( 'The encounter is live now. You have room at %1$s, but the next push still has to secure %2$s before %3$s.', $landmark, strtolower( $seed['objective'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
			}

			if ( 'turning_point' === $phase || 'within_reach' === $objective_status ) {
				return sprintf( 'The objective is finally within reach. %1$s is starting to open for you while %2$s, and %3$s.', $landmark, strtolower( $seed['advance_turn'] ), strtolower( $scene_state['stakes_now'] ?? $seed['stakes'] ) );
			}

			return sprintf( '%1$s is starting to give. You are staying ahead at %2$s while %3$s, and %4$s.', $seed['threat'], $landmark, strtolower( $seed['success_turn'] ), strtolower( $scene_state['stakes_now'] ?? $seed['stakes'] ) );
		}

		if ( in_array( $set_result, [ 'close_call', 'strain', 'slipped' ], true ) ) {
			if ( 'crisis' === $phase || 'slipping' === $objective_status ) {
				return sprintf( '%1$s is one bad turn from collapsing. %2$s, so the next answer at %3$s has to be clean before %4$s.', self::capitalize_first( $seed['objective'] ), self::capitalize_first( $seed['crisis_turn'] ), $landmark, strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
			}

			return sprintf( '%1$s, and one cleaner push will reopen space at %2$s to %3$s before %4$s.', self::capitalize_first( $seed['pressure'] ), $landmark, strtolower( $seed['objective'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
		}

		return sprintf( '%1$s is still pressing in around %2$s. %3$s, so take a short rest and answer it quickly.', $seed['threat'], $landmark, self::capitalize_first( $seed['pressure'] ) );
	}

	private static function build_transition_situation( array $state, string $exercise_name, string $encounter_type ): string {
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), $encounter_type, (string) ( $state['enemy'] ?? 'threat' ) );

		return sprintf( 'One phase is done, but the mission is not. %1$s Beyond %2$s, the next danger is already forming and %3$s.', self::capitalize_first( $seed['transition'] ), strtolower( $seed['landmark'] ?: $seed['prop'] ), strtolower( $seed['stakes'] ?: $seed['pressure'] ) );
	}

	private static function build_next_encounter_choices( array $state, string $exercise_name, string $encounter_type ): array {
		$class_label = self::humanize_slug( (string) ( $state['class_slug'] ?? 'hero' ) );
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), $encounter_type, (string) ( $state['enemy'] ?? 'threat' ) );

		return self::build_scene_specific_choices( $seed, $class_label, $encounter_type, 'transition' );
	}

	private static function build_scene_specific_choices( array $seed, string $class_label, string $encounter_type, string $phase = 'opening' ): array {
		$seed = self::sanitize_scene_state( $seed );
		$phase = sanitize_key( $phase );
		$objective = strtolower( (string) ( $seed['objective'] ?? 'hold the line' ) );
		$threat = strtolower( (string) ( $seed['threat'] ?? 'the threat' ) );
		$prop = strtolower( (string) ( $seed['prop'] ?? $seed['landmark'] ?? 'the line' ) );
		$landmark = strtolower( (string) ( $seed['landmark'] ?? $seed['prop'] ?? 'the ground ahead' ) );
		$hazard = strtolower( (string) ( $seed['hazard'] ?? $seed['pressure'] ?? 'the danger closing in' ) );
		$stakes = strtolower( (string) ( $seed['stakes'] ?? $seed['pressure'] ?? 'the scene turning against you' ) );
		$class_label = strtolower( trim( $class_label ) !== '' ? $class_label : 'hero' );
		$is_transition = 'transition' === $phase;

		$choices = match ( sanitize_key( $encounter_type ) ) {
			'duel', 'close_combat', 'boss_duel' => [
				[
					'id'    => 'break_the_center',
					'tone'  => 'aggressive',
					'label' => $is_transition
						? sprintf( 'Step into %1$s first and force %2$s off balance before the next exchange settles', $landmark, $threat )
						: sprintf( 'Press into %1$s and force %2$s off balance before the next exchange settles', $landmark, $threat ),
				],
				[
					'id'    => 'hold_the_center',
					'tone'  => 'cautious',
					'label' => sprintf( 'Hold %1$s, read the first opening, and %2$s cleanly', $prop, $objective ),
				],
				[
					'id'    => 'bait_the_angle',
					'tone'  => 'creative',
					'label' => sprintf( 'Use your %1$s instincts to bait %2$s into the wrong angle at %3$s', $class_label, $threat, $landmark ),
				],
			],
			'pursuit', 'hunt' => [
				[
					'id'    => 'cut_the_route',
					'tone'  => 'aggressive',
					'label' => sprintf( 'Run hard through %1$s and cut %2$s off before it slips the route', $landmark, $threat ),
				],
				[
					'id'    => 'hold_the_trail',
					'tone'  => 'cautious',
					'label' => sprintf( 'Keep the trail under you at %1$s and %2$s without losing the line', $landmark, $objective ),
				],
				[
					'id'    => 'turn_the_route',
					'tone'  => 'creative',
					'label' => sprintf( 'Use your %1$s instincts to turn %2$s into a false opening for %3$s', $class_label, $hazard, $threat ),
				],
			],
			'rhythm_trial', 'warding' => [
				[
					'id'    => 'break_the_pattern',
					'tone'  => 'aggressive',
					'label' => sprintf( 'Break the pattern at %1$s before %2$s locks in', $landmark, $threat ),
				],
				[
					'id'    => 'steady_the_line',
					'tone'  => 'cautious',
					'label' => sprintf( 'Settle your breathing at %1$s and %2$s before %3$s', $landmark, $objective, $stakes ),
				],
				[
					'id'    => 'steal_the_tempo',
					'tone'  => 'creative',
					'label' => sprintf( 'Use your %1$s instincts to steal the tempo and turn %2$s back on the threat', $class_label, $hazard ),
				],
			],
			'burden', 'breach', 'advance', 'siege' => [
				[
					'id'    => 'drive_the_lane',
					'tone'  => 'aggressive',
					'label' => sprintf( 'Drive through %1$s and %2$s before %3$s can brace', $landmark, $objective, $threat ),
				],
				[
					'id'    => 'anchor_the_ground',
					'tone'  => 'cautious',
					'label' => sprintf( 'Plant yourself at %1$s, absorb the pressure, and %2$s', $landmark, $objective ),
				],
				[
					'id'    => 'turn_the_hazard',
					'tone'  => 'creative',
					'label' => sprintf( 'Use your %1$s instincts to make %2$s work against %3$s', $class_label, $hazard, $threat ),
				],
			],
			default => [
				[
					'id'    => 'force_the_opening',
					'tone'  => 'aggressive',
					'label' => sprintf( 'Force %1$s at %2$s before %3$s settles in', $objective, $landmark, $threat ),
				],
				[
					'id'    => 'hold_the_ground',
					'tone'  => 'cautious',
					'label' => sprintf( 'Hold %1$s, weather %2$s, and buy room to %3$s', $prop, $hazard, $objective ),
				],
				[
					'id'    => 'turn_the_scene',
					'tone'  => 'creative',
					'label' => sprintf( 'Use your %1$s instincts to turn %2$s into an advantage before %3$s', $class_label, $hazard, $stakes ),
				],
			],
		};

		return array_values( $choices );
	}

	private static function build_next_encounter_situation( array $state, string $exercise_name, string $encounter_type, int $encounter_index, int $exercise_count ): string {
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), $encounter_type, (string) ( $state['enemy'] ?? 'threat' ) );
		$encounter_total = $exercise_count > 0 ? sprintf( 'Encounter %1$d of %2$d', max( 1, $encounter_index ), $exercise_count ) : sprintf( 'Encounter %d', max( 1, $encounter_index ) );

		return sprintf( '%1$s is next. %2$s is forming around %3$s, and you need to %4$s before %5$s.', $encounter_total, $seed['threat'], $seed['prop'], strtolower( $seed['objective'] ), strtolower( $seed['pressure'] ) );
	}

	private static function build_next_encounter_prompt( array $state, string $exercise_name, int $encounter_index, int $exercise_count ): string {
		$seed = self::resolve_seed_details( (array) ( $state['scene_state'] ?? [] ), (string) ( $state['encounter_type'] ?? 'skirmish' ), (string) ( $state['enemy'] ?? 'threat' ) );
		if ( $exercise_count > 0 ) {
			return sprintf( 'Choose how you enter encounter %1$d of %2$d at %3$s.', max( 1, $encounter_index ), $exercise_count, strtolower( $seed['prop'] ) );
		}

		return sprintf( 'Choose how you enter the next encounter at %s.', strtolower( $seed['prop'] ) );
	}

	private static function sanitize_encounter_seed( array $seed ): array {
		return [
			'slug'          => sanitize_key( (string) ( $seed['slug'] ?? '' ) ),
			'title'         => sanitize_text_field( (string) ( $seed['title'] ?? '' ) ),
			'objective'     => sanitize_text_field( (string) ( $seed['objective'] ?? '' ) ),
			'threat'        => sanitize_text_field( (string) ( $seed['threat'] ?? '' ) ),
			'prop'          => sanitize_text_field( (string) ( $seed['prop'] ?? '' ) ),
			'landmark'      => sanitize_text_field( (string) ( $seed['landmark'] ?? '' ) ),
			'hazard'        => sanitize_text_field( (string) ( $seed['hazard'] ?? '' ) ),
			'stakes'        => sanitize_text_field( (string) ( $seed['stakes'] ?? '' ) ),
			'enemy_posture' => sanitize_text_field( (string) ( $seed['enemy_posture'] ?? '' ) ),
			'sensory_detail'=> sanitize_text_field( (string) ( $seed['sensory_detail'] ?? '' ) ),
			'pressure'      => sanitize_text_field( (string) ( $seed['pressure'] ?? '' ) ),
			'success_turn'  => sanitize_text_field( (string) ( $seed['success_turn'] ?? '' ) ),
			'advance_turn'  => sanitize_text_field( (string) ( $seed['advance_turn'] ?? '' ) ),
			'struggle_turn' => sanitize_text_field( (string) ( $seed['struggle_turn'] ?? '' ) ),
			'crisis_turn'   => sanitize_text_field( (string) ( $seed['crisis_turn'] ?? '' ) ),
			'transition'    => sanitize_text_field( (string) ( $seed['transition'] ?? '' ) ),
		];
	}

	private static function sanitize_scene_state( array $scene_state ): array {
		return [
			'slug'           => sanitize_key( (string) ( $scene_state['slug'] ?? '' ) ),
			'title'          => sanitize_text_field( (string) ( $scene_state['title'] ?? '' ) ),
			'objective'      => sanitize_text_field( (string) ( $scene_state['objective'] ?? '' ) ),
			'threat'         => sanitize_text_field( (string) ( $scene_state['threat'] ?? '' ) ),
			'prop'           => sanitize_text_field( (string) ( $scene_state['prop'] ?? '' ) ),
			'landmark'       => sanitize_text_field( (string) ( $scene_state['landmark'] ?? '' ) ),
			'hazard'         => sanitize_text_field( (string) ( $scene_state['hazard'] ?? '' ) ),
			'stakes'         => sanitize_text_field( (string) ( $scene_state['stakes'] ?? '' ) ),
			'enemy_posture'  => sanitize_text_field( (string) ( $scene_state['enemy_posture'] ?? '' ) ),
			'sensory_detail' => sanitize_text_field( (string) ( $scene_state['sensory_detail'] ?? '' ) ),
			'pressure'       => sanitize_text_field( (string) ( $scene_state['pressure'] ?? '' ) ),
			'success_turn'   => sanitize_text_field( (string) ( $scene_state['success_turn'] ?? '' ) ),
			'advance_turn'   => sanitize_text_field( (string) ( $scene_state['advance_turn'] ?? '' ) ),
			'struggle_turn'  => sanitize_text_field( (string) ( $scene_state['struggle_turn'] ?? '' ) ),
			'crisis_turn'    => sanitize_text_field( (string) ( $scene_state['crisis_turn'] ?? '' ) ),
			'transition'     => sanitize_text_field( (string) ( $scene_state['transition'] ?? '' ) ),
			'current_visual' => sanitize_text_field( (string) ( $scene_state['current_visual'] ?? '' ) ),
			'stakes_now'     => sanitize_text_field( (string) ( $scene_state['stakes_now'] ?? '' ) ),
			'status'         => sanitize_key( (string) ( $scene_state['status'] ?? 'contested' ) ),
			'phase'          => sanitize_key( (string) ( $scene_state['phase'] ?? 'opening' ) ),
			'objective_status' => sanitize_key( (string) ( $scene_state['objective_status'] ?? 'threatened' ) ),
			'beat_index'     => max( 0, (int) ( $scene_state['beat_index'] ?? 0 ) ),
			'last_turn'      => sanitize_text_field( (string) ( $scene_state['last_turn'] ?? '' ) ),
			'encounter_index'=> max( 1, (int) ( $scene_state['encounter_index'] ?? 1 ) ),
			'encounter_total'=> max( 0, (int) ( $scene_state['encounter_total'] ?? 0 ) ),
		];
	}

	private static function resolve_encounter_seed( array $mission, int $encounter_index, string $encounter_type, string $enemy ): array {
		$seeds = array_values( array_filter( array_map( [ __CLASS__, 'sanitize_encounter_seed' ], (array) ( $mission['encounter_seeds'] ?? [] ) ) ) );
		if ( empty( $seeds ) ) {
			return self::build_default_encounter_seed( $encounter_index, $encounter_type, $enemy );
		}

		$seed_count = count( $seeds );
		$index = min( max( 1, $encounter_index ), $seed_count ) - 1;
		$seed  = $seeds[ $index ] ?? [];

		if ( $encounter_index > $seed_count ) {
			$seed = self::build_overflow_encounter_seed( $seeds[ $seed_count - 1 ] ?? [], $encounter_index, $encounter_type, $enemy, $encounter_index - $seed_count );
		}

		return self::resolve_seed_details( $seed, $encounter_type, $enemy, $encounter_index );
	}

	private static function build_overflow_encounter_seed( array $seed, int $encounter_index, string $encounter_type, string $enemy, int $overflow_index ): array {
		$base = self::resolve_seed_details( $seed, $encounter_type, $enemy, max( 1, $encounter_index - 1 ) );
		$late_prop = 1 === $overflow_index
			? sprintf( 'the far side of %s', strtolower( $base['prop'] ) )
			: sprintf( 'the last span beyond %s', strtolower( $base['prop'] ) );

		return [
			'slug'          => sanitize_key( sprintf( '%s_%d', $base['slug'], max( 1, $encounter_index ) ) ),
			'title'         => 1 === $overflow_index ? sprintf( '%s Final Push', $base['title'] ) : sprintf( '%s Last Stand', $base['title'] ),
			'objective'     => sprintf( 'lock down %s before the mission slips', $late_prop ),
			'threat'        => $base['threat'],
			'prop'          => $late_prop,
			'pressure'      => sprintf( 'the last safe angle around %s is closing fast', $late_prop ),
			'success_turn'  => sprintf( 'you turn %s into a foothold and the mission finally opens', $late_prop ),
			'advance_turn'  => sprintf( 'your momentum starts carrying past %s instead of stalling there', strtolower( $base['prop'] ) ),
			'struggle_turn' => sprintf( 'the fight keeps getting dragged back toward %s', strtolower( $base['prop'] ) ),
			'crisis_turn'   => sprintf( 'the final stretch around %s is starting to cave in', $late_prop ),
			'transition'    => sprintf( '%s finally breaks, but the mission still wants a clean exit', self::capitalize_first( $late_prop ) ),
		];
	}

	private static function build_default_encounter_seed( int $encounter_index, string $encounter_type, string $enemy ): array {
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_prop  = self::encounter_scene_prop( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		return self::resolve_seed_details(
			[
				'slug'          => 'encounter_' . max( 1, $encounter_index ),
					'title'         => sprintf( 'Encounter %d', max( 1, $encounter_index ) ),
					'objective'     => $encounter_objective,
					'threat'        => $enemy,
					'prop'          => $encounter_prop,
					'landmark'      => self::encounter_landmark( $encounter_type ),
					'hazard'        => self::encounter_hazard( $encounter_type ),
					'stakes'        => self::encounter_stakes( $encounter_type ),
					'enemy_posture' => self::encounter_enemy_posture( $encounter_type, $enemy ),
					'sensory_detail'=> self::encounter_sensory_detail( $encounter_type ),
					'pressure'      => sprintf( 'the %s locks in', strtolower( $encounter_label ) ),
					'success_turn'  => self::encounter_success_phrase( $encounter_type ),
					'struggle_turn' => self::encounter_pressure_phrase( $encounter_type ),
				'transition'    => self::encounter_transition_phrase( $encounter_type ),
			],
			$encounter_type,
			$enemy,
			$encounter_index
		);
	}

	private static function encounter_scene_prop( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'burden march',
			'breach' => 'breach lane',
			'duel' => 'duel line',
			'rhythm_trial' => 'machine tempo',
			'advance' => 'forward lane',
			'pursuit' => 'running route',
			'warding' => 'ward circle',
			'siege' => 'siege line',
			'hunt' => 'hunt line',
			'close_combat' => 'close-quarters line',
			default => self::encounter_flavor_label( $encounter_type ),
		};
	}

	private static function encounter_landmark( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'the broken causeway',
			'breach' => 'the splintered gate mouth',
			'duel' => 'the marked center lane',
			'rhythm_trial' => 'the iron gear dais',
			'advance' => 'the narrowing stair run',
			'pursuit' => 'the switchback route',
			'warding' => 'the cracked ward stones',
			'siege' => 'the half-fallen gatehouse',
			'hunt' => 'the thorn-choked game trail',
			'close_combat' => 'the torchlit choke point',
			default => 'the contested ground',
		};
	}

	private static function encounter_hazard( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'the stones are slick and dropping away under the load',
			'breach' => 'shattered beams and jagged barricade teeth are collapsing inward',
			'duel' => 'one wrong step leaves you exposed in the open lane',
			'rhythm_trial' => 'the iron mechanism keeps trying to steal your timing',
			'advance' => 'the stairs shorten your breathing and punish hesitation',
			'pursuit' => 'the route bends blind and keeps trying to spill you wide',
			'warding' => 'the ward line flickers whenever your stance loosens',
			'siege' => 'stone dust and splinters keep raining off the battered wall',
			'hunt' => 'roots and low branches keep turning the ground underfoot',
			'close_combat' => 'there is no room to give ground without losing the choke point',
			default => 'the ground keeps turning against you',
		};
	}

	private static function encounter_stakes( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'the route will fold if the burden owns your posture',
			'breach' => 'the opening will seal if the lane is not forced now',
			'duel' => 'the clean line will belong to the enemy if you lose the center',
			'rhythm_trial' => 'the mechanism will set the pace of the whole encounter if you let it',
			'advance' => 'the climb will stall and throw the whole push backward',
			'pursuit' => 'the quarry will slip the route and take the advantage with it',
			'warding' => 'the circle will break and expose everything behind it',
			'siege' => 'the gate will hold if your pressure breaks before the wall does',
			'hunt' => 'the trail will disappear if you lose the opening now',
			'close_combat' => 'the choke point will be overrun if you give up the inside line',
			default => 'the mission will settle against you if you lose this space',
		};
	}

	private static function encounter_enemy_posture( string $encounter_type, string $enemy ): string {
		$enemy_label = '' !== trim( $enemy ) ? strtolower( $enemy ) : 'the threat';
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => sprintf( '%s keeps leaning its full weight into the crossing', $enemy_label ),
			'breach' => sprintf( '%s is braced behind the choke point and waiting for you to slow', $enemy_label ),
			'duel' => sprintf( '%s is squared up in the lane and daring you to blink first', $enemy_label ),
			'rhythm_trial' => sprintf( '%s is riding the machine tempo and trying to trap you inside it', $enemy_label ),
			'advance' => sprintf( '%s keeps backing up just enough to drag you into a worse angle', $enemy_label ),
			'pursuit' => sprintf( '%s is skimming the edge of the route and refusing a clean catch', $enemy_label ),
			'warding' => sprintf( '%s keeps pressing the weak seams of the circle', $enemy_label ),
			'siege' => sprintf( '%s is dug in behind the broken wall and absorbing the first impact', $enemy_label ),
			'hunt' => sprintf( '%s keeps slipping between cover and forcing the chase longer', $enemy_label ),
			'close_combat' => sprintf( '%s is crowding the choke point and trying to own the inside line', $enemy_label ),
			default => sprintf( '%s is pressing the contested ground and refusing to give it up', $enemy_label ),
		};
	}

	private static function encounter_sensory_detail( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'stone grit skids underfoot and every breath sounds too loud',
			'breach' => 'splinters snap and old hinges scream in the strain',
			'duel' => 'every foot scrape carries across the lane like a challenge',
			'rhythm_trial' => 'iron teeth chatter and the whole platform hums under tension',
			'advance' => 'air burns in the throat while the stairwell echoes each step back at you',
			'pursuit' => 'cold wind cuts across the route and loose gravel keeps shifting',
			'warding' => 'ozone and candle smoke hang over the circle',
			'siege' => 'stone dust hangs in the air and the wall booms under each hit',
			'hunt' => 'wet leaves slap at your boots and branches hiss in the dark',
			'close_combat' => 'torch smoke and hot breath make the choke point feel even tighter',
			default => 'the air feels close and every sound comes back sharper than it should',
		};
	}

	private static function build_scene_visual( array $scene, string $phase = '', string $status = '' ): string {
		$phase = '' !== $phase ? sanitize_key( $phase ) : sanitize_key( (string) ( $scene['phase'] ?? 'opening' ) );
		$status = '' !== $status ? sanitize_key( $status ) : sanitize_key( (string) ( $scene['status'] ?? 'contested' ) );
		$landmark = strtolower( (string) ( $scene['landmark'] ?? $scene['prop'] ?? 'the contested ground' ) );
		$hazard = strtolower( (string) ( $scene['hazard'] ?? $scene['pressure'] ?? 'the danger keeps closing' ) );
		$enemy_posture = trim( (string) ( $scene['enemy_posture'] ?? '' ) );
		$sensory = trim( (string) ( $scene['sensory_detail'] ?? '' ) );

		if ( 'transition' === $phase ) {
			return sprintf( 'The space around %1$s is finally open for a breath, but %2$s.', $landmark, strtolower( (string) ( $scene['transition'] ?? $hazard ) ) );
		}

		if ( 'turning_point' === $phase || 'advantage' === $status ) {
			return sprintf( 'At %1$s, %2$s, and %3$s.', $landmark, strtolower( $enemy_posture ?: 'the threat is finally giving ground' ), $sensory ?: $hazard );
		}

		if ( 'crisis' === $phase || 'losing_ground' === $status ) {
			return sprintf( 'Around %1$s, %2$s, and %3$s.', $landmark, strtolower( $hazard ), $enemy_posture ?: 'the threat is closing fast' );
		}

		return sprintf( 'At %1$s, %2$s, and %3$s.', $landmark, strtolower( $hazard ), $enemy_posture ?: 'the threat keeps testing the line' );
	}

	private static function build_scene_enemy_posture( array $scene, string $mode ): string {
		$base = trim( (string) ( $scene['enemy_posture'] ?? '' ) );
		$base = '' !== $base ? rtrim( $base, ". \t\n\r\0\x0B" ) : strtolower( (string) ( $scene['threat'] ?? 'the threat keeps pressing the ground' ) );
		$landmark = strtolower( (string) ( $scene['landmark'] ?? $scene['prop'] ?? 'the line' ) );

		return match ( sanitize_key( $mode ) ) {
			'opening_advantage' => sprintf( '%s, but it finally checks its advance at %s', $base, $landmark ),
			'opening_loss' => sprintf( '%s, and now it is coming harder through %s', $base, $landmark ),
			'set_advantage' => sprintf( '%s, but the clean line through %s is starting to slip away from it', $base, $landmark ),
			'set_turning_point' => sprintf( '%s, but it is finally being driven off the ground it wanted at %s', $base, $landmark ),
			'set_crisis' => sprintf( '%s, and it keeps finding the weak side around %s', $base, $landmark ),
			'set_loss' => sprintf( '%s, and now it is flooding %s faster than before', $base, $landmark ),
			default => $base,
		};
	}

	private static function build_scene_stakes_now( array $scene, string $mode ): string {
		$objective = strtolower( (string) ( $scene['objective'] ?? 'finish the exchange' ) );
		$stakes = strtolower( (string) ( $scene['stakes'] ?? '' ) );
		$hazard = strtolower( (string) ( $scene['hazard'] ?? $scene['pressure'] ?? 'the scene turns against you' ) );
		$landmark = strtolower( (string) ( $scene['landmark'] ?? $scene['prop'] ?? 'the line' ) );
		$stakes_clause = '' !== $stakes ? $stakes : $hazard;

		return match ( sanitize_key( $mode ) ) {
			'opening_advantage' => sprintf( 'one cleaner push could %s before %s', $objective, $stakes_clause ),
			'opening_contested' => sprintf( 'the next exchange has to %s before %s', $objective, $stakes_clause ),
			'opening_loss' => sprintf( 'if you cannot %s soon, %s', $objective, $stakes_clause ),
			'transition' => sprintf( 'the opening at %s is yours for a breath, but %s', $landmark, strtolower( (string) ( $scene['transition'] ?? 'the next danger is already forming' ) ) ),
			'set_turning_point' => sprintf( 'one more clean answer could %s before %s', $objective, $stakes_clause ),
			'set_advantage' => sprintf( 'hold the gain around %s before %s', $landmark, $stakes_clause ),
			'set_escalation' => sprintf( 'the next push has to stabilize %s before %s', $landmark, $stakes_clause ),
			'set_crisis' => sprintf( 'one bad exchange could cost you %s', $stakes_clause ),
			'set_loss' => sprintf( 'if you do not answer now, %s', $stakes_clause ),
			default => $stakes_clause,
		};
	}

	private static function resolve_seed_details( array $seed, string $encounter_type, string $enemy, int $encounter_index = 1 ): array {
		$clean = self::sanitize_encounter_seed( $seed );
		$encounter_label = self::encounter_flavor_label( $encounter_type );
		$encounter_objective = self::encounter_objective_phrase( $encounter_type );

		$clean['slug'] = '' !== $clean['slug'] ? $clean['slug'] : 'encounter_' . max( 1, $encounter_index );
		$clean['title'] = '' !== $clean['title'] ? $clean['title'] : sprintf( 'Encounter %d', max( 1, $encounter_index ) );
			$clean['objective'] = '' !== $clean['objective'] ? $clean['objective'] : $encounter_objective;
			$clean['threat'] = '' !== $clean['threat'] ? $clean['threat'] : $enemy;
			$clean['prop'] = '' !== $clean['prop'] ? $clean['prop'] : self::encounter_scene_prop( $encounter_type );
			$clean['landmark'] = '' !== $clean['landmark'] ? $clean['landmark'] : self::encounter_landmark( $encounter_type );
			$clean['hazard'] = '' !== $clean['hazard'] ? $clean['hazard'] : self::encounter_hazard( $encounter_type );
			$clean['stakes'] = '' !== $clean['stakes']
				? $clean['stakes']
				: ( '' !== $clean['objective'] ? $clean['objective'] : self::encounter_stakes( $encounter_type ) );
			$clean['enemy_posture'] = '' !== $clean['enemy_posture'] ? $clean['enemy_posture'] : self::encounter_enemy_posture( $encounter_type, $clean['threat'] );
			$clean['sensory_detail'] = '' !== $clean['sensory_detail'] ? $clean['sensory_detail'] : self::encounter_sensory_detail( $encounter_type );
			$clean['pressure'] = '' !== $clean['pressure'] ? $clean['pressure'] : sprintf( 'the %s locks in around you', strtolower( $encounter_label ) );
		$clean['success_turn'] = '' !== $clean['success_turn'] ? $clean['success_turn'] : self::encounter_success_phrase( $encounter_type );
		$clean['advance_turn'] = '' !== $clean['advance_turn'] ? $clean['advance_turn'] : sprintf( '%s starts widening under your control', $clean['prop'] );
		$clean['struggle_turn'] = '' !== $clean['struggle_turn'] ? $clean['struggle_turn'] : self::encounter_pressure_phrase( $encounter_type );
		$clean['crisis_turn'] = '' !== $clean['crisis_turn'] ? $clean['crisis_turn'] : sprintf( 'the last safe angle around %s is starting to collapse', strtolower( $clean['prop'] ) );
		$clean['transition'] = '' !== $clean['transition'] ? $clean['transition'] : self::encounter_transition_phrase( $encounter_type );

			return $clean;
		}

	private static function build_scene_state_from_seed( array $encounter_seed, int $encounter_index, int $encounter_total ): array {
		$seed = self::sanitize_scene_state( $encounter_seed );
		return array_merge(
			$seed,
			[
				'status'          => 'contested',
				'phase'           => 'opening',
				'objective_status'=> 'threatened',
				'beat_index'      => 0,
				'current_visual'  => self::build_scene_visual( $seed, 'opening', 'contested' ),
				'stakes_now'      => (string) ( $seed['stakes'] ?? '' ),
				'last_turn'       => '',
				'encounter_index' => max( 1, $encounter_index ),
				'encounter_total' => max( 0, $encounter_total ),
			]
		);
	}

	private static function update_scene_state_for_opening( array $scene_state, string $roll_band ): array {
		$scene = self::sanitize_scene_state( $scene_state );
		if ( in_array( sanitize_key( $roll_band ), [ 'dominant_success', 'strong_success' ], true ) ) {
			$scene['status'] = 'advantage';
			$scene['objective_status'] = 'contested';
			$scene['enemy_posture'] = self::build_scene_enemy_posture( $scene, 'opening_advantage' );
			$scene['current_visual'] = self::build_scene_visual( $scene, 'opening', 'advantage' );
			$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'opening_advantage' );
			$scene['last_turn'] = $scene['success_turn'];
			return $scene;
		}

		if ( in_array( sanitize_key( $roll_band ), [ 'moderate_success', 'low_success' ], true ) ) {
			$scene['status'] = 'contested';
			$scene['objective_status'] = 'under_pressure';
			$scene['enemy_posture'] = self::build_scene_enemy_posture( $scene, 'contested' );
			$scene['current_visual'] = self::build_scene_visual( $scene, 'opening', 'contested' );
			$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'opening_contested' );
			$scene['last_turn'] = $scene['pressure'];
			return $scene;
		}

		$scene['status'] = 'losing_ground';
		$scene['objective_status'] = 'slipping';
		$scene['enemy_posture'] = self::build_scene_enemy_posture( $scene, 'opening_loss' );
		$scene['current_visual'] = self::build_scene_visual( $scene, 'opening', 'losing_ground' );
		$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'opening_loss' );
		$scene['last_turn'] = $scene['struggle_turn'];
		return $scene;
	}

	private static function update_scene_state_for_set( array $scene_state, array $encounter_seed, string $set_result, bool $completed_exercise, array $beat_context = [] ): array {
		$scene = array_merge( self::sanitize_scene_state( $scene_state ), self::sanitize_scene_state( $encounter_seed ) );
		$scene['beat_index'] = max( 0, (int) ( $scene['beat_index'] ?? 0 ) ) + 1;
		$stage = sanitize_key( (string) ( $beat_context['stage'] ?? '' ) );

		if ( $completed_exercise ) {
			$scene['status'] = in_array( sanitize_key( $set_result ), [ 'target_met', 'push_set', 'breakthrough', 'surge', 'recovered' ], true ) ? 'secured' : 'scarred';
			$scene['phase'] = 'transition';
			$scene['objective_status'] = 'secured';
			$scene['current_visual'] = self::build_scene_visual( $scene, 'transition', (string) $scene['status'] );
			$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'transition' );
			$scene['last_turn'] = $scene['transition'];
			return $scene;
		}

		if ( in_array( sanitize_key( $set_result ), [ 'target_met', 'push_set', 'surge', 'breakthrough', 'recovered' ], true ) ) {
			$scene['status'] = 'advantage';
			$scene['phase'] = ( 'closing' === $stage || $scene['beat_index'] >= 2 || in_array( sanitize_key( $set_result ), [ 'surge', 'breakthrough', 'recovered' ], true ) ) ? 'turning_point' : 'escalation';
			$scene['objective_status'] = 'turning_point' === $scene['phase'] ? 'within_reach' : 'contested';
			$scene['enemy_posture'] = self::build_scene_enemy_posture( $scene, 'turning_point' === $scene['phase'] ? 'set_turning_point' : 'set_advantage' );
			$scene['current_visual'] = self::build_scene_visual( $scene, (string) $scene['phase'], 'advantage' );
			$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'turning_point' === $scene['phase'] ? 'set_turning_point' : 'set_advantage' );
			$scene['last_turn'] = 'turning_point' === $scene['phase'] ? $scene['advance_turn'] : $scene['success_turn'];
			return $scene;
		}

		if ( in_array( sanitize_key( $set_result ), [ 'close_call', 'strain' ], true ) ) {
			$scene['status'] = 'contested';
			$scene['phase'] = ( 'closing' === $stage || $scene['beat_index'] >= 2 ) ? 'crisis' : 'escalation';
			$scene['objective_status'] = 'under_pressure';
			$scene['enemy_posture'] = self::build_scene_enemy_posture( $scene, 'crisis' === $scene['phase'] ? 'set_crisis' : 'contested' );
			$scene['current_visual'] = self::build_scene_visual( $scene, (string) $scene['phase'], 'contested' );
			$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'crisis' === $scene['phase'] ? 'set_crisis' : 'set_escalation' );
			$scene['last_turn'] = 'crisis' === $scene['phase'] ? $scene['crisis_turn'] : $scene['pressure'];
			return $scene;
		}

		$scene['status'] = 'losing_ground';
		$scene['phase'] = 'crisis';
		$scene['objective_status'] = 'slipping';
		$scene['enemy_posture'] = self::build_scene_enemy_posture( $scene, 'set_loss' );
		$scene['current_visual'] = self::build_scene_visual( $scene, 'crisis', 'losing_ground' );
		$scene['stakes_now'] = self::build_scene_stakes_now( $scene, 'set_loss' );
		$scene['last_turn'] = $scene['crisis_turn'];
		return $scene;
	}

	private static function resolve_scene_turn_text( array $scene_state, string $set_result, bool $completed_exercise ): string {
		$scene = self::sanitize_scene_state( $scene_state );

		if ( $completed_exercise ) {
			return $scene['transition'];
		}

		if ( 'turning_point' === (string) ( $scene['phase'] ?? '' ) && '' !== $scene['advance_turn'] ) {
			return $scene['advance_turn'];
		}

		if ( 'crisis' === (string) ( $scene['phase'] ?? '' ) && '' !== $scene['crisis_turn'] ) {
			return $scene['crisis_turn'];
		}

		if ( in_array( sanitize_key( $set_result ), [ 'target_met', 'push_set', 'surge', 'breakthrough', 'recovered' ], true ) ) {
			return $scene['success_turn'];
		}

		if ( in_array( sanitize_key( $set_result ), [ 'close_call', 'strain' ], true ) ) {
			return $scene['pressure'];
		}

		return $scene['struggle_turn'];
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

	private static function encounter_success_phrase( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'the load stays obedient instead of punishing your frame',
			'breach' => 'a fresh gap opens through the resistance in front of you',
			'duel' => 'a clean answer lands on one exposed weakness',
			'rhythm_trial' => 'the machine tempo snaps back into your hands',
			'advance' => 'the march keeps moving and denies the stall',
			'pursuit' => 'the chase stays in your favor before the route bends away',
			'warding' => 'the circle steadies and refuses the collapse',
			'siege' => 'the battering line stays heavy and relentless',
			'hunt' => 'the opening stays pinned before the prey can slip free',
			'close_combat' => 'you stay chest-to-chest and on the stronger side of the clash',
			default => 'the momentum stays tilted toward you',
		};
	}

	private static function encounter_pressure_phrase( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'the load is starting to pull at your structure',
			'breach' => 'the lane is clogging up faster than you want',
			'duel' => 'the single-target duel is getting exacting and mean',
			'rhythm_trial' => 'the machine tempo is trying to trap you in its pattern',
			'advance' => 'the march is shortening your room to recover',
			'pursuit' => 'the route is slipping and asking for speed you may not have yet',
			'warding' => 'the circle is wavering and wants you to break first',
			'siege' => 'the siege line is grinding into your breathing',
			'hunt' => 'the hunt is tightening every time you hesitate',
			'close_combat' => 'the close-quarters exchange is getting crowded and violent',
			default => 'the encounter is escalating faster than you want',
		};
	}

	private static function encounter_transition_phrase( string $encounter_type ): string {
		return match ( sanitize_key( $encounter_type ) ) {
			'burden' => 'the demand of the mission is still riding on your frame',
			'breach' => 'the mission is already shoving fresh resistance into the gap you opened',
			'duel' => 'the mission is already choosing the next weak point for you',
			'rhythm_trial' => 'the next stretch is already trying to set a new machine pace',
			'advance' => 'the march is not done asking for control',
			'pursuit' => 'the chase is already bending toward the next turn',
			'warding' => 'the next stretch wants to break the circle from another angle',
			'siege' => 'the wall behind the broken line still has to come down',
			'hunt' => 'the prey is already being drawn somewhere else',
			'close_combat' => 'another body and another angle are already waiting immediately after',
			default => 'the mission is already shaping the next exchange',
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
			$normalized['debug_prompt'] = sanitize_textarea_field( (string) ( $state['debug_prompt'] ?? '' ) );
			$normalized['enemy'] = sanitize_text_field( (string) ( $state['enemy'] ?? '' ) );
		$normalized['encounter_type'] = sanitize_key( (string) ( $state['encounter_type'] ?? 'skirmish' ) );
		$normalized['encounter_seed'] = self::sanitize_encounter_seed( (array) ( $state['encounter_seed'] ?? [] ) );
		$normalized['scene_state'] = self::sanitize_scene_state( (array) ( $state['scene_state'] ?? [] ) );
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
		$normalized['story_engine'] = self::sanitize_story_engine_state( (array) ( $state['story_engine'] ?? [] ) );
		$normalized['conclusion'] = [
			'title'    => sanitize_text_field( (string) ( $state['conclusion']['title'] ?? '' ) ),
			'summary'  => sanitize_textarea_field( (string) ( $state['conclusion']['summary'] ?? '' ) ),
			'epilogue' => sanitize_textarea_field( (string) ( $state['conclusion']['epilogue'] ?? '' ) ),
		];
		$profile = null;
		if ( ! array_key_exists( 'hp_current', $state ) || ! array_key_exists( 'hp_max', $state ) ) {
			$profile = IronQuestProfileService::ensure_profile( $user_id );
		}
		$normalized['hp_current'] = max( 0, (int) ( $state['hp_current'] ?? $profile['hp_current'] ?? 100 ) );
		$normalized['hp_max'] = max( 1, (int) ( $state['hp_max'] ?? $profile['hp_max'] ?? 100 ) );
		$normalized['hp_loss_this_set'] = max( 0, (int) ( $state['hp_loss_this_set'] ?? 0 ) );
		$normalized['result_band'] = sanitize_key( (string) ( $state['result_band'] ?? '' ) );
		$normalized['class_slug'] = sanitize_key( (string) ( $state['class_slug'] ?? $profile['class_slug'] ?? '' ) );

		return $normalized;
	}

	private static function build_story_engine_set_progression_bundle( array $mission, array $run, array $state, array $payload, array $encounter_seed, array $scene_state, bool $completed_exercise ): array {
		if ( $completed_exercise || empty( $mission['beat_templates'] ) ) {
			return [];
		}

		$slot = sanitize_key( (string) ( $payload['slot'] ?? 'set_progression' ) );
		if ( 'set_progression' !== $slot ) {
			return [];
		}

		$request = IronQuestStoryEngineService::build_beat_request( $run, $state, $payload, $slot );
		$candidate = IronQuestStoryEngineService::select_candidate( $mission, $request, $state );
		if ( ! is_array( $candidate ) ) {
			return [];
		}

		$rendered = IronQuestStoryEngineService::render_candidate( $candidate, $encounter_seed, $scene_state, $request );
		$state_for_record = $state;
		$state_for_record['story_profile'] = is_array( $mission['story_profile'] ?? null ) ? $mission['story_profile'] : [];
		$state_for_record['encounter_seed'] = $encounter_seed;
		$updated_state = IronQuestStoryEngineService::record_selection( $state_for_record, $candidate, $rendered );

		return [
			'latest_beat' => sanitize_textarea_field( (string) ( $rendered['draft']['summary'] ?? '' ) ),
			'current_situation' => sanitize_textarea_field( (string) ( $rendered['draft']['follow_up'] ?? '' ) ),
			'decision_prompt' => sanitize_text_field( (string) ( $rendered['draft']['decision_prompt'] ?? '' ) ),
			'draft' => [
				'summary' => sanitize_textarea_field( (string) ( $rendered['draft']['summary'] ?? '' ) ),
				'follow_up' => sanitize_textarea_field( (string) ( $rendered['draft']['follow_up'] ?? '' ) ),
				'decision_prompt' => sanitize_text_field( (string) ( $rendered['draft']['decision_prompt'] ?? '' ) ),
			],
			'template' => [
				'id' => sanitize_key( (string) ( $candidate['id'] ?? '' ) ),
				'slot' => sanitize_key( (string) ( $candidate['slot'] ?? '' ) ),
				'tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $candidate['tags'] ?? [] ) ) ) ),
			],
			'story_engine' => self::sanitize_story_engine_state( (array) ( $updated_state['story_engine'] ?? [] ) ),
		];
	}

	private static function build_story_engine_transition_bundle( array $mission, array $run, array $state, array $current_exercise, array $next_encounter, array $next_scene_state ): array {
		if ( empty( $mission['beat_templates'] ) ) {
			return [];
		}

		$next_encounter_seed = is_array( $next_encounter['encounter_seed'] ?? null ) ? $next_encounter['encounter_seed'] : [];
		if ( [] === $next_encounter_seed ) {
			return [];
		}

		$slot = 'transition_setup';
		$state_for_request = $state;
		$state_for_request['encounter_seed'] = $next_encounter_seed;
		$state_for_request['scene_state'] = $next_scene_state;

		$request = IronQuestStoryEngineService::build_beat_request(
			$run,
			$state_for_request,
			[
				'slot' => $slot,
				'stage' => 'transition',
				'tension' => (string) ( $state['tension'] ?? 'rising' ),
				'stance' => (string) ( $state['stance'] ?? 'steady' ),
				'progress_phase' => 'transition',
				'set_result' => (string) ( $current_exercise['set_result'] ?? '' ),
				'previous_landmark' => (string) ( $state['encounter_seed']['landmark'] ?? '' ),
				'previous_objective' => (string) ( $state['encounter_seed']['objective'] ?? '' ),
			],
			$slot
		);
		$candidate = IronQuestStoryEngineService::select_candidate( $mission, $request, $state_for_request );
		if ( ! is_array( $candidate ) ) {
			return [];
		}

		$rendered = IronQuestStoryEngineService::render_candidate( $candidate, $next_encounter_seed, $next_scene_state, $request );
		$state_for_record = $state_for_request;
		$state_for_record['story_profile'] = is_array( $mission['story_profile'] ?? null ) ? $mission['story_profile'] : [];
		$updated_state = IronQuestStoryEngineService::record_selection( $state_for_record, $candidate, $rendered );

		return [
			'latest_beat' => sanitize_textarea_field( (string) ( $rendered['draft']['summary'] ?? '' ) ),
			'current_situation' => sanitize_textarea_field( (string) ( $rendered['draft']['follow_up'] ?? '' ) ),
			'decision_prompt' => sanitize_text_field( (string) ( $rendered['draft']['decision_prompt'] ?? '' ) ),
			'draft' => [
				'summary' => sanitize_textarea_field( (string) ( $rendered['draft']['summary'] ?? '' ) ),
				'follow_up' => sanitize_textarea_field( (string) ( $rendered['draft']['follow_up'] ?? '' ) ),
				'decision_prompt' => sanitize_text_field( (string) ( $rendered['draft']['decision_prompt'] ?? '' ) ),
			],
			'template' => [
				'id' => sanitize_key( (string) ( $candidate['id'] ?? '' ) ),
				'slot' => sanitize_key( (string) ( $candidate['slot'] ?? '' ) ),
				'tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $candidate['tags'] ?? [] ) ) ) ),
			],
			'story_engine' => self::sanitize_story_engine_state( (array) ( $updated_state['story_engine'] ?? [] ) ),
		];
	}

	private static function sanitize_story_engine_state( array $story_engine ): array {
		$slot_counts = [];
		foreach ( (array) ( $story_engine['slot_counts'] ?? [] ) as $key => $value ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key ) {
				continue;
			}

			$slot_counts[ $key ] = max( 0, (int) $value );
		}

		return [
			'recent_template_ids' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $story_engine['recent_template_ids'] ?? [] ) ) ) ),
			'recent_tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $story_engine['recent_tags'] ?? [] ) ) ) ),
			'recent_phrases' => array_values( array_filter( array_map( 'sanitize_textarea_field', (array) ( $story_engine['recent_phrases'] ?? [] ) ) ) ),
			'slot_counts' => $slot_counts,
			'last_selected' => [
				'template_id' => sanitize_key( (string) ( $story_engine['last_selected']['template_id'] ?? '' ) ),
				'slot' => sanitize_key( (string) ( $story_engine['last_selected']['slot'] ?? '' ) ),
				'encounter_seed_slug' => sanitize_key( (string) ( $story_engine['last_selected']['encounter_seed_slug'] ?? '' ) ),
			],
			'variation_seed' => sanitize_text_field( (string) ( $story_engine['variation_seed'] ?? '' ) ),
		];
	}

	private static function resolve_hp_loss_for_set( string $set_result, array $beat_context ): int {
		$strain = sanitize_key( (string) ( $beat_context['strain'] ?? '' ) );
		$set_result = sanitize_key( $set_result );

		if ( 'high' === $strain || in_array( $set_result, [ 'slipped', 'struggle' ], true ) ) {
			return 2;
		}

		if ( 'medium' === $strain || in_array( $set_result, [ 'close_call', 'strain' ], true ) ) {
			return 1;
		}

		return 0;
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
