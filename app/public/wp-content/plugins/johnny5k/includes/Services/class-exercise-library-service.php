<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class ExerciseLibraryService {

	private const PERSONAL_EXERCISE_FIELDS = [
		'name',
		'slug',
		'description',
		'movement_pattern',
		'primary_muscle',
		'secondary_muscles',
		'equipment',
		'difficulty',
		'age_friendliness_score',
		'joint_stress_score',
		'spinal_load_score',
		'default_rep_min',
		'default_rep_max',
		'default_sets',
		'default_progression_type',
		'coaching_cues',
		'day_types',
		'slot_types',
		'active',
	];

	public static function accessible_exercise_where( string $alias, int $user_id ): string {
		$prefix = '' !== $alias ? $alias . '.' : '';

		return sprintf( '(%1$suser_id IS NULL OR %1$suser_id = %2$d)', $prefix, (int) $user_id );
	}

	public static function accessible_substitution_where( string $alias, int $user_id ): string {
		$prefix = '' !== $alias ? $alias . '.' : '';

		return sprintf( '(%1$suser_id IS NULL OR %1$suser_id = %2$d)', $prefix, (int) $user_id );
	}

	public static function is_exercise_accessible( int $user_id, int $exercise_id ): bool {
		return null !== self::get_exercise( $user_id, $exercise_id, 'id' );
	}

	public static function get_exercise( int $user_id, int $exercise_id, string $columns = '*' ): ?object {
		global $wpdb;

		if ( $exercise_id <= 0 ) {
			return null;
		}

		$table = $wpdb->prefix . 'fit_exercises';
		$where = self::accessible_exercise_where( '', $user_id );

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT {$columns} FROM {$table} WHERE id = %d AND {$where} LIMIT 1",
			$exercise_id
		) );

		return $row instanceof \stdClass ? $row : null;
	}

	public static function find_accessible_exercise_by_name( int $user_id, string $name ): ?object {
		global $wpdb;

		$name = sanitize_text_field( $name );
		if ( '' === $name ) {
			return null;
		}

		$table = $wpdb->prefix . 'fit_exercises';
		$where = self::accessible_exercise_where( '', $user_id );

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name, primary_muscle, equipment, difficulty
			 FROM {$table}
			 WHERE active = 1
			   AND LOWER(name) = LOWER(%s)
			   AND {$where}
			 ORDER BY CASE WHEN user_id = %d THEN 0 ELSE 1 END, id ASC
			 LIMIT 1",
			$name,
			$user_id
		) );

		return $row instanceof \stdClass ? $row : null;
	}

	public static function create_personal_exercise( int $user_id, array $payload ) {
		global $wpdb;

		$name = sanitize_text_field( (string) ( $payload['name'] ?? '' ) );
		if ( '' === $name ) {
			return new \WP_Error( 'missing_name', 'Exercise name is required.' );
		}

		$existing = self::find_accessible_exercise_by_name( $user_id, $name );
		if ( $existing ) {
			return [
				'id' => (int) $existing->id,
				'created' => false,
			];
		}

		$slug_base = sanitize_title( (string) ( $payload['slug'] ?? $name ) );
		$slug = self::next_personal_slug( $user_id, $slug_base );

		$data = [
			'user_id'                  => $user_id,
			'slug'                     => $slug,
			'name'                     => $name,
			'description'              => sanitize_textarea_field( (string) ( $payload['description'] ?? '' ) ),
			'movement_pattern'         => sanitize_text_field( (string) ( $payload['movement_pattern'] ?? '' ) ),
			'primary_muscle'           => sanitize_text_field( (string) ( $payload['primary_muscle'] ?? '' ) ),
			'secondary_muscles_json'   => wp_json_encode( self::normalise_string_list( $payload['secondary_muscles'] ?? [] ) ),
			'equipment'                => sanitize_text_field( (string) ( $payload['equipment'] ?? 'other' ) ) ?: 'other',
			'difficulty'               => self::normalise_difficulty( (string) ( $payload['difficulty'] ?? 'beginner' ) ),
			'age_friendliness_score'   => max( 1, min( 10, (int) ( $payload['age_friendliness_score'] ?? 5 ) ) ),
			'joint_stress_score'       => max( 1, min( 10, (int) ( $payload['joint_stress_score'] ?? 3 ) ) ),
			'spinal_load_score'        => max( 1, min( 10, (int) ( $payload['spinal_load_score'] ?? 3 ) ) ),
			'default_rep_min'          => max( 1, (int) ( $payload['default_rep_min'] ?? 8 ) ),
			'default_rep_max'          => max( 1, (int) ( $payload['default_rep_max'] ?? 12 ) ),
			'default_sets'             => max( 1, (int) ( $payload['default_sets'] ?? 3 ) ),
			'default_progression_type' => self::normalise_progression_type( (string) ( $payload['default_progression_type'] ?? 'double_progression' ) ),
			'coaching_cues_json'       => wp_json_encode( self::normalise_string_list( $payload['coaching_cues'] ?? [] ) ),
			'day_types_json'           => wp_json_encode( self::normalise_string_list( $payload['day_types'] ?? [] ) ),
			'slot_types_json'          => wp_json_encode( self::normalise_string_list( $payload['slot_types'] ?? [] ) ),
			'active'                   => isset( $payload['active'] ) ? (int) (bool) $payload['active'] : 1,
		];

		$inserted = $wpdb->insert( $wpdb->prefix . 'fit_exercises', $data );
		if ( false === $inserted ) {
			return new \WP_Error( 'exercise_insert_failed', 'Could not save that exercise to your library.' );
		}

		return [
			'id' => (int) $wpdb->insert_id,
			'created' => true,
		];
	}

	public static function create_personal_substitution( int $user_id, int $exercise_id, int $substitute_exercise_id, string $reason_code = 'variation', int $priority = 1 ) {
		global $wpdb;

		if ( $exercise_id <= 0 || $substitute_exercise_id <= 0 ) {
			return new \WP_Error( 'invalid_exercise_ids', 'Both exercises are required for a swap option.' );
		}

		if ( ! self::is_exercise_accessible( $user_id, $exercise_id ) || ! self::is_exercise_accessible( $user_id, $substitute_exercise_id ) ) {
			return new \WP_Error( 'exercise_not_accessible', 'One of those exercises is not available in your library.' );
		}

		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_exercise_substitutions
			 WHERE user_id = %d AND exercise_id = %d AND substitute_exercise_id = %d
			 LIMIT 1",
			$user_id,
			$exercise_id,
			$substitute_exercise_id
		) );

		if ( $existing ) {
			return [
				'id' => (int) $existing,
				'created' => false,
			];
		}

		$inserted = $wpdb->insert( $wpdb->prefix . 'fit_exercise_substitutions', [
			'user_id'                => $user_id,
			'exercise_id'            => $exercise_id,
			'substitute_exercise_id' => $substitute_exercise_id,
			'reason_code'            => self::normalise_reason_code( $reason_code ),
			'priority'               => max( 1, $priority ),
		] );

		if ( false === $inserted ) {
			return new \WP_Error( 'substitution_insert_failed', 'Could not save that swap option to your library.' );
		}

		return [
			'id' => (int) $wpdb->insert_id,
			'created' => true,
		];
	}

	public static function update_personal_exercise( int $user_id, int $exercise_id, array $payload ) {
		global $wpdb;

		$existing = self::get_owned_exercise( $user_id, $exercise_id );
		if ( ! $existing ) {
			return new \WP_Error( 'exercise_not_found', 'That personal exercise was not found.' );
		}

		$data = self::build_personal_exercise_data( $user_id, $payload, $existing );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		if ( empty( $data ) ) {
			return [
				'id' => $exercise_id,
				'updated' => false,
			];
		}

		$updated = $wpdb->update(
			$wpdb->prefix . 'fit_exercises',
			$data,
			[
				'id' => $exercise_id,
				'user_id' => $user_id,
			]
		);

		if ( false === $updated ) {
			return new \WP_Error( 'exercise_update_failed', 'Could not update that exercise in your library.' );
		}

		return [
			'id' => $exercise_id,
			'updated' => true,
		];
	}

	public static function delete_personal_exercise( int $user_id, int $exercise_id ) {
		global $wpdb;

		if ( ! self::get_owned_exercise( $user_id, $exercise_id, 'id' ) ) {
			return new \WP_Error( 'exercise_not_found', 'That personal exercise was not found.' );
		}

		$updated = $wpdb->update(
			$wpdb->prefix . 'fit_exercises',
			[ 'active' => 0 ],
			[
				'id' => $exercise_id,
				'user_id' => $user_id,
			]
		);

		if ( false === $updated ) {
			return new \WP_Error( 'exercise_delete_failed', 'Could not remove that exercise from your library.' );
		}

		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$wpdb->prefix}fit_exercise_substitutions WHERE user_id = %d AND (exercise_id = %d OR substitute_exercise_id = %d)",
			$user_id,
			$exercise_id,
			$exercise_id
		) );

		return [
			'id' => $exercise_id,
			'deleted' => true,
		];
	}

	public static function merge_personal_exercises( int $user_id, int $keep_exercise_id, array $remove_exercise_ids ) {
		global $wpdb;

		$keep_exercise_id = (int) $keep_exercise_id;
		$remove_ids = array_values( array_unique( array_filter( array_map( 'intval', $remove_exercise_ids ) ) ) );

		if ( $keep_exercise_id <= 0 || empty( $remove_ids ) ) {
			return new \WP_Error( 'invalid_merge_request', 'Choose one exercise to keep and at least one duplicate to merge into it.' );
		}

		$remove_ids = array_values( array_filter( $remove_ids, static function( int $exercise_id ) use ( $keep_exercise_id ): bool {
			return $exercise_id > 0 && $exercise_id !== $keep_exercise_id;
		} ) );

		if ( empty( $remove_ids ) ) {
			return new \WP_Error( 'invalid_merge_request', 'Choose at least one other duplicate to merge.' );
		}

		if ( ! self::get_owned_exercise( $user_id, $keep_exercise_id, 'id' ) ) {
			return new \WP_Error( 'exercise_not_found', 'The exercise you want to keep was not found in your personal library.' );
		}

		foreach ( $remove_ids as $exercise_id ) {
			if ( ! self::get_owned_exercise( $user_id, $exercise_id, 'id' ) ) {
				return new \WP_Error( 'exercise_not_found', 'One of the duplicate exercises was not found in your personal library.' );
			}
		}

		$keep_exercise = self::get_owned_exercise( $user_id, $keep_exercise_id, 'id, name' );
		$removed_exercises = array_values( array_filter( array_map( static function( int $exercise_id ) use ( $user_id ) {
			$exercise = self::get_owned_exercise( $user_id, $exercise_id, 'id, name' );
			if ( ! $exercise ) {
				return null;
			}

			return [
				'id' => (int) $exercise->id,
				'name' => (string) $exercise->name,
			];
		}, $remove_ids ) ) );

		$plan_rows = self::collect_merge_plan_rows( $user_id, $keep_exercise, $remove_ids );
		$substitution_rows = self::collect_merge_substitution_rows( $user_id, $keep_exercise, $remove_ids );

		$placeholders = implode( ',', array_fill( 0, count( $remove_ids ), '%d' ) );
		$started_transaction = false;

		if ( false !== $wpdb->query( 'START TRANSACTION' ) ) {
			$started_transaction = true;
		}

		$queries_ok = true;
		$tables = [
			'day_exercises' => $wpdb->prefix . 'fit_user_training_day_exercises',
			'training_days' => $wpdb->prefix . 'fit_user_training_days',
			'training_plans' => $wpdb->prefix . 'fit_user_training_plans',
			'session_exercises' => $wpdb->prefix . 'fit_workout_session_exercises',
			'sessions' => $wpdb->prefix . 'fit_workout_sessions',
			'substitutions' => $wpdb->prefix . 'fit_exercise_substitutions',
			'exercises' => $wpdb->prefix . 'fit_exercises',
		];

		$day_sql = $wpdb->prepare(
			"UPDATE {$tables['day_exercises']} ude
			 JOIN {$tables['training_days']} utd ON utd.id = ude.training_day_id
			 JOIN {$tables['training_plans']} utp ON utp.id = utd.training_plan_id
			 SET ude.exercise_id = %d
			 WHERE utp.user_id = %d
			   AND ude.exercise_id IN ($placeholders)",
			array_merge( [ $keep_exercise_id, $user_id ], $remove_ids )
		);
		$queries_ok = false !== $wpdb->query( $day_sql ) && $queries_ok;

		$session_sql = $wpdb->prepare(
			"UPDATE {$tables['session_exercises']} wse
			 JOIN {$tables['sessions']} ws ON ws.id = wse.session_id
			 SET wse.exercise_id = %d
			 WHERE ws.user_id = %d
			   AND wse.exercise_id IN ($placeholders)",
			array_merge( [ $keep_exercise_id, $user_id ], $remove_ids )
		);
		$queries_ok = false !== $wpdb->query( $session_sql ) && $queries_ok;

		$original_sql = $wpdb->prepare(
			"UPDATE {$tables['session_exercises']} wse
			 JOIN {$tables['sessions']} ws ON ws.id = wse.session_id
			 SET wse.original_exercise_id = %d
			 WHERE ws.user_id = %d
			   AND wse.original_exercise_id IN ($placeholders)",
			array_merge( [ $keep_exercise_id, $user_id ], $remove_ids )
		);
		$queries_ok = false !== $wpdb->query( $original_sql ) && $queries_ok;

		$sub_from_sql = $wpdb->prepare(
			"UPDATE {$tables['substitutions']}
			 SET exercise_id = %d
			 WHERE user_id = %d
			   AND exercise_id IN ($placeholders)",
			array_merge( [ $keep_exercise_id, $user_id ], $remove_ids )
		);
		$queries_ok = false !== $wpdb->query( $sub_from_sql ) && $queries_ok;

		$sub_to_sql = $wpdb->prepare(
			"UPDATE {$tables['substitutions']}
			 SET substitute_exercise_id = %d
			 WHERE user_id = %d
			   AND substitute_exercise_id IN ($placeholders)",
			array_merge( [ $keep_exercise_id, $user_id ], $remove_ids )
		);
		$queries_ok = false !== $wpdb->query( $sub_to_sql ) && $queries_ok;

		$self_ref_sql = $wpdb->prepare(
			"DELETE FROM {$tables['substitutions']} WHERE user_id = %d AND exercise_id = substitute_exercise_id",
			$user_id
		);
		$queries_ok = false !== $wpdb->query( $self_ref_sql ) && $queries_ok;

		$duplicate_sub_sql = $wpdb->prepare(
			"DELETE newer FROM {$tables['substitutions']} newer
			 JOIN {$tables['substitutions']} older
			   ON newer.user_id = older.user_id
			  AND newer.exercise_id = older.exercise_id
			  AND newer.substitute_exercise_id = older.substitute_exercise_id
			  AND newer.id > older.id
			 WHERE newer.user_id = %d",
			$user_id
		);
		$queries_ok = false !== $wpdb->query( $duplicate_sub_sql ) && $queries_ok;

		$deactivate_sql = $wpdb->prepare(
			"UPDATE {$tables['exercises']}
			 SET active = 0
			 WHERE user_id = %d
			   AND id IN ($placeholders)",
			array_merge( [ $user_id ], $remove_ids )
		);
		$queries_ok = false !== $wpdb->query( $deactivate_sql ) && $queries_ok;

		if ( ! $queries_ok ) {
			if ( $started_transaction ) {
				$wpdb->query( 'ROLLBACK' );
			}

			return new \WP_Error( 'exercise_merge_failed', 'Could not merge those duplicate exercises.' );
		}

		if ( $started_transaction ) {
			$wpdb->query( 'COMMIT' );
		}

		return [
			'keep_exercise_id' => $keep_exercise_id,
			'removed_exercise_ids' => $remove_ids,
			'merged_count' => count( $remove_ids ),
			'merge_summary' => [
				'keep_exercise' => [
					'id' => (int) ( $keep_exercise->id ?? $keep_exercise_id ),
					'name' => (string) ( $keep_exercise->name ?? '' ),
				],
				'removed_exercises' => $removed_exercises,
				'plan_rows' => $plan_rows,
				'substitutions' => $substitution_rows,
			],
			'merged' => true,
		];
	}

	private static function collect_merge_plan_rows( int $user_id, ?object $keep_exercise, array $remove_ids ): array {
		global $wpdb;

		if ( empty( $remove_ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $remove_ids ), '%d' ) );
		$sql = $wpdb->prepare(
			"SELECT ude.id, ude.sort_order, ude.slot_type, utd.day_order, utd.day_type, e.id AS exercise_id, e.name AS exercise_name
			 FROM {$wpdb->prefix}fit_user_training_day_exercises ude
			 JOIN {$wpdb->prefix}fit_user_training_days utd ON utd.id = ude.training_day_id
			 JOIN {$wpdb->prefix}fit_user_training_plans utp ON utp.id = utd.training_plan_id
			 JOIN {$wpdb->prefix}fit_exercises e ON e.id = ude.exercise_id
			 WHERE utp.user_id = %d
			   AND ude.exercise_id IN ($placeholders)
			 ORDER BY utd.day_order ASC, ude.sort_order ASC, ude.id ASC",
			array_merge( [ $user_id ], $remove_ids )
		);

		$rows = $wpdb->get_results( $sql );
		if ( ! is_array( $rows ) ) {
			return [];
		}

		return array_map( static function( $row ) use ( $keep_exercise ): array {
			$row = (array) $row;

			return [
				'id' => (int) ( $row['id'] ?? 0 ),
				'day_order' => (int) ( $row['day_order'] ?? 0 ),
				'day_type' => (string) ( $row['day_type'] ?? '' ),
				'slot_type' => (string) ( $row['slot_type'] ?? '' ),
				'sort_order' => (int) ( $row['sort_order'] ?? 0 ),
				'from_exercise' => [
					'id' => (int) ( $row['exercise_id'] ?? 0 ),
					'name' => (string) ( $row['exercise_name'] ?? '' ),
				],
				'to_exercise' => [
					'id' => (int) ( $keep_exercise->id ?? 0 ),
					'name' => (string) ( $keep_exercise->name ?? '' ),
				],
			];
		}, $rows );
	}

	private static function collect_merge_substitution_rows( int $user_id, ?object $keep_exercise, array $remove_ids ): array {
		global $wpdb;

		if ( empty( $remove_ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $remove_ids ), '%d' ) );
		$sql = $wpdb->prepare(
			"SELECT s.id, s.exercise_id, s.substitute_exercise_id, s.reason_code,
			        base.name AS exercise_name, sub.name AS substitute_name
			 FROM {$wpdb->prefix}fit_exercise_substitutions s
			 JOIN {$wpdb->prefix}fit_exercises base ON base.id = s.exercise_id
			 JOIN {$wpdb->prefix}fit_exercises sub ON sub.id = s.substitute_exercise_id
			 WHERE s.user_id = %d
			   AND (s.exercise_id IN ($placeholders) OR s.substitute_exercise_id IN ($placeholders))
			 ORDER BY s.priority ASC, s.id ASC",
			array_merge( [ $user_id ], $remove_ids, $remove_ids )
		);

		$rows = $wpdb->get_results( $sql );
		if ( ! is_array( $rows ) ) {
			return [];
		}

		$remove_lookup = array_fill_keys( $remove_ids, true );

		return array_map( static function( $row ) use ( $keep_exercise, $remove_lookup ): array {
			$row = (array) $row;
			$exercise_id = (int) ( $row['exercise_id'] ?? 0 );
			$substitute_exercise_id = (int) ( $row['substitute_exercise_id'] ?? 0 );
			$changes_base = isset( $remove_lookup[ $exercise_id ] );
			$changes_substitute = isset( $remove_lookup[ $substitute_exercise_id ] );

			return [
				'id' => (int) ( $row['id'] ?? 0 ),
				'reason_code' => (string) ( $row['reason_code'] ?? '' ),
				'changes_base' => $changes_base,
				'changes_substitute' => $changes_substitute,
				'from_pair' => [
					'exercise_id' => $exercise_id,
					'exercise_name' => (string) ( $row['exercise_name'] ?? '' ),
					'substitute_exercise_id' => $substitute_exercise_id,
					'substitute_name' => (string) ( $row['substitute_name'] ?? '' ),
				],
				'to_pair' => [
					'exercise_id' => $changes_base ? (int) ( $keep_exercise->id ?? 0 ) : $exercise_id,
					'exercise_name' => $changes_base ? (string) ( $keep_exercise->name ?? '' ) : (string) ( $row['exercise_name'] ?? '' ),
					'substitute_exercise_id' => $changes_substitute ? (int) ( $keep_exercise->id ?? 0 ) : $substitute_exercise_id,
					'substitute_name' => $changes_substitute ? (string) ( $keep_exercise->name ?? '' ) : (string) ( $row['substitute_name'] ?? '' ),
				],
			];
		}, $rows );
	}

	private static function next_personal_slug( int $user_id, string $slug_base, int $exclude_exercise_id = 0 ): string {
		global $wpdb;

		$slug_base = sanitize_title( $slug_base );
		if ( '' === $slug_base ) {
			$slug_base = 'exercise';
		}

		$candidate = sprintf( '%s-u%d', $slug_base, $user_id );
		$index = 2;

		while ( self::slug_exists( $candidate, $exclude_exercise_id ) ) {
			$candidate = sprintf( '%s-u%d-%d', $slug_base, $user_id, $index );
			$index++;
		}

		return $candidate;
	}

	private static function slug_exists( string $slug, int $exclude_exercise_id = 0 ): bool {
		global $wpdb;

		if ( $exclude_exercise_id > 0 ) {
			return (bool) $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}fit_exercises WHERE slug = %s AND id <> %d LIMIT 1",
				$slug,
				$exclude_exercise_id
			) );
		}

		return (bool) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_exercises WHERE slug = %s LIMIT 1",
			$slug
		) );
	}

	private static function get_owned_exercise( int $user_id, int $exercise_id, string $columns = '*' ): ?object {
		global $wpdb;

		if ( $exercise_id <= 0 ) {
			return null;
		}

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT {$columns} FROM {$wpdb->prefix}fit_exercises WHERE id = %d AND user_id = %d LIMIT 1",
			$exercise_id,
			$user_id
		) );

		return $row instanceof \stdClass ? $row : null;
	}

	private static function build_personal_exercise_data( int $user_id, array $payload, ?object $existing = null ) {
		$data = [];

		foreach ( self::PERSONAL_EXERCISE_FIELDS as $field ) {
			if ( ! array_key_exists( $field, $payload ) ) {
				continue;
			}

			switch ( $field ) {
				case 'name':
					$name = sanitize_text_field( (string) $payload['name'] );
					if ( '' === $name ) {
						return new \WP_Error( 'missing_name', 'Exercise name is required.' );
					}

					$match = self::find_accessible_exercise_by_name( $user_id, $name );
					if ( $match && ( ! $existing || (int) $match->id !== (int) $existing->id ) ) {
						return new \WP_Error( 'duplicate_name', 'That exercise name is already in your library.' );
					}

					$data['name'] = $name;
					break;

				case 'slug':
					break;

				case 'description':
					$data['description'] = sanitize_textarea_field( (string) $payload['description'] );
					break;

				case 'movement_pattern':
				case 'primary_muscle':
				case 'equipment':
					$data[ $field ] = sanitize_text_field( (string) $payload[ $field ] );
					if ( 'equipment' === $field && '' === $data['equipment'] ) {
						$data['equipment'] = 'other';
					}
					break;

				case 'difficulty':
					$data['difficulty'] = self::normalise_difficulty( (string) $payload['difficulty'] );
					break;

				case 'secondary_muscles':
					$data['secondary_muscles_json'] = wp_json_encode( self::normalise_string_list( $payload['secondary_muscles'] ) );
					break;

				case 'coaching_cues':
					$data['coaching_cues_json'] = wp_json_encode( self::normalise_string_list( $payload['coaching_cues'] ) );
					break;

				case 'day_types':
					$data['day_types_json'] = wp_json_encode( self::normalise_string_list( $payload['day_types'] ) );
					break;

				case 'slot_types':
					$data['slot_types_json'] = wp_json_encode( self::normalise_string_list( $payload['slot_types'] ) );
					break;

				case 'age_friendliness_score':
				case 'joint_stress_score':
				case 'spinal_load_score':
					$data[ $field ] = max( 1, min( 10, (int) $payload[ $field ] ) );
					break;

				case 'default_rep_min':
				case 'default_rep_max':
				case 'default_sets':
					$data[ $field ] = max( 1, (int) $payload[ $field ] );
					break;

				case 'default_progression_type':
					$data['default_progression_type'] = self::normalise_progression_type( (string) $payload['default_progression_type'] );
					break;

				case 'active':
					$data['active'] = (int) (bool) $payload['active'];
					break;
			}
		}

		$next_name = (string) ( $data['name'] ?? ( $existing->name ?? '' ) );
		if ( '' !== $next_name && ( array_key_exists( 'name', $data ) || array_key_exists( 'slug', $payload ) ) ) {
			$slug_base = sanitize_title( (string) ( $payload['slug'] ?? $next_name ) );
			$data['slug'] = self::next_personal_slug( $user_id, $slug_base, (int) ( $existing->id ?? 0 ) );
		}

		return $data;
	}

	private static function normalise_string_list( $value ): array {
		if ( is_string( $value ) ) {
			$value = preg_split( '/[,\n]+/', $value );
		}

		if ( ! is_array( $value ) ) {
			return [];
		}

		$items = array_map(
			static fn( $item ): string => sanitize_text_field( (string) $item ),
			$value
		);

		$items = array_values( array_filter( array_unique( $items ) ) );

		return $items;
	}

	private static function normalise_difficulty( string $value ): string {
		$value = sanitize_text_field( $value );
		$allowed = [ 'beginner', 'intermediate', 'advanced' ];

		return in_array( $value, $allowed, true ) ? $value : 'beginner';
	}

	private static function normalise_progression_type( string $value ): string {
		$value = sanitize_text_field( $value );
		$allowed = [ 'double_progression', 'load_progression', 'top_set_backoff' ];

		return in_array( $value, $allowed, true ) ? $value : 'double_progression';
	}

	private static function normalise_reason_code( string $value ): string {
		$value = sanitize_text_field( $value );
		$allowed = [ 'equipment', 'joint_friendly', 'skill_level', 'variation' ];

		return in_array( $value, $allowed, true ) ? $value : 'variation';
	}
}