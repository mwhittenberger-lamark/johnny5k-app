<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestStoryEngineService {
	public static function build_beat_request( array $run, array $story_state, array $payload = [], string $slot = '' ): array {
		$story_engine = is_array( $story_state['story_engine'] ?? null ) ? $story_state['story_engine'] : [];
		$scene_state = is_array( $story_state['scene_state'] ?? null ) ? $story_state['scene_state'] : [];
		$encounter_seed = is_array( $story_state['encounter_seed'] ?? null ) ? $story_state['encounter_seed'] : [];
		$resolved_slot = sanitize_key( $slot ?: (string) ( $payload['slot'] ?? '' ) );

		return [
			'mission_slug' => sanitize_key( (string) ( $run['mission_slug'] ?? '' ) ),
			'encounter_seed_slug' => sanitize_key( (string) ( $encounter_seed['slug'] ?? $payload['encounter_seed_slug'] ?? '' ) ),
			'slot' => $resolved_slot,
			'encounter_index' => max( 1, (int) ( $payload['encounter_index'] ?? $story_state['encounter_index'] ?? 1 ) ),
			'stage' => sanitize_key( (string) ( $payload['stage'] ?? $scene_state['phase'] ?? '' ) ),
			'tension' => sanitize_key( (string) ( $payload['tension'] ?? $story_state['tension'] ?? '' ) ),
			'set_result' => sanitize_key( (string) ( $payload['set_result'] ?? '' ) ),
			'stance' => sanitize_key( (string) ( $payload['stance'] ?? $story_state['stance'] ?? '' ) ),
			'progress_phase' => sanitize_key( (string) ( $payload['progress_phase'] ?? $story_state['encounter_phase'] ?? '' ) ),
			'result_band' => sanitize_key( (string) ( $payload['result_band'] ?? '' ) ),
			'slot_count' => max( 0, (int) ( $story_engine['slot_counts'][ $resolved_slot ] ?? 0 ) ),
			'recent_template_ids' => self::sanitize_key_list( (array) ( $story_engine['recent_template_ids'] ?? [] ) ),
			'recent_tags' => self::sanitize_key_list( (array) ( $story_engine['recent_tags'] ?? [] ) ),
			'exclusion_phrases' => self::sanitize_text_list( (array) ( $story_engine['recent_phrases'] ?? [] ) ),
			'banned_terms' => self::sanitize_text_list( (array) ( $story_state['story_profile']['banned_terms'] ?? [] ) ),
			'allowed_mechanics_mentions' => self::sanitize_key_list( (array) ( $story_state['story_profile']['allowed_mechanics_mentions'] ?? [] ) ),
			'mechanics' => is_array( $payload['mechanics'] ?? null ) ? $payload['mechanics'] : [],
		];
	}

	public static function select_candidate( array $mission, array $request, array $story_state = [] ): ?array {
		$candidates = self::list_matching_candidates( $mission, $request, $story_state );
		return [] === $candidates ? null : $candidates[0];
	}

	public static function list_matching_candidates( array $mission, array $request, array $story_state = [] ): array {
		$slot = sanitize_key( (string) ( $request['slot'] ?? '' ) );
		if ( '' === $slot ) {
			return [];
		}

		$recent_template_ids = self::sanitize_key_list( (array) ( $request['recent_template_ids'] ?? [] ) );
		$recent_tags = self::sanitize_key_list( (array) ( $request['recent_tags'] ?? [] ) );
		$templates = array_values( array_filter( (array) ( $mission['beat_templates'] ?? [] ), 'is_array' ) );
		$candidates = [];

		foreach ( $templates as $template ) {
			$template_id = sanitize_key( (string) ( $template['id'] ?? '' ) );
			if ( '' === $template_id || sanitize_key( (string) ( $template['slot'] ?? '' ) ) !== $slot ) {
				continue;
			}

			if ( in_array( $template_id, $recent_template_ids, true ) ) {
				continue;
			}

			if ( ! self::template_matches_conditions( (array) ( $template['conditions'] ?? [] ), $request ) ) {
				continue;
			}

			$template['selection_score'] = self::score_template( $mission, $template, $request, $recent_tags, $story_state );
			$candidates[] = $template;
		}

		usort(
			$candidates,
			static function ( array $left, array $right ): int {
				$score_compare = ( (int) ( $right['selection_score'] ?? 0 ) ) <=> ( (int) ( $left['selection_score'] ?? 0 ) );
				if ( 0 !== $score_compare ) {
					return $score_compare;
				}

				return strcmp( (string) ( $left['id'] ?? '' ), (string) ( $right['id'] ?? '' ) );
			}
		);

		return array_values( $candidates );
	}

	public static function render_candidate( array $candidate, array $encounter_seed = [], array $scene_state = [], array $request = [] ): array {
		$token_context = self::build_token_context( $encounter_seed, $scene_state, $request );
		$skeleton = is_array( $candidate['skeleton'] ?? null ) ? $candidate['skeleton'] : [];
		$setup = self::render_template_string( (string) ( $skeleton['setup'] ?? '' ), $token_context );
		$turn = self::render_template_string( (string) ( $skeleton['turn'] ?? '' ), $token_context );
		$close = self::render_template_string( (string) ( $skeleton['close'] ?? '' ), $token_context );
		$summary = self::render_template_string( (string) ( $skeleton['summary'] ?? '' ), $token_context );
		$follow_up = self::render_template_string( (string) ( $skeleton['follow_up'] ?? '' ), $token_context );
		$decision_prompt = self::render_template_string( (string) ( $skeleton['decision_prompt'] ?? '' ), $token_context );
		$banned_terms = self::sanitize_text_list( (array) ( $request['banned_terms'] ?? [] ) );

		if ( '' === $summary ) {
			$summary = trim( implode( ' ', array_filter( [ $setup, $turn, $close ] ) ) );
		}

		$summary = self::strip_banned_terms( $summary, $banned_terms );
		$follow_up = self::strip_banned_terms( $follow_up, $banned_terms );
		$decision_prompt = self::strip_banned_terms( $decision_prompt, $banned_terms );

		return [
			'template_id' => sanitize_key( (string) ( $candidate['id'] ?? '' ) ),
			'slot' => sanitize_key( (string) ( $candidate['slot'] ?? '' ) ),
			'tags' => self::sanitize_key_list( (array) ( $candidate['tags'] ?? [] ) ),
			'score' => (float) ( $candidate['selection_score'] ?? 0 ),
			'rendered_tokens' => self::extract_rendered_tokens( (array) ( $candidate['tokens_required'] ?? [] ), $token_context ),
			'draft' => [
				'summary' => $summary,
				'follow_up' => $follow_up,
				'decision_prompt' => $decision_prompt,
			],
			'fragments' => [
				'setup' => $setup,
				'turn' => $turn,
				'close' => $close,
			],
		];
	}

	public static function record_selection( array $story_state, array $candidate, array $rendered ): array {
		$story_engine = is_array( $story_state['story_engine'] ?? null ) ? $story_state['story_engine'] : [];
		$repetition_window = max( 1, (int) ( $story_state['story_profile']['repetition_window'] ?? 8 ) );
		$template_id = sanitize_key( (string) ( $rendered['template_id'] ?? $candidate['id'] ?? '' ) );
		$slot = sanitize_key( (string) ( $rendered['slot'] ?? $candidate['slot'] ?? '' ) );
		$summary = sanitize_textarea_field( (string) ( $rendered['draft']['summary'] ?? '' ) );

		$recent_template_ids = self::prepend_unique_key( self::sanitize_key_list( (array) ( $story_engine['recent_template_ids'] ?? [] ) ), $template_id, $repetition_window );
		$recent_tags = self::prepend_unique_keys( self::sanitize_key_list( (array) ( $story_engine['recent_tags'] ?? [] ) ), self::sanitize_key_list( (array) ( $rendered['tags'] ?? [] ) ), $repetition_window * 2 );
		$recent_phrases = self::prepend_unique_text( self::sanitize_text_list( (array) ( $story_engine['recent_phrases'] ?? [] ) ), $summary, $repetition_window );
		$slot_counts = is_array( $story_engine['slot_counts'] ?? null ) ? $story_engine['slot_counts'] : [];
		$slot_counts[ $slot ] = max( 0, (int) ( $slot_counts[ $slot ] ?? 0 ) ) + 1;

		$story_state['story_engine'] = [
			'recent_template_ids' => $recent_template_ids,
			'recent_tags' => $recent_tags,
			'recent_phrases' => $recent_phrases,
			'slot_counts' => $slot_counts,
			'last_selected' => [
				'template_id' => $template_id,
				'slot' => $slot,
				'encounter_seed_slug' => sanitize_key( (string) ( $story_state['encounter_seed']['slug'] ?? '' ) ),
			],
			'variation_seed' => sanitize_text_field( (string) ( $story_engine['variation_seed'] ?? (string) ( $story_state['run_id'] ?? 'story-engine' ) ) ),
		];

		return $story_state;
	}

	private static function score_template( array $mission, array $template, array $request, array $recent_tags, array $story_state = [] ): int {
		$score = max( 1, (int) ( $template['weight'] ?? 1 ) ) * 10;
		$template_tags = self::sanitize_key_list( (array) ( $template['tags'] ?? [] ) );
		$stance = sanitize_key( (string) ( $request['stance'] ?? '' ) );
		$slot = sanitize_key( (string) ( $request['slot'] ?? '' ) );
		$story_profile = is_array( $mission['story_profile'] ?? null ) ? $mission['story_profile'] : [];

		if ( '' !== $stance && in_array( $stance, $template_tags, true ) ) {
			$score += 8;
		}

		$preferred_stance_tags = self::sanitize_key_list( (array) ( $story_profile['stance_bias'][ $stance ] ?? [] ) );
		foreach ( $preferred_stance_tags as $tag ) {
			if ( in_array( $tag, $template_tags, true ) ) {
				$score += 5;
			}
		}

		foreach ( $template_tags as $tag ) {
			if ( in_array( $tag, $recent_tags, true ) ) {
				$score -= 4;
			}
		}

		foreach ( self::preferred_progress_tags( $slot, $request, $mission, $story_state ) as $tag ) {
			if ( in_array( $tag, $template_tags, true ) ) {
				$score += 4;
			}
		}

		if ( 'controlled' === sanitize_key( (string) ( $request['tension'] ?? '' ) ) && in_array( 'control', $template_tags, true ) ) {
			$score += 4;
		}

		if ( in_array( sanitize_key( (string) ( $request['tension'] ?? '' ) ), [ 'high', 'critical' ], true ) && in_array( 'pressure', $template_tags, true ) ) {
			$score += 3;
		}

		if ( 'critical' === sanitize_key( (string) ( $request['tension'] ?? '' ) ) && in_array( 'crisis', $template_tags, true ) ) {
			$score += 5;
		}

		return $score;
	}

	private static function template_matches_conditions( array $conditions, array $request ): bool {
		foreach ( $conditions as $key => $expected_values ) {
			$key = sanitize_key( (string) $key );
			$expected_values = is_array( $expected_values ) ? $expected_values : [ $expected_values ];
			$actual = self::resolve_request_value( $request, $key );

			$matched = false;
			foreach ( $expected_values as $expected ) {
				$normalized_expected = is_bool( $expected ) || is_int( $expected ) || is_float( $expected )
					? $expected
					: sanitize_key( (string) $expected );
				$normalized_actual = is_bool( $actual ) || is_int( $actual ) || is_float( $actual )
					? $actual
					: sanitize_key( (string) $actual );

				if ( $normalized_expected === $normalized_actual ) {
					$matched = true;
					break;
				}
			}

			if ( ! $matched ) {
				return false;
			}
		}

		return true;
	}

	private static function resolve_request_value( array $request, string $key ) {
		if ( array_key_exists( $key, $request ) ) {
			return $request[ $key ];
		}

		$mechanics = is_array( $request['mechanics'] ?? null ) ? $request['mechanics'] : [];

		return $mechanics[ $key ] ?? null;
	}

	private static function build_token_context( array $encounter_seed, array $scene_state, array $request ): array {
		$context = [];
		foreach ( [ $encounter_seed, $scene_state, $request ] as $source ) {
			foreach ( $source as $key => $value ) {
				if ( is_scalar( $value ) ) {
					$context[ sanitize_key( (string) $key ) ] = sanitize_text_field( (string) $value );
				}
			}
		}

		return $context;
	}

	private static function render_template_string( string $template, array $token_context ): string {
		if ( '' === trim( $template ) ) {
			return '';
		}

		return trim(
			preg_replace_callback(
				'/\{([a-z0-9_\-]+)\}/i',
				static function ( array $matches ) use ( $token_context ): string {
					$key = sanitize_key( (string) ( $matches[1] ?? '' ) );
					return (string) ( $token_context[ $key ] ?? '' );
				},
				$template
			) ?? $template
		);
	}

	private static function extract_rendered_tokens( array $required_tokens, array $token_context ): array {
		$tokens = [];
		foreach ( self::sanitize_key_list( $required_tokens ) as $token ) {
			if ( isset( $token_context[ $token ] ) && '' !== (string) $token_context[ $token ] ) {
				$tokens[ $token ] = $token_context[ $token ];
			}
		}

		return $tokens;
	}

	private static function preferred_progress_tags( string $slot, array $request, array $mission, array $story_state = [] ): array {
		$stage = sanitize_key( (string) ( $request['stage'] ?? '' ) );
		$progress_phase = sanitize_key( (string) ( $request['progress_phase'] ?? '' ) );
		$tension = sanitize_key( (string) ( $request['tension'] ?? '' ) );
		$slot_count = max(
			0,
			(int) ( $request['slot_count'] ?? $story_state['story_engine']['slot_counts'][ $slot ] ?? 0 )
		);
		$count_target = max( 1, (int) ( $mission['story_slots'][ $slot ]['count_target'] ?? 1 ) );
		$progress_ratio = min( 1, ( $slot_count + 1 ) / $count_target );
		$tags = [];

		if ( in_array( $stage, [ 'opening' ], true ) || $progress_ratio <= 0.34 ) {
			$tags = array_merge( $tags, [ 'advance', 'control' ] );
		}

		if ( in_array( $stage, [ 'middle' ], true ) || ( $progress_ratio > 0.34 && $progress_ratio < 0.75 ) ) {
			$tags = array_merge( $tags, [ 'pressure', 'recovery' ] );
		}

		if (
			in_array( $stage, [ 'closing', 'resolution' ], true )
			|| in_array( $progress_phase, [ 'final_push' ], true )
			|| $progress_ratio >= 0.75
		) {
			$tags = array_merge( $tags, [ 'crisis', 'defiance', 'payoff', 'advance', 'transition' ] );
		}

		if ( in_array( $tension, [ 'high', 'critical' ], true ) ) {
			$tags = array_merge( $tags, [ 'pressure', 'crisis' ] );
		}

		return array_values( array_unique( self::sanitize_key_list( $tags ) ) );
	}

	private static function strip_banned_terms( string $text, array $banned_terms ): string {
		$text = trim( $text );
		if ( '' === $text || [] === $banned_terms ) {
			return $text;
		}

		foreach ( $banned_terms as $term ) {
			$term = trim( (string) $term );
			if ( '' === $term ) {
				continue;
			}

			$pattern = '/\b' . preg_quote( $term, '/' ) . '\b/i';
			$text = preg_replace( $pattern, '', $text ) ?? $text;
		}

		$text = preg_replace( '/\s{2,}/', ' ', $text ) ?? $text;
		$text = preg_replace( '/\s+([,.;:!?])/', '$1', $text ) ?? $text;

		return trim( $text );
	}

	private static function prepend_unique_key( array $items, string $value, int $limit ): array {
		if ( '' === $value ) {
			return array_slice( $items, 0, $limit );
		}

		$items = array_values( array_filter( $items, static fn( string $item ): bool => $item !== $value ) );
		array_unshift( $items, $value );

		return array_slice( $items, 0, $limit );
	}

	private static function prepend_unique_keys( array $items, array $values, int $limit ): array {
		foreach ( array_reverse( self::sanitize_key_list( $values ) ) as $value ) {
			$items = self::prepend_unique_key( $items, $value, $limit );
		}

		return array_slice( $items, 0, $limit );
	}

	private static function prepend_unique_text( array $items, string $value, int $limit ): array {
		$value = sanitize_textarea_field( $value );
		if ( '' === $value ) {
			return array_slice( $items, 0, $limit );
		}

		$items = array_values( array_filter( $items, static fn( string $item ): bool => $item !== $value ) );
		array_unshift( $items, $value );

		return array_slice( $items, 0, $limit );
	}

	private static function sanitize_key_list( array $items ): array {
		return array_values(
			array_filter(
				array_map(
					static fn( $item ): string => sanitize_key( (string) $item ),
					$items
				)
			)
		);
	}

	private static function sanitize_text_list( array $items ): array {
		return array_values(
			array_filter(
				array_map(
					static fn( $item ): string => sanitize_textarea_field( (string) $item ),
					$items
				),
				static fn( string $item ): bool => '' !== $item
			)
		);
	}
}
