<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;
use Johnny5k\Support\TrainingDayTypes;

class ExerciseLibrary {

	private const DAY_TYPE_OPTIONS = [
		'push'           => 'Push',
		'pull'           => 'Pull',
		'legs'           => 'Legs',
		'arms_shoulders' => 'Bonus Arms / Shoulders',
		'chest'          => 'Chest',
		'back'           => 'Back',
		'shoulders'      => 'Shoulders',
		'arms'           => 'Arms',
		'cardio'         => 'Cardio',
		'rest'           => 'Rest',
	];

	private const SLOT_TYPE_OPTIONS = [
		'main'      => 'Main',
		'secondary' => 'Secondary',
		'shoulders' => 'Shoulders',
		'accessory' => 'Accessory',
		'abs'       => 'Abs',
		'challenge' => 'Challenge',
	];

	private const DIFFICULTY_OPTIONS = [
		'beginner'     => 'Beginner',
		'intermediate' => 'Intermediate',
		'advanced'     => 'Advanced',
	];

	private const PROGRESSION_OPTIONS = [
		'double_progression' => 'Double progression',
		'load_progression'   => 'Load progression',
		'top_set_backoff'    => 'Top set + backoff',
	];

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$state         = self::handle_post();
		$exercise      = self::get_requested_exercise();
		$exercise      = ! empty( $state['form'] ) ? $state['form'] : $exercise;
		$all_exercises = self::get_exercises();
		$list_state    = self::get_list_state();
		$exercises     = self::filter_exercises( $all_exercises, $list_state );

		echo '<div class="wrap jf-exercise-library">';
		self::render_styles();
		echo '<h1>Johnny5k Exercise Library</h1>';
		echo '<p>Manage exercises, split assignments, muscle groups, and exercise descriptions used across the plugin.</p>';

		foreach ( $state['errors'] as $error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $error ) . '</p></div>';
		}

		foreach ( $state['messages'] as $message ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
		}

		echo '<div class="jf-exercise-library__layout">';
		echo '<div class="jf-exercise-library__sidebar">';
		self::render_form( $exercise );
		self::render_discovery_form( $state['finder'] );
		echo '</div>';
		echo '<div class="jf-exercise-library__content">';
		if ( ! empty( $state['discoveries'] ) ) {
			self::render_discoveries( $state['discoveries'] );
		}
		self::render_list( $exercises, $list_state, self::get_filter_options( $all_exercises ), count( $all_exercises ) );
		echo '</div>';
		echo '</div>';
		echo '</div>';
	}

	private static function handle_post(): array {
		$state = [
			'messages'    => [],
			'errors'      => [],
			'form'        => [],
			'discoveries' => [],
			'finder'      => [
				'query' => '',
				'count' => 5,
			],
		];

		if ( 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
			return $state;
		}

		$action = sanitize_key( (string) ( $_POST['jf_exercise_action'] ?? '' ) );
		if ( '' === $action ) {
			return $state;
		}

		switch ( $action ) {
			case 'save_exercise':
				check_admin_referer( 'jf_exercise_library_save' );
				$exercise = self::build_exercise_from_post( $_POST );
				$state['form'] = $exercise;

				if ( '' === $exercise['name'] ) {
					$state['errors'][] = 'Exercise name is required.';
					return $state;
				}

				if ( '' === $exercise['primary_muscle'] ) {
					$state['errors'][] = 'Primary muscle group is required.';
					return $state;
				}

				self::save_exercise( $exercise );
				$state['messages'][] = $exercise['id'] > 0 ? 'Exercise updated.' : 'Exercise created.';
				$state['form'] = self::empty_exercise();
				return $state;

			case 'fill_exercise':
				check_admin_referer( 'jf_exercise_library_save' );
				$exercise = self::build_exercise_from_post( $_POST );
				$state['form'] = $exercise;

				if ( '' === $exercise['name'] ) {
					$state['errors'][] = 'Exercise name is required before AI can fill missing fields.';
					return $state;
				}

				$result = AiService::fill_exercise_library_item( get_current_user_id(), $exercise );
				if ( is_wp_error( $result ) ) {
					$state['errors'][] = $result->get_error_message();
					return $state;
				}

				$state['form'] = self::merge_missing_exercise_fields( $exercise, (array) ( $result['exercise'] ?? [] ) );
				$state['messages'][] = ! empty( $result['used_web_search'] )
					? 'AI filled missing exercise fields using web research.'
					: 'AI filled missing exercise fields.';
				if ( ! empty( $result['notes'] ) ) {
					$state['messages'][] = (string) $result['notes'];
				}
				return $state;

			case 'discover_exercises':
				check_admin_referer( 'jf_exercise_library_discover' );
				$finder = [
					'query' => sanitize_text_field( wp_unslash( $_POST['query'] ?? '' ) ),
					'count' => max( 1, min( 10, (int) ( $_POST['count'] ?? 5 ) ) ),
				];
				$state['finder'] = $finder;

				$result = AiService::discover_exercise_library_items( get_current_user_id(), [
					'query'         => $finder['query'],
					'count'         => $finder['count'],
					'exclude_names' => array_map( static fn( array $item ): string => (string) ( $item['name'] ?? '' ), self::get_exercises() ),
				] );
				if ( is_wp_error( $result ) ) {
					$state['errors'][] = $result->get_error_message();
					return $state;
				}

				$state['discoveries'] = array_values( array_filter( (array) ( $result['exercises'] ?? [] ), 'is_array' ) );
				$state['messages'][] = ! empty( $result['used_web_search'] )
					? 'AI exercise search complete.'
					: 'AI exercise suggestions generated.';
				if ( ! empty( $result['notes'] ) ) {
					$state['messages'][] = (string) $result['notes'];
				}
				return $state;

			case 'import_discoveries':
				check_admin_referer( 'jf_exercise_library_import_discoveries' );
				$discoveries = self::decode_discoveries_payload( $_POST['discoveries_payload'] ?? '' );
				$state['discoveries'] = $discoveries;

				if ( empty( $discoveries ) ) {
					$state['errors'][] = 'No AI-found exercises were available to import.';
					return $state;
				}

				$save_mode = sanitize_key( (string) ( $_POST['save_mode'] ?? 'selected' ) );
				$indexes   = 'all' === $save_mode
					? array_keys( $discoveries )
					: array_values( array_unique( array_map( 'intval', (array) ( $_POST['selected_discoveries'] ?? [] ) ) ) );

				if ( empty( $indexes ) ) {
					$state['errors'][] = 'Select at least one AI-found exercise to import.';
					return $state;
				}

				$existing_by_slug = [];
				foreach ( self::get_exercises() as $existing ) {
					$slug = (string) ( $existing['slug'] ?? '' );
					if ( '' !== $slug ) {
						$existing_by_slug[ $slug ] = true;
					}
				}

				$imported = 0;
				foreach ( $indexes as $index ) {
					if ( ! isset( $discoveries[ $index ] ) || ! is_array( $discoveries[ $index ] ) ) {
						continue;
					}

					$exercise = self::normalise_exercise( $discoveries[ $index ] );
					if ( '' === $exercise['name'] ) {
						continue;
					}

					$slug = $exercise['slug'] ?: sanitize_title( $exercise['name'] );
					if ( isset( $existing_by_slug[ $slug ] ) ) {
						continue;
					}

					self::save_exercise( $exercise );
					$existing_by_slug[ $slug ] = true;
					++$imported;
				}

				if ( 0 === $imported ) {
					$state['errors'][] = 'No new exercises were imported. They may already exist in the library.';
					return $state;
				}

				$state['messages'][] = 1 === $imported
					? 'Imported 1 new exercise.'
					: sprintf( 'Imported %d new exercises.', $imported );
				return $state;

			case 'toggle_exercise':
				$id = (int) ( $_POST['exercise_id'] ?? 0 );
				check_admin_referer( 'jf_exercise_library_toggle_' . $id );
				if ( $id > 0 ) {
					$active = ! empty( $_POST['active'] ) ? 1 : 0;
					self::set_exercise_active( $id, $active );
					$state['messages'][] = $active ? 'Exercise restored.' : 'Exercise archived.';
				}
				return $state;
		}

		return $state;
	}

	private static function render_styles(): void {
		echo '<style>
			.jf-exercise-library__layout{display:grid;grid-template-columns:minmax(360px,460px) minmax(0,1fr);gap:24px;align-items:start}
			.jf-exercise-library__sidebar,.jf-exercise-library__content{min-width:0}
			.jf-exercise-library__card{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px}
			.jf-exercise-library__card + .jf-exercise-library__card{margin-top:24px}
			.jf-exercise-library .form-table,.jf-exercise-library .form-table tbody,.jf-exercise-library .form-table td{width:100%}
			.jf-exercise-library .form-table th{width:150px}
			.jf-exercise-library .form-table input.regular-text,
			.jf-exercise-library .form-table input[type="number"],
			.jf-exercise-library .form-table textarea.large-text{width:100%;max-width:100%;box-sizing:border-box}
			.jf-exercise-library__checkbox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}
			.jf-exercise-library__table{table-layout:fixed}
			.jf-exercise-library__table th,.jf-exercise-library__table td{vertical-align:top;word-break:break-word}
			.jf-exercise-library__table th a{color:inherit;text-decoration:none}
			.jf-exercise-library__meta{color:#50575e;margin-top:6px}
			.jf-exercise-library__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
			.jf-exercise-library__results-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
			.jf-exercise-library__results-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
			.jf-exercise-library__list-toolbar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
			.jf-exercise-library__list-summary{color:#50575e;margin:0}
			.jf-exercise-library__filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;align-items:end;margin-bottom:16px}
			.jf-exercise-library__filter-field{display:flex;flex-direction:column;gap:6px}
			.jf-exercise-library__filter-field label{font-weight:600}
			.jf-exercise-library__filter-field input,
			.jf-exercise-library__filter-field select{width:100%}
			.jf-exercise-library__filter-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
			.jf-exercise-library__sort-link{display:inline-flex;align-items:center;gap:6px}
			.jf-exercise-library__sort-indicator{font-size:12px;color:#646970}
			.jf-exercise-library__discovery{border-top:1px solid #f0f0f1;padding:16px 0}
			.jf-exercise-library__discovery:first-of-type{border-top:0;padding-top:0}
			.jf-exercise-library__discovery label{display:flex;gap:10px;align-items:flex-start}
			.jf-exercise-library__discovery input[type="checkbox"]{margin-top:2px}
			.jf-exercise-library__discovery-body{min-width:0;flex:1}
			@media (max-width: 1200px){.jf-exercise-library__layout{grid-template-columns:1fr}.jf-exercise-library__filters{grid-template-columns:repeat(3,minmax(0,1fr))}}
			@media (max-width: 782px){.jf-exercise-library__filters{grid-template-columns:1fr}.jf-exercise-library__list-toolbar{align-items:flex-start}}
		</style>';
	}

	private static function render_form(array $exercise): void {
		$is_edit = ! empty( $exercise['id'] );

		echo '<form method="post" class="jf-exercise-library__card">';
		echo '<h2 style="margin-top:0">' . esc_html( $is_edit ? 'Edit Exercise' : 'Add Exercise' ) . '</h2>';
		echo '<input type="hidden" name="id" value="' . esc_attr( (string) $exercise['id'] ) . '">';
		wp_nonce_field( 'jf_exercise_library_save' );

		echo '<table class="form-table" role="presentation"><tbody>';
		self::render_text_input_row( 'Name', 'name', $exercise['name'], 'required' );
		self::render_text_input_row( 'Slug', 'slug', $exercise['slug'], '', 'text', '', '', 'Optional. Auto-generated from the name if left blank.' );
		self::render_textarea_row( 'Description', 'description', $exercise['description'], 4, 'Short admin-facing exercise description.' );
		self::render_text_input_row( 'Movement pattern', 'movement_pattern', $exercise['movement_pattern'], '', 'text', '', '', 'Examples: squat, horizontal_push, hip_hinge.' );
		self::render_text_input_row( 'Primary muscle', 'primary_muscle', $exercise['primary_muscle'], 'required', 'text', '', '', 'Examples: chest, back, quads.' );
		self::render_textarea_row( 'Secondary muscles', 'secondary_muscles', implode( "\n", $exercise['secondary_muscles'] ), 3, 'One muscle group per line.' );
		self::render_text_input_row( 'Equipment', 'equipment', $exercise['equipment'] );
		self::render_select_row( 'Difficulty', 'difficulty', $exercise['difficulty'], self::DIFFICULTY_OPTIONS );
		self::render_select_row( 'Progression', 'default_progression_type', $exercise['default_progression_type'], self::PROGRESSION_OPTIONS );
		self::render_text_input_row( 'Rep min', 'default_rep_min', (string) $exercise['default_rep_min'], '', 'number', '1', '1' );
		self::render_text_input_row( 'Rep max', 'default_rep_max', (string) $exercise['default_rep_max'], '', 'number', '1', '1' );
		self::render_text_input_row( 'Default sets', 'default_sets', (string) $exercise['default_sets'], '', 'number', '1', '1' );
		self::render_text_input_row( 'Age-friendly score', 'age_friendliness_score', (string) $exercise['age_friendliness_score'], '', 'number', '1', '1', '1 to 10' );
		self::render_text_input_row( 'Joint stress score', 'joint_stress_score', (string) $exercise['joint_stress_score'], '', 'number', '1', '1', '1 to 10' );
		self::render_text_input_row( 'Spinal load score', 'spinal_load_score', (string) $exercise['spinal_load_score'], '', 'number', '1', '1', '1 to 10' );
		self::render_checkbox_group_row( 'Splits', 'day_types', $exercise['day_types'], self::DAY_TYPE_OPTIONS );
		self::render_checkbox_group_row( 'Slots', 'slot_types', $exercise['slot_types'], self::SLOT_TYPE_OPTIONS );
		self::render_textarea_row( 'Coaching cues', 'coaching_cues', implode( "\n", $exercise['coaching_cues'] ), 4, 'One coaching cue per line.' );
		echo '<tr><th scope="row">Status</th><td><label><input type="checkbox" name="active" value="1"' . checked( ! empty( $exercise['active'] ), true, false ) . '> Active</label></td></tr>';
		echo '</tbody></table>';

		echo '<div class="jf-exercise-library__actions">';
		echo '<button type="submit" class="button button-primary" name="jf_exercise_action" value="save_exercise">' . esc_html( $is_edit ? 'Update Exercise' : 'Save Exercise' ) . '</button>';
		echo '<button type="submit" class="button button-secondary" name="jf_exercise_action" value="fill_exercise">AI Fill Empty Fields</button>';
		if ( $is_edit ) {
			echo '<a class="button button-secondary" href="' . esc_url( admin_url( 'admin.php?page=jf-exercise-library' ) ) . '">Add Another</a>';
		}
		echo '</div>';
		echo '</form>';
	}

	private static function render_discovery_form(array $finder): void {
		echo '<form method="post" class="jf-exercise-library__card">';
		echo '<h2 style="margin-top:0">Find Exercises With AI</h2>';
		echo '<input type="hidden" name="jf_exercise_action" value="discover_exercises">';
		wp_nonce_field( 'jf_exercise_library_discover' );

		echo '<table class="form-table" role="presentation"><tbody>';
		self::render_text_input_row( 'Search theme', 'query', (string) $finder['query'], '', 'text', '', '', 'Example: chest-supported back exercises or cable glute movements' );
		self::render_text_input_row( 'Result count', 'count', (string) $finder['count'], '', 'number', '1', '1', '1 to 10' );
		echo '</tbody></table>';

		submit_button( 'Find Exercises', 'secondary' );
		echo '</form>';
	}

	private static function render_discoveries(array $discoveries): void {
		$discoveries = array_values( array_map( [ __CLASS__, 'normalise_exercise' ], $discoveries ) );

		echo '<div class="jf-exercise-library__card">';
		echo '<form method="post">';
		echo '<input type="hidden" name="jf_exercise_action" value="import_discoveries">';
		echo '<input type="hidden" name="discoveries_payload" value="' . esc_attr( self::encode_discoveries_payload( $discoveries ) ) . '">';
		wp_nonce_field( 'jf_exercise_library_import_discoveries' );

		echo '<div class="jf-exercise-library__results-header">';
		echo '<div><h2 style="margin:0">AI Exercise Results</h2><p style="margin:6px 0 0;color:#50575e;">Select exercises to import, or bring in the full set at once.</p></div>';
		echo '<div class="jf-exercise-library__results-actions">';
		echo '<button type="button" class="button button-secondary button-small" data-jf-toggle-discoveries="all">Select all</button>';
		echo '<button type="button" class="button button-secondary button-small" data-jf-toggle-discoveries="none">Clear</button>';
		submit_button( 'Import Selected', 'primary', 'save_mode', false, [ 'value' => 'selected' ] );
		submit_button( 'Import All', 'secondary', 'save_mode', false, [ 'value' => 'all' ] );
		echo '</div>';
		echo '</div>';

		foreach ( $discoveries as $index => $exercise ) {
			echo '<div class="jf-exercise-library__discovery">';
			echo '<label>';
			echo '<input type="checkbox" name="selected_discoveries[]" value="' . esc_attr( (string) $index ) . '" checked>';
			echo '<div class="jf-exercise-library__discovery-body">';
			echo '<h3 style="margin:0 0 8px">' . esc_html( $exercise['name'] ) . '</h3>';
			if ( '' !== $exercise['description'] ) {
				echo '<p style="margin:0 0 8px;">' . esc_html( $exercise['description'] ) . '</p>';
			}
			echo '<p class="jf-exercise-library__meta"><strong>Muscles:</strong> ' . esc_html( self::format_label( $exercise['primary_muscle'] ) ) . ( ! empty( $exercise['secondary_muscles'] ) ? ' · ' . esc_html( implode( ', ', array_map( [ __CLASS__, 'format_label' ], $exercise['secondary_muscles'] ) ) ) : '' ) . '</p>';
			echo '<p class="jf-exercise-library__meta"><strong>Split / Slots:</strong> ' . esc_html( implode( ', ', array_map( [ __CLASS__, 'format_label' ], $exercise['day_types'] ) ) ?: 'None assigned' ) . ' · ' . esc_html( implode( ', ', array_map( [ __CLASS__, 'format_label' ], $exercise['slot_types'] ) ) ) . '</p>';
			echo '<p class="jf-exercise-library__meta"><strong>Programming:</strong> ' . esc_html( sprintf( '%d-%d reps × %d sets · %s · %s', (int) $exercise['default_rep_min'], (int) $exercise['default_rep_max'], (int) $exercise['default_sets'], self::format_label( $exercise['difficulty'] ), self::format_label( $exercise['default_progression_type'] ) ) ) . '</p>';
			echo '</div>';
			echo '</label>';
			echo '</div>';
		}

		echo '<script>
			document.addEventListener("click", function(event) {
				var toggle = event.target.closest("[data-jf-toggle-discoveries]");
				if (!toggle) {
					return;
				}
				var form = toggle.closest("form");
				if (!form) {
					return;
				}
				var shouldCheck = toggle.getAttribute("data-jf-toggle-discoveries") === "all";
				form.querySelectorAll("input[name=\'selected_discoveries[]\']").forEach(function(input) {
					input.checked = shouldCheck;
				});
			});
		</script>';
		echo '</form>';
		echo '</div>';
	}

	private static function render_list(array $exercises, array $list_state, array $filter_options, int $total_exercises): void {
		echo '<div class="jf-exercise-library__card">';
		echo '<h2 style="margin-top:0">Saved Exercises</h2>';
		self::render_list_filters( $list_state, $filter_options, count( $exercises ), $total_exercises );

		if ( empty( $exercises ) ) {
			echo '<p>' . esc_html( $total_exercises > 0 ? 'No exercises matched the current filters.' : 'No exercises saved yet.' ) . '</p>';
			echo '</div>';
			return;
		}

		echo '<table class="widefat striped jf-exercise-library__table"><thead><tr>';
		echo '<th>' . self::render_sort_link( 'Exercise', 'name', $list_state ) . '</th>';
		echo '<th>' . self::render_sort_link( 'Split / Slots', 'split', $list_state ) . '</th>';
		echo '<th>' . self::render_sort_link( 'Muscles', 'primary_muscle', $list_state ) . '</th>';
		echo '<th>' . self::render_sort_link( 'Programming', 'programming', $list_state ) . '</th>';
		echo '<th>' . self::render_sort_link( 'Status', 'status', $list_state ) . '</th>';
		echo '<th>Actions</th>';
		echo '</tr></thead><tbody>';
		foreach ( $exercises as $exercise ) {
			$edit_url = add_query_arg(
				[
					'page'        => 'jf-exercise-library',
					'exercise_id' => (int) $exercise['id'],
				],
				admin_url( 'admin.php' )
			);

			echo '<tr>';
			echo '<td>';
			echo '<strong>' . esc_html( $exercise['name'] ) . '</strong><br>';
			echo '<span class="jf-exercise-library__meta">' . esc_html( $exercise['slug'] ) . '</span>';
			if ( '' !== $exercise['description'] ) {
				echo '<p style="margin:8px 0 0;">' . esc_html( $exercise['description'] ) . '</p>';
			}
			echo '<p class="jf-exercise-library__meta">' . esc_html( ucfirst( $exercise['difficulty'] ) . ' · ' . $exercise['equipment'] . ' · ' . $exercise['movement_pattern'] ) . '</p>';
			echo '</td>';
			echo '<td>';
			echo esc_html( implode( ', ', array_map( [ __CLASS__, 'format_label' ], $exercise['day_types'] ) ) ?: 'None assigned' );
			echo '<p class="jf-exercise-library__meta"><strong>Slots:</strong> ' . esc_html( implode( ', ', array_map( [ __CLASS__, 'format_label' ], $exercise['slot_types'] ) ) ?: 'None assigned' ) . '</p>';
			echo '</td>';
			echo '<td>';
			echo '<strong>' . esc_html( self::format_label( $exercise['primary_muscle'] ) ) . '</strong>';
			if ( ! empty( $exercise['secondary_muscles'] ) ) {
				echo '<p class="jf-exercise-library__meta">' . esc_html( implode( ', ', array_map( [ __CLASS__, 'format_label' ], $exercise['secondary_muscles'] ) ) ) . '</p>';
			}
			echo '</td>';
			echo '<td>';
			echo esc_html( sprintf( '%d-%d reps × %d sets', (int) $exercise['default_rep_min'], (int) $exercise['default_rep_max'], (int) $exercise['default_sets'] ) );
			echo '<p class="jf-exercise-library__meta"><strong>Progression:</strong> ' . esc_html( self::format_label( $exercise['default_progression_type'] ) ) . '</p>';
			echo '<p class="jf-exercise-library__meta"><strong>Scores:</strong> Age ' . esc_html( (string) $exercise['age_friendliness_score'] ) . ' · Joint ' . esc_html( (string) $exercise['joint_stress_score'] ) . ' · Spinal ' . esc_html( (string) $exercise['spinal_load_score'] ) . '</p>';
			echo '</td>';
			echo '<td>';
			echo '<strong>' . esc_html( ! empty( $exercise['active'] ) ? 'Active' : 'Archived' ) . '</strong>';
			echo '<p class="jf-exercise-library__meta">' . esc_html( ucfirst( $exercise['difficulty'] ) ) . '</p>';
			echo '</td>';
			echo '<td>';
			echo '<p><a class="button button-small" href="' . esc_url( $edit_url ) . '">Edit</a></p>';
			echo '<form method="post">';
			echo '<input type="hidden" name="jf_exercise_action" value="toggle_exercise">';
			echo '<input type="hidden" name="exercise_id" value="' . esc_attr( (string) $exercise['id'] ) . '">';
			echo '<input type="hidden" name="active" value="' . esc_attr( ! empty( $exercise['active'] ) ? '0' : '1' ) . '">';
			wp_nonce_field( 'jf_exercise_library_toggle_' . (int) $exercise['id'] );
			submit_button( ! empty( $exercise['active'] ) ? 'Archive' : 'Restore', ! empty( $exercise['active'] ) ? 'secondary small' : 'primary small', '', false );
			echo '</form>';
			echo '</td>';
			echo '</tr>';
		}
		echo '</tbody></table>';
		echo '</div>';
	}

	private static function get_requested_exercise(): array {
		$id = (int) ( $_GET['exercise_id'] ?? 0 );
		if ( $id <= 0 ) {
			return self::empty_exercise();
		}

		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_exercises WHERE id = %d",
			$id
		), ARRAY_A );

		return is_array( $row ) ? self::normalise_exercise( $row ) : self::empty_exercise();
	}

	private static function get_exercises(): array {
		global $wpdb;
		$rows = $wpdb->get_results(
			"SELECT * FROM {$wpdb->prefix}fit_exercises",
			ARRAY_A
		);

		return array_values( array_map( [ __CLASS__, 'normalise_exercise' ], is_array( $rows ) ? $rows : [] ) );
	}

	private static function get_list_state(): array {
		$allowed_statuses = [ 'all', 'active', 'archived' ];
		$allowed_sorts    = [ '', 'name', 'split', 'primary_muscle', 'programming', 'status' ];

		$status = sanitize_key( (string) ( $_GET['status_filter'] ?? 'all' ) );
		$sort   = sanitize_key( (string) ( $_GET['sort'] ?? '' ) );
		$order  = 'desc' === strtolower( (string) ( $_GET['order'] ?? '' ) ) ? 'desc' : 'asc';

		return [
			'search'         => sanitize_text_field( wp_unslash( (string) ( $_GET['s'] ?? '' ) ) ),
			'status_filter'  => in_array( $status, $allowed_statuses, true ) ? $status : 'all',
			'primary_muscle' => sanitize_key( (string) ( $_GET['primary_muscle'] ?? '' ) ),
			'equipment'      => sanitize_key( (string) ( $_GET['equipment'] ?? '' ) ),
			'difficulty'     => sanitize_key( (string) ( $_GET['difficulty'] ?? '' ) ),
			'sort'           => in_array( $sort, $allowed_sorts, true ) ? $sort : '',
			'order'          => $order,
		];
	}

	private static function filter_exercises(array $exercises, array $list_state): array {
		$filtered = array_values( array_filter( $exercises, static function ( array $exercise ) use ( $list_state ): bool {
			if ( '' !== $list_state['search'] && ! self::exercise_matches_search( $exercise, $list_state['search'] ) ) {
				return false;
			}

			if ( 'active' === $list_state['status_filter'] && empty( $exercise['active'] ) ) {
				return false;
			}

			if ( 'archived' === $list_state['status_filter'] && ! empty( $exercise['active'] ) ) {
				return false;
			}

			if ( '' !== $list_state['primary_muscle'] && $list_state['primary_muscle'] !== sanitize_key( (string) $exercise['primary_muscle'] ) ) {
				return false;
			}

			if ( '' !== $list_state['equipment'] && $list_state['equipment'] !== sanitize_key( (string) $exercise['equipment'] ) ) {
				return false;
			}

			if ( '' !== $list_state['difficulty'] && $list_state['difficulty'] !== sanitize_key( (string) $exercise['difficulty'] ) ) {
				return false;
			}

			return true;
		} ) );

		usort( $filtered, static function ( array $left, array $right ) use ( $list_state ): int {
			return self::compare_exercises_for_list( $left, $right, $list_state );
		} );

		return $filtered;
	}

	private static function exercise_matches_search(array $exercise, string $search): bool {
		$needle = function_exists( 'mb_strtolower' ) ? mb_strtolower( trim( $search ) ) : strtolower( trim( $search ) );
		if ( '' === $needle ) {
			return true;
		}

		$haystack = implode( ' ', array_filter( [
			(string) ( $exercise['name'] ?? '' ),
			(string) ( $exercise['slug'] ?? '' ),
			(string) ( $exercise['description'] ?? '' ),
			(string) ( $exercise['movement_pattern'] ?? '' ),
			(string) ( $exercise['primary_muscle'] ?? '' ),
			implode( ' ', (array) ( $exercise['secondary_muscles'] ?? [] ) ),
			(string) ( $exercise['equipment'] ?? '' ),
			(string) ( $exercise['difficulty'] ?? '' ),
			implode( ' ', (array) ( $exercise['day_types'] ?? [] ) ),
			implode( ' ', (array) ( $exercise['slot_types'] ?? [] ) ),
		] ) );

		$haystack = function_exists( 'mb_strtolower' ) ? mb_strtolower( $haystack ) : strtolower( $haystack );
		return false !== strpos( $haystack, $needle );
	}

	private static function compare_exercises_for_list(array $left, array $right, array $list_state): int {
		$sort  = $list_state['sort'] ?? '';
		$order = 'desc' === ( $list_state['order'] ?? 'asc' ) ? 'desc' : 'asc';

		if ( '' === $sort ) {
			$status_compare = (int) $right['active'] <=> (int) $left['active'];
			if ( 0 !== $status_compare ) {
				return $status_compare;
			}

			return self::compare_strings( (string) $left['name'], (string) $right['name'] );
		}

		switch ( $sort ) {
			case 'status':
				$result = (int) $left['active'] <=> (int) $right['active'];
				break;
			case 'primary_muscle':
				$result = self::compare_strings( (string) $left['primary_muscle'], (string) $right['primary_muscle'] );
				break;
			case 'split':
				$result = self::compare_strings(
					implode( ', ', array_map( [ __CLASS__, 'format_label' ], (array) ( $left['day_types'] ?? [] ) ) ),
					implode( ', ', array_map( [ __CLASS__, 'format_label' ], (array) ( $right['day_types'] ?? [] ) ) )
				);
				break;
			case 'programming':
				$result = (int) $left['default_rep_min'] <=> (int) $right['default_rep_min'];
				if ( 0 === $result ) {
					$result = (int) $left['default_sets'] <=> (int) $right['default_sets'];
				}
				if ( 0 === $result ) {
					$result = self::compare_strings( (string) $left['difficulty'], (string) $right['difficulty'] );
				}
				break;
			case 'name':
			default:
				$result = self::compare_strings( (string) $left['name'], (string) $right['name'] );
				break;
		}

		if ( 'desc' === $order ) {
			$result *= -1;
		}

		if ( 0 !== $result ) {
			return $result;
		}

		return self::compare_strings( (string) $left['name'], (string) $right['name'] );
	}

	private static function compare_strings(string $left, string $right): int {
		return strcasecmp( $left, $right );
	}

	private static function get_filter_options(array $exercises): array {
		$options = [
			'primary_muscles' => [],
			'equipment'       => [],
		];

		foreach ( $exercises as $exercise ) {
			$primary_muscle = sanitize_key( (string) ( $exercise['primary_muscle'] ?? '' ) );
			$equipment      = sanitize_key( (string) ( $exercise['equipment'] ?? '' ) );

			if ( '' !== $primary_muscle ) {
				$options['primary_muscles'][ $primary_muscle ] = self::format_label( $primary_muscle );
			}

			if ( '' !== $equipment ) {
				$options['equipment'][ $equipment ] = self::format_label( $equipment );
			}
		}

		asort( $options['primary_muscles'] );
		asort( $options['equipment'] );

		return $options;
	}

	private static function render_list_filters(array $list_state, array $filter_options, int $visible_count, int $total_count): void {
		echo '<div class="jf-exercise-library__list-toolbar">';
		echo '<p class="jf-exercise-library__list-summary">Showing ' . esc_html( (string) $visible_count ) . ' of ' . esc_html( (string) $total_count ) . ' exercises.</p>';
		echo '</div>';

		echo '<form method="get" class="jf-exercise-library__filters">';
		echo '<input type="hidden" name="page" value="jf-exercise-library">';

		echo '<div class="jf-exercise-library__filter-field">';
		echo '<label for="jf-exercise-filter-search">Search</label>';
		echo '<input type="search" id="jf-exercise-filter-search" name="s" value="' . esc_attr( $list_state['search'] ) . '" placeholder="Name, slug, muscle, equipment">';
		echo '</div>';

		echo '<div class="jf-exercise-library__filter-field">';
		echo '<label for="jf-exercise-filter-status">Status</label>';
		echo '<select id="jf-exercise-filter-status" name="status_filter">';
		foreach ( [ 'all' => 'All statuses', 'active' => 'Active only', 'archived' => 'Archived only' ] as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '"' . selected( $list_state['status_filter'], $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select>';
		echo '</div>';

		echo '<div class="jf-exercise-library__filter-field">';
		echo '<label for="jf-exercise-filter-muscle">Primary muscle</label>';
		echo '<select id="jf-exercise-filter-muscle" name="primary_muscle">';
		echo '<option value="">All muscles</option>';
		foreach ( $filter_options['primary_muscles'] as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '"' . selected( $list_state['primary_muscle'], $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select>';
		echo '</div>';

		echo '<div class="jf-exercise-library__filter-field">';
		echo '<label for="jf-exercise-filter-equipment">Equipment</label>';
		echo '<select id="jf-exercise-filter-equipment" name="equipment">';
		echo '<option value="">All equipment</option>';
		foreach ( $filter_options['equipment'] as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '"' . selected( $list_state['equipment'], $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select>';
		echo '</div>';

		echo '<div class="jf-exercise-library__filter-field">';
		echo '<label for="jf-exercise-filter-difficulty">Difficulty</label>';
		echo '<select id="jf-exercise-filter-difficulty" name="difficulty">';
		echo '<option value="">All levels</option>';
		foreach ( self::DIFFICULTY_OPTIONS as $value => $label ) {
			echo '<option value="' . esc_attr( $value ) . '"' . selected( $list_state['difficulty'], $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select>';
		echo '</div>';

		echo '<div class="jf-exercise-library__filter-actions">';
		submit_button( 'Filter', 'secondary', '', false );
		echo '<a class="button button-link-delete" href="' . esc_url( admin_url( 'admin.php?page=jf-exercise-library' ) ) . '">Reset</a>';
		echo '</div>';

		echo '</form>';
	}

	private static function render_sort_link(string $label, string $sort_key, array $list_state): string {
		$current_sort  = (string) ( $list_state['sort'] ?? '' );
		$current_order = (string) ( $list_state['order'] ?? 'asc' );
		$is_current    = $current_sort === $sort_key;
		$next_order    = $is_current && 'asc' === $current_order ? 'desc' : 'asc';
		$indicator     = $is_current ? ( 'asc' === $current_order ? '↑' : '↓' ) : '↕';

		$url = add_query_arg(
			self::build_list_query_args( [
				'sort'  => $sort_key,
				'order' => $next_order,
			] ),
			admin_url( 'admin.php' )
		);

		return '<a class="jf-exercise-library__sort-link" href="' . esc_url( $url ) . '"><span>' . esc_html( $label ) . '</span><span class="jf-exercise-library__sort-indicator" aria-hidden="true">' . esc_html( $indicator ) . '</span></a>';
	}

	private static function build_list_query_args(array $overrides = []): array {
		$args = [
			'page'           => 'jf-exercise-library',
			's'              => sanitize_text_field( wp_unslash( (string) ( $_GET['s'] ?? '' ) ) ),
			'status_filter'  => sanitize_key( (string) ( $_GET['status_filter'] ?? 'all' ) ),
			'primary_muscle' => sanitize_key( (string) ( $_GET['primary_muscle'] ?? '' ) ),
			'equipment'      => sanitize_key( (string) ( $_GET['equipment'] ?? '' ) ),
			'difficulty'     => sanitize_key( (string) ( $_GET['difficulty'] ?? '' ) ),
			'sort'           => sanitize_key( (string) ( $_GET['sort'] ?? '' ) ),
			'order'          => 'desc' === strtolower( (string) ( $_GET['order'] ?? '' ) ) ? 'desc' : 'asc',
		];

		$args = array_merge( $args, $overrides );
		$filtered_args = [];

		foreach ( $args as $key => $value ) {
			if ( 'page' === $key ) {
				$filtered_args[ $key ] = $value;
				continue;
			}

			if ( 'status_filter' === $key && 'all' === $value ) {
				continue;
			}

			if ( 'order' === $key && 'asc' === $value && empty( $args['sort'] ) ) {
				continue;
			}

			if ( '' === (string) $value ) {
				continue;
			}

			$filtered_args[ $key ] = $value;
		}

		return $filtered_args;
	}

	private static function save_exercise(array $exercise): void {
		global $wpdb;

		$data = [
			'slug'                     => $exercise['slug'] ?: sanitize_title( $exercise['name'] ),
			'name'                     => $exercise['name'],
			'description'              => $exercise['description'],
			'movement_pattern'         => $exercise['movement_pattern'],
			'primary_muscle'           => $exercise['primary_muscle'],
			'secondary_muscles_json'   => wp_json_encode( $exercise['secondary_muscles'] ),
			'equipment'                => $exercise['equipment'],
			'difficulty'               => $exercise['difficulty'],
			'age_friendliness_score'   => $exercise['age_friendliness_score'],
			'joint_stress_score'       => $exercise['joint_stress_score'],
			'spinal_load_score'        => $exercise['spinal_load_score'],
			'default_rep_min'          => $exercise['default_rep_min'],
			'default_rep_max'          => $exercise['default_rep_max'],
			'default_sets'             => $exercise['default_sets'],
			'default_progression_type' => $exercise['default_progression_type'],
			'coaching_cues_json'       => wp_json_encode( $exercise['coaching_cues'] ),
			'day_types_json'           => wp_json_encode( $exercise['day_types'] ),
			'slot_types_json'          => wp_json_encode( $exercise['slot_types'] ),
			'active'                   => $exercise['active'],
		];

		if ( $exercise['id'] > 0 ) {
			$wpdb->update( $wpdb->prefix . 'fit_exercises', $data, [ 'id' => $exercise['id'] ] );
			return;
		}

		$wpdb->insert( $wpdb->prefix . 'fit_exercises', $data );
	}

	private static function set_exercise_active(int $id, int $active): void {
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'fit_exercises',
			[ 'active' => $active ],
			[ 'id' => $id ],
			[ '%d' ],
			[ '%d' ]
		);
	}

	private static function build_exercise_from_post(array $post): array {
		return self::normalise_exercise( [
			'id'                       => (int) ( $post['id'] ?? 0 ),
			'slug'                     => sanitize_title( (string) wp_unslash( $post['slug'] ?? '' ) ),
			'name'                     => sanitize_text_field( (string) wp_unslash( $post['name'] ?? '' ) ),
			'description'              => sanitize_textarea_field( (string) wp_unslash( $post['description'] ?? '' ) ),
			'movement_pattern'         => sanitize_text_field( (string) wp_unslash( $post['movement_pattern'] ?? '' ) ),
			'primary_muscle'           => sanitize_text_field( (string) wp_unslash( $post['primary_muscle'] ?? '' ) ),
			'secondary_muscles'        => preg_split( '/[\r\n,]+/', (string) wp_unslash( $post['secondary_muscles'] ?? '' ) ) ?: [],
			'equipment'                => sanitize_text_field( (string) wp_unslash( $post['equipment'] ?? 'other' ) ),
			'difficulty'               => sanitize_key( (string) ( $post['difficulty'] ?? 'beginner' ) ),
			'age_friendliness_score'   => (int) ( $post['age_friendliness_score'] ?? 5 ),
			'joint_stress_score'       => (int) ( $post['joint_stress_score'] ?? 3 ),
			'spinal_load_score'        => (int) ( $post['spinal_load_score'] ?? 3 ),
			'default_rep_min'          => (int) ( $post['default_rep_min'] ?? 8 ),
			'default_rep_max'          => (int) ( $post['default_rep_max'] ?? 12 ),
			'default_sets'             => (int) ( $post['default_sets'] ?? 3 ),
			'default_progression_type' => sanitize_key( (string) ( $post['default_progression_type'] ?? 'double_progression' ) ),
			'coaching_cues'            => preg_split( '/[\r\n]+/', (string) wp_unslash( $post['coaching_cues'] ?? '' ) ) ?: [],
			'day_types'                => (array) ( $post['day_types'] ?? [] ),
			'slot_types'               => (array) ( $post['slot_types'] ?? [] ),
			'active'                   => ! empty( $post['active'] ) ? 1 : 0,
		] );
	}

	private static function normalise_exercise(array $exercise): array {
		return [
			'id'                       => (int) ( $exercise['id'] ?? 0 ),
			'slug'                     => sanitize_title( (string) ( $exercise['slug'] ?? '' ) ),
			'name'                     => sanitize_text_field( (string) ( $exercise['name'] ?? '' ) ),
			'description'              => sanitize_textarea_field( (string) ( $exercise['description'] ?? '' ) ),
			'movement_pattern'         => sanitize_text_field( (string) ( $exercise['movement_pattern'] ?? '' ) ),
			'primary_muscle'           => sanitize_text_field( (string) ( $exercise['primary_muscle'] ?? '' ) ),
			'secondary_muscles'        => self::normalise_list( $exercise['secondary_muscles'] ?? ( $exercise['secondary_muscles_json'] ?? [] ) ),
			'equipment'                => sanitize_text_field( (string) ( $exercise['equipment'] ?? 'other' ) ),
			'difficulty'               => sanitize_key( (string) ( $exercise['difficulty'] ?? 'beginner' ) ) ?: 'beginner',
			'age_friendliness_score'   => max( 1, min( 10, (int) ( $exercise['age_friendliness_score'] ?? 5 ) ) ),
			'joint_stress_score'       => max( 1, min( 10, (int) ( $exercise['joint_stress_score'] ?? 3 ) ) ),
			'spinal_load_score'        => max( 1, min( 10, (int) ( $exercise['spinal_load_score'] ?? 3 ) ) ),
			'default_rep_min'          => max( 1, (int) ( $exercise['default_rep_min'] ?? 8 ) ),
			'default_rep_max'          => max( 1, (int) ( $exercise['default_rep_max'] ?? 12 ) ),
			'default_sets'             => max( 1, (int) ( $exercise['default_sets'] ?? 3 ) ),
			'default_progression_type' => sanitize_key( (string) ( $exercise['default_progression_type'] ?? 'double_progression' ) ) ?: 'double_progression',
			'coaching_cues'            => self::normalise_list( $exercise['coaching_cues'] ?? ( $exercise['coaching_cues_json'] ?? [] ) ),
			'day_types'                => self::normalise_list( $exercise['day_types'] ?? ( $exercise['day_types_json'] ?? [] ) ),
			'slot_types'               => self::normalise_list( $exercise['slot_types'] ?? ( $exercise['slot_types_json'] ?? [] ) ),
			'active'                   => isset( $exercise['active'] ) ? (int) (bool) $exercise['active'] : 1,
		];
	}

	private static function merge_missing_exercise_fields(array $current, array $filled): array {
		$merged = self::normalise_exercise( array_merge( $filled, $current ) );

		foreach ( $current as $key => $value ) {
			if ( ! self::is_empty_exercise_value( $value, $key, $current ) ) {
				$merged[ $key ] = $value;
			} elseif ( array_key_exists( $key, $filled ) ) {
				$merged[ $key ] = $filled[ $key ];
			}
		}

		return self::normalise_exercise( $merged );
	}

	private static function empty_exercise(): array {
		return [
			'id'                       => 0,
			'slug'                     => '',
			'name'                     => '',
			'description'              => '',
			'movement_pattern'         => '',
			'primary_muscle'           => '',
			'secondary_muscles'        => [],
			'equipment'                => 'other',
			'difficulty'               => 'beginner',
			'age_friendliness_score'   => 5,
			'joint_stress_score'       => 3,
			'spinal_load_score'        => 3,
			'default_rep_min'          => 8,
			'default_rep_max'          => 12,
			'default_sets'             => 3,
			'default_progression_type' => 'double_progression',
			'coaching_cues'            => [],
			'day_types'                => [],
			'slot_types'               => [ 'accessory' ],
			'active'                   => 1,
		];
	}

	private static function encode_discoveries_payload(array $discoveries): string {
		return base64_encode( (string) wp_json_encode( array_values( array_map( [ __CLASS__, 'normalise_exercise' ], $discoveries ) ) ) );
	}

	private static function decode_discoveries_payload($payload): array {
		$decoded = base64_decode( sanitize_text_field( wp_unslash( (string) $payload ) ), true );
		if ( false === $decoded ) {
			return [];
		}

		$discoveries = json_decode( $decoded, true );
		if ( ! is_array( $discoveries ) ) {
			return [];
		}

		return array_values( array_filter( array_map( [ __CLASS__, 'normalise_exercise' ], $discoveries ), 'is_array' ) );
	}

	private static function normalise_list($value): array {
		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			if ( is_array( $decoded ) ) {
				$value = $decoded;
			} else {
				$value = preg_split( '/[\r\n,]+/', $value ) ?: [];
			}
		}

		if ( ! is_array( $value ) ) {
			return [];
		}

		return array_values( array_filter( array_map( static fn( $item ): string => sanitize_text_field( (string) $item ), $value ) ) );
	}

	private static function is_empty_exercise_value($value, string $key = '', array $exercise = []): bool {
		if (
			0 === (int) ( $exercise['id'] ?? 0 )
			&& '' !== $key
			&& self::matches_new_exercise_default( $value, $key )
		) {
			return true;
		}

		if ( is_array( $value ) ) {
			return count( array_filter( $value, static fn( $item ) => '' !== trim( (string) $item ) ) ) === 0;
		}

		if ( is_numeric( $value ) ) {
			return (float) $value <= 0;
		}

		return '' === trim( (string) $value );
	}

	private static function matches_new_exercise_default($value, string $key): bool {
		$defaults = self::empty_exercise();
		if ( ! array_key_exists( $key, $defaults ) ) {
			return false;
		}

		$default_value = $defaults[ $key ];

		if ( is_array( $value ) || is_array( $default_value ) ) {
			return self::normalise_list( $value ) === self::normalise_list( $default_value );
		}

		if ( is_numeric( $value ) || is_numeric( $default_value ) ) {
			return (float) $value === (float) $default_value;
		}

		return trim( (string) $value ) === trim( (string) $default_value );
	}

	private static function render_text_input_row(string $label, string $name, string $value, string $extra = '', string $type = 'text', string $min = '', string $step = '', string $description = ''): void {
		echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<input class="regular-text" type="' . esc_attr( $type ) . '" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" ' . $extra;
		if ( '' !== $min ) {
			echo ' min="' . esc_attr( $min ) . '"';
		}
		if ( '' !== $step ) {
			echo ' step="' . esc_attr( $step ) . '"';
		}
		echo '>';
		if ( '' !== $description ) {
			echo '<p class="description">' . esc_html( $description ) . '</p>';
		}
		echo '</td></tr>';
	}

	private static function render_textarea_row(string $label, string $name, string $value, int $rows, string $description = ''): void {
		echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<textarea class="large-text" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" rows="' . esc_attr( (string) $rows ) . '">' . esc_textarea( $value ) . '</textarea>';
		if ( '' !== $description ) {
			echo '<p class="description">' . esc_html( $description ) . '</p>';
		}
		echo '</td></tr>';
	}

	private static function render_select_row(string $label, string $name, string $value, array $options): void {
		echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<select id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '">';
		foreach ( $options as $option_value => $option_label ) {
			echo '<option value="' . esc_attr( (string) $option_value ) . '"' . selected( $value, (string) $option_value, false ) . '>' . esc_html( (string) $option_label ) . '</option>';
		}
		echo '</select>';
		echo '</td></tr>';
	}

	private static function render_checkbox_group_row(string $label, string $name, array $selected, array $options): void {
		echo '<tr><th scope="row">' . esc_html( $label ) . '</th><td><div class="jf-exercise-library__checkbox-grid">';
		foreach ( $options as $option_value => $option_label ) {
			echo '<label><input type="checkbox" name="' . esc_attr( $name ) . '[]" value="' . esc_attr( (string) $option_value ) . '"' . checked( in_array( $option_value, $selected, true ), true, false ) . '> ' . esc_html( (string) $option_label ) . '</label>';
		}
		echo '</div></td></tr>';
	}

	private static function format_label(string $value): string {
		return ucwords( str_replace( '_', ' ', $value ) );
	}
}
