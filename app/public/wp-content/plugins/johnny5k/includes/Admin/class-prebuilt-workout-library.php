<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\PrebuiltWorkoutLibraryService;

class PrebuiltWorkoutLibrary {
	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$state      = self::handle_post();
		$form       = ! empty( $state['form'] ) ? $state['form'] : self::get_requested_workout();
		$workouts   = PrebuiltWorkoutLibraryService::get_library();
		$exercises  = PrebuiltWorkoutLibraryService::get_global_exercise_options();

		echo '<div class="wrap jf-prebuilt-workout-library">';
		self::render_styles();
		echo '<h1>Johnny5k Prebuilt Workouts</h1>';
		echo '<p>Manage reusable prebuilt workouts that members can queue from the Workout page.</p>';

		foreach ( $state['errors'] as $error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $error ) . '</p></div>';
		}

		foreach ( $state['messages'] as $message ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
		}

		echo '<div class="jf-prebuilt-workout-library__layout">';
		echo '<div class="jf-prebuilt-workout-library__sidebar">';
		self::render_form( $form, $exercises );
		echo '</div>';
		echo '<div class="jf-prebuilt-workout-library__content">';
		self::render_list( $workouts );
		echo '</div>';
		echo '</div>';
		echo '</div>';
	}

	private static function handle_post(): array {
		$state = [
			'messages' => [],
			'errors'   => [],
			'form'     => self::empty_workout(),
		];

		if ( 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
			return $state;
		}

		$action = sanitize_key( (string) ( $_POST['jf_prebuilt_workout_action'] ?? '' ) );
		if ( '' === $action ) {
			return $state;
		}

		switch ( $action ) {
			case 'save_workout':
				check_admin_referer( 'jf_prebuilt_workout_library_save' );
				$workout = self::build_workout_from_post( $_POST );
				$state['form'] = $workout;

				if ( '' === $workout['title'] ) {
					$state['errors'][] = 'Workout title is required.';
					return $state;
				}

				if ( empty( $workout['exercises'] ) ) {
					$state['errors'][] = 'Add at least one exercise to the workout.';
					return $state;
				}

				$saved = PrebuiltWorkoutLibraryService::save_item( $workout );
				$state['messages'][] = (int) ( $workout['id'] ?? 0 ) > 0
					? sprintf( 'Updated %s.', $saved['title'] )
					: sprintf( 'Saved %s.', $saved['title'] );
				$state['form'] = self::empty_workout();
				return $state;

			case 'delete_workout':
				$id = (int) ( $_POST['workout_id'] ?? 0 );
				check_admin_referer( 'jf_prebuilt_workout_library_delete_' . $id );
				if ( $id > 0 ) {
					PrebuiltWorkoutLibraryService::delete_item( $id );
					$state['messages'][] = 'Prebuilt workout deleted.';
				}
				return $state;
		}

		return $state;
	}

	private static function render_styles(): void {
		echo '<style>
			.jf-prebuilt-workout-library__layout{display:grid;grid-template-columns:minmax(360px,460px) minmax(0,1fr);gap:24px;align-items:start}
			.jf-prebuilt-workout-library__sidebar,.jf-prebuilt-workout-library__content{min-width:0}
			.jf-prebuilt-workout-library__card{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px}
			.jf-prebuilt-workout-library__card + .jf-prebuilt-workout-library__card{margin-top:24px}
			.jf-prebuilt-workout-library .form-table,.jf-prebuilt-workout-library .form-table tbody,.jf-prebuilt-workout-library .form-table td{width:100%}
			.jf-prebuilt-workout-library .form-table th{width:150px}
			.jf-prebuilt-workout-library .form-table input.regular-text,
			.jf-prebuilt-workout-library .form-table textarea.large-text,
			.jf-prebuilt-workout-library .form-table select{width:100%;max-width:100%;box-sizing:border-box}
			.jf-prebuilt-workout-library__checkbox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}
			.jf-prebuilt-workout-library__exercise-list{display:grid;gap:12px}
			.jf-prebuilt-workout-library__exercise-row{display:grid;grid-template-columns:minmax(0,1.8fr) repeat(3,minmax(72px,1fr)) auto;gap:10px;align-items:end;padding:12px;border:1px solid #dcdcde;border-radius:8px;background:#f8f9fa}
			.jf-prebuilt-workout-library__exercise-row label{display:grid;gap:6px;font-weight:600}
			.jf-prebuilt-workout-library__exercise-row select,.jf-prebuilt-workout-library__exercise-row input{width:100%}
			.jf-prebuilt-workout-library__toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
			.jf-prebuilt-workout-library__list{display:grid;gap:16px}
			.jf-prebuilt-workout-library__meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
			.jf-prebuilt-workout-library__chip{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;background:#f0f6ff;color:#0f1f55;font-size:12px;font-weight:600}
			.jf-prebuilt-workout-library__exercise-summary{margin:0;padding-left:18px}
			.jf-prebuilt-workout-library__actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
			@media (max-width: 1200px){.jf-prebuilt-workout-library__layout{grid-template-columns:1fr}}
			@media (max-width: 782px){
				.jf-prebuilt-workout-library__checkbox-grid{grid-template-columns:1fr}
				.jf-prebuilt-workout-library__exercise-row{grid-template-columns:1fr 1fr}
				.jf-prebuilt-workout-library__exercise-row > .jf-prebuilt-workout-library__remove{grid-column:1 / -1}
			}
		</style>';
	}

	private static function render_form( array $form, array $exercise_options ): void {
		echo '<form method="post" class="jf-prebuilt-workout-library__card">';
		echo '<h2 style="margin-top:0">' . ( ! empty( $form['id'] ) ? 'Edit prebuilt workout' : 'Add prebuilt workout' ) . '</h2>';
		echo '<input type="hidden" name="jf_prebuilt_workout_action" value="save_workout">';
		echo '<input type="hidden" name="id" value="' . esc_attr( (string) ( $form['id'] ?? '' ) ) . '">';
		wp_nonce_field( 'jf_prebuilt_workout_library_save' );

		echo '<table class="form-table" role="presentation"><tbody>';
		self::render_text_input_row( 'Title', 'title', (string) ( $form['title'] ?? '' ), 'required' );
		self::render_textarea_row( 'Description', 'description', (string) ( $form['description'] ?? '' ), 4, 'Short note shown on the Workout page.' );
		self::render_select_row( 'Gym setup', 'required_gym_setup', (string) ( $form['required_gym_setup'] ?? 'Full gym' ), PrebuiltWorkoutLibraryService::get_gym_setup_options() );
		echo '<tr><th scope="row">Body part icons</th><td>';
		echo '<div class="jf-prebuilt-workout-library__checkbox-grid">';
		foreach ( PrebuiltWorkoutLibraryService::get_body_part_icon_options() as $value => $label ) {
			$checked = in_array( $value, (array) ( $form['body_part_icons'] ?? [] ), true ) ? ' checked' : '';
			echo '<label><input type="checkbox" name="body_part_icons[]" value="' . esc_attr( $value ) . '"' . $checked . '> ' . esc_html( $label ) . '</label>';
		}
		echo '</div>';
		echo '<p class="description">Choose the body-part icons members will see on the Workout page card.</p>';
		echo '</td></tr>';
		echo '</tbody></table>';

		echo '<h3>Exercises</h3>';
		echo '<div class="jf-prebuilt-workout-library__toolbar"><button type="button" class="button" id="jf-prebuilt-workout-add-row">Add exercise</button><span class="description">Pick the exercise plus sets and rep range.</span></div>';
		echo '<div class="jf-prebuilt-workout-library__exercise-list" id="jf-prebuilt-workout-exercise-list">';
		$rows = ! empty( $form['exercises'] ) ? $form['exercises'] : [ [] ];
		foreach ( array_values( $rows ) as $index => $exercise ) {
			self::render_exercise_row( $index, $exercise, $exercise_options );
		}
		echo '</div>';

		submit_button( ! empty( $form['id'] ) ? 'Update Prebuilt Workout' : 'Save Prebuilt Workout' );
		echo '</form>';

		echo '<template id="jf-prebuilt-workout-row-template">';
		self::render_exercise_row( '__INDEX__', [], $exercise_options );
		echo '</template>';

		echo '<script>
			(() => {
				const list = document.getElementById("jf-prebuilt-workout-exercise-list");
				const addButton = document.getElementById("jf-prebuilt-workout-add-row");
				const template = document.getElementById("jf-prebuilt-workout-row-template");
				if (!list || !addButton || !template) return;

				let nextIndex = list.querySelectorAll("[data-prebuilt-workout-row]").length;

				function bindRemoveButtons(scope) {
					scope.querySelectorAll("[data-prebuilt-workout-remove]").forEach(button => {
						button.addEventListener("click", () => {
							const rows = list.querySelectorAll("[data-prebuilt-workout-row]");
							if (rows.length <= 1) {
								const inputs = button.closest("[data-prebuilt-workout-row]")?.querySelectorAll("input");
								inputs?.forEach(input => { input.value = input.type === "number" ? input.defaultValue || "" : ""; });
								const selects = button.closest("[data-prebuilt-workout-row]")?.querySelectorAll("select");
								selects?.forEach(select => { select.selectedIndex = 0; });
								return;
							}
							button.closest("[data-prebuilt-workout-row]")?.remove();
						}, { once: true });
					});
				}

				addButton.addEventListener("click", () => {
					const html = template.innerHTML.replaceAll("__INDEX__", String(nextIndex++));
					const wrapper = document.createElement("div");
					wrapper.innerHTML = html;
					const row = wrapper.firstElementChild;
					if (!row) return;
					list.appendChild(row);
					bindRemoveButtons(row);
				});

				bindRemoveButtons(list);
			})();
		</script>';
	}

	private static function render_exercise_row( $index, array $exercise, array $exercise_options ): void {
		echo '<div class="jf-prebuilt-workout-library__exercise-row" data-prebuilt-workout-row>';
		echo '<label>Exercise<select name="exercises[' . esc_attr( (string) $index ) . '][exercise_id]">';
		echo '<option value="">Choose an exercise</option>';
		foreach ( $exercise_options as $option ) {
			$value = (int) ( $option['id'] ?? 0 );
			$label = trim( (string) ( $option['name'] ?? '' ) );
			if ( '' === $label || $value <= 0 ) {
				continue;
			}
			echo '<option value="' . esc_attr( (string) $value ) . '"' . selected( (int) ( $exercise['exercise_id'] ?? 0 ), $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select></label>';
		echo '<label>Sets<input type="number" min="1" name="exercises[' . esc_attr( (string) $index ) . '][sets]" value="' . esc_attr( (string) ( $exercise['sets'] ?? 3 ) ) . '"></label>';
		echo '<label>Rep min<input type="number" min="1" name="exercises[' . esc_attr( (string) $index ) . '][rep_min]" value="' . esc_attr( (string) ( $exercise['rep_min'] ?? 8 ) ) . '"></label>';
		echo '<label>Rep max<input type="number" min="1" name="exercises[' . esc_attr( (string) $index ) . '][rep_max]" value="' . esc_attr( (string) ( $exercise['rep_max'] ?? 12 ) ) . '"></label>';
		echo '<button type="button" class="button-link-delete jf-prebuilt-workout-library__remove" data-prebuilt-workout-remove>Remove</button>';
		echo '</div>';
	}

	private static function render_list( array $workouts ): void {
		echo '<div class="jf-prebuilt-workout-library__card">';
		echo '<h2 style="margin-top:0">Saved prebuilt workouts</h2>';

		if ( empty( $workouts ) ) {
			echo '<p class="description">No prebuilt workouts saved yet.</p>';
			echo '</div>';
			return;
		}

		echo '<div class="jf-prebuilt-workout-library__list">';
		foreach ( $workouts as $workout ) {
			$edit_url = add_query_arg(
				[
					'page'       => 'jf-prebuilt-workouts',
					'workout_id' => (int) ( $workout['id'] ?? 0 ),
				],
				admin_url( 'admin.php' )
			);

			echo '<div style="border:1px solid #dcdcde;border-radius:8px;padding:16px;background:#fff">';
			echo '<strong>' . esc_html( (string) ( $workout['title'] ?? 'Prebuilt workout' ) ) . '</strong>';
			if ( ! empty( $workout['description'] ) ) {
				echo '<p>' . esc_html( (string) $workout['description'] ) . '</p>';
			}
			echo '<div class="jf-prebuilt-workout-library__meta">';
			echo '<span class="jf-prebuilt-workout-library__chip">' . esc_html( (string) ( $workout['required_gym_setup'] ?? 'Full gym' ) ) . '</span>';
			foreach ( (array) ( $workout['body_part_icons'] ?? [] ) as $icon ) {
				$label = PrebuiltWorkoutLibraryService::get_body_part_icon_options()[ $icon ] ?? $icon;
				echo '<span class="jf-prebuilt-workout-library__chip">' . esc_html( $label ) . '</span>';
			}
			echo '</div>';
			echo '<ol class="jf-prebuilt-workout-library__exercise-summary">';
			foreach ( array_slice( (array) ( $workout['exercises'] ?? [] ), 0, 6 ) as $exercise ) {
				$rep_label = (int) ( $exercise['rep_min'] ?? 0 ) === (int) ( $exercise['rep_max'] ?? 0 )
					? (string) ( $exercise['rep_min'] ?? 0 )
					: (string) ( $exercise['rep_min'] ?? 0 ) . '-' . (string) ( $exercise['rep_max'] ?? 0 );
				echo '<li>' . esc_html( (string) ( $exercise['exercise_name'] ?? 'Exercise' ) . ' · ' . (int) ( $exercise['sets'] ?? 0 ) . ' x ' . $rep_label ) . '</li>';
			}
			echo '</ol>';
			echo '<div class="jf-prebuilt-workout-library__actions">';
			echo '<a class="button button-secondary" href="' . esc_url( $edit_url ) . '">Edit</a>';
			echo '<form method="post" style="margin:0">';
			echo '<input type="hidden" name="jf_prebuilt_workout_action" value="delete_workout">';
			echo '<input type="hidden" name="workout_id" value="' . esc_attr( (string) ( $workout['id'] ?? 0 ) ) . '">';
			wp_nonce_field( 'jf_prebuilt_workout_library_delete_' . (int) ( $workout['id'] ?? 0 ) );
			submit_button( 'Delete', 'delete small', '', false );
			echo '</form>';
			echo '</div>';
			echo '</div>';
		}
		echo '</div>';
		echo '</div>';
	}

	private static function get_requested_workout(): array {
		$workout_id = (int) ( $_GET['workout_id'] ?? 0 );
		if ( $workout_id <= 0 ) {
			return self::empty_workout();
		}

		return PrebuiltWorkoutLibraryService::get_item( $workout_id ) ?? self::empty_workout();
	}

	private static function build_workout_from_post( array $post ): array {
		$workout = [
			'id'                 => (int) ( $post['id'] ?? 0 ),
			'title'              => sanitize_text_field( (string) wp_unslash( $post['title'] ?? '' ) ),
			'description'        => sanitize_textarea_field( (string) wp_unslash( $post['description'] ?? '' ) ),
			'required_gym_setup' => sanitize_text_field( (string) wp_unslash( $post['required_gym_setup'] ?? 'Full gym' ) ),
			'body_part_icons'    => array_values( array_filter( array_map( 'sanitize_key', (array) wp_unslash( $post['body_part_icons'] ?? [] ) ) ) ),
			'exercises'          => array_values( array_filter( array_map( static function( $row ): array {
				$row = is_array( $row ) ? $row : [];
				return [
					'exercise_id' => (int) ( $row['exercise_id'] ?? 0 ),
					'sets'        => max( 1, (int) ( $row['sets'] ?? 3 ) ),
					'rep_min'     => max( 1, (int) ( $row['rep_min'] ?? 8 ) ),
					'rep_max'     => max( 1, (int) ( $row['rep_max'] ?? 12 ) ),
				];
			}, (array) wp_unslash( $post['exercises'] ?? [] ) ), static fn( array $row ): bool => (int) ( $row['exercise_id'] ?? 0 ) > 0 ) ),
		];

		return PrebuiltWorkoutLibraryService::normalise_item( $workout, (int) ( $workout['id'] ?? 0 ) );
	}

	private static function empty_workout(): array {
		return [
			'id'                 => 0,
			'title'              => '',
			'description'        => '',
			'required_gym_setup' => 'Full gym',
			'body_part_icons'    => [],
			'exercises'          => [],
		];
	}

	private static function render_text_input_row( string $label, string $name, string $value, string $attributes = '' ): void {
		echo '<tr><th scope="row"><label for="jf-prebuilt-workout-' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<input class="regular-text" id="jf-prebuilt-workout-' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" ' . $attributes . '>';
		echo '</td></tr>';
	}

	private static function render_textarea_row( string $label, string $name, string $value, int $rows = 4, string $help = '' ): void {
		echo '<tr><th scope="row"><label for="jf-prebuilt-workout-' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<textarea class="large-text" id="jf-prebuilt-workout-' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" rows="' . (int) $rows . '">' . esc_textarea( $value ) . '</textarea>';
		if ( '' !== $help ) {
			echo '<p class="description">' . esc_html( $help ) . '</p>';
		}
		echo '</td></tr>';
	}

	private static function render_select_row( string $label, string $name, string $current, array $options ): void {
		echo '<tr><th scope="row"><label for="jf-prebuilt-workout-' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<select id="jf-prebuilt-workout-' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '">';
		foreach ( $options as $value => $option_label ) {
			echo '<option value="' . esc_attr( (string) $value ) . '"' . selected( $current, (string) $value, false ) . '>' . esc_html( (string) $option_label ) . '</option>';
		}
		echo '</select></td></tr>';
	}
}
