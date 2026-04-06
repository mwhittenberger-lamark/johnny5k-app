<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;

class RecipeLibrary {

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$state = self::handle_post();
		$recipes = self::get_recipe_library();

		echo '<div class="wrap">';
		echo '<h1>Johnny5k Recipe Library</h1>';
		echo '<p>Manage the shared recipe library and import new ideas with AI-backed recipe search.</p>';

		foreach ( $state['errors'] as $error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $error ) . '</p></div>';
		}

		foreach ( $state['messages'] as $message ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
		}

		echo '<div style="display:grid;grid-template-columns:minmax(320px,420px) minmax(320px,1fr);gap:24px;align-items:start;">';
		echo '<div>';
		self::render_manual_form( $state['form'] );
		self::render_discovery_form( $state['finder'] );
		echo '</div>';

		echo '<div>';
		if ( ! empty( $state['discoveries'] ) ) {
			self::render_discoveries( $state['discoveries'] );
		}
		self::render_library_list( $recipes );
		echo '</div>';
		echo '</div>';
		echo '</div>';
	}

	private static function handle_post(): array {
		$state = [
			'messages'    => [],
			'errors'      => [],
			'discoveries' => [],
			'form'        => self::empty_recipe_form(),
			'finder'      => [
				'query'     => '',
				'meal_type' => 'lunch',
				'count'     => 5,
			],
		];

		if ( 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
			return $state;
		}

		$action = sanitize_key( (string) ( $_POST['jf_recipe_action'] ?? '' ) );
		if ( '' === $action ) {
			return $state;
		}

		switch ( $action ) {
			case 'save_recipe':
				check_admin_referer( 'jf_recipe_library_save' );
				$recipe = self::build_recipe_from_post( $_POST );
				$state['form'] = $recipe;

				if ( '' === $recipe['recipe_name'] ) {
					$state['errors'][] = 'Recipe name is required.';
					return $state;
				}
				if ( empty( $recipe['ingredients'] ) || empty( $recipe['instructions'] ) ) {
					$state['errors'][] = 'Add at least one ingredient and one instruction.';
					return $state;
				}

				self::upsert_recipe( $recipe );
				$state['messages'][] = sprintf( 'Saved %s.', $recipe['recipe_name'] );
				$state['form'] = self::empty_recipe_form( $recipe['meal_type'] );
				return $state;

			case 'discover_recipes':
				check_admin_referer( 'jf_recipe_library_discover' );
				$finder = [
					'query'     => sanitize_text_field( wp_unslash( $_POST['query'] ?? '' ) ),
					'meal_type' => sanitize_key( (string) ( $_POST['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
					'count'     => max( 1, min( 10, (int) ( $_POST['count'] ?? 5 ) ) ),
				];
				$state['finder'] = $finder;

				$result = AiService::discover_recipe_library_items( get_current_user_id(), $finder );
				if ( is_wp_error( $result ) ) {
					$state['errors'][] = $result->get_error_message();
					return $state;
				}

				$state['discoveries'] = array_values( array_filter( (array) ( $result['recipes'] ?? [] ), 'is_array' ) );
				$state['messages'][] = ! empty( $result['used_web_search'] )
					? 'AI recipe search complete.'
					: 'AI recipe suggestions generated.';
				return $state;

			case 'delete_recipe':
				$id = (int) ( $_POST['recipe_id'] ?? 0 );
				check_admin_referer( 'jf_recipe_library_delete_' . $id );
				if ( $id > 0 ) {
					self::delete_recipe( $id );
					$state['messages'][] = 'Recipe deleted.';
				}
				return $state;
		}

		return $state;
	}

	private static function render_manual_form( array $form ): void {
		echo '<form method="post" style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px;margin-bottom:24px;">';
		echo '<h2 style="margin-top:0">Add Recipe</h2>';
		echo '<input type="hidden" name="jf_recipe_action" value="save_recipe">';
		wp_nonce_field( 'jf_recipe_library_save' );

		echo '<table class="form-table" role="presentation"><tbody>';
		self::render_text_input_row( 'Recipe name', 'recipe_name', $form['recipe_name'], 'required' );
		self::render_select_row( 'Meal type', 'meal_type', $form['meal_type'], [
			'breakfast' => 'Breakfast',
			'lunch'     => 'Lunch',
			'dinner'    => 'Dinner',
			'snack'     => 'Snack',
		] );
		self::render_textarea_row( 'Ingredients', 'ingredients', implode( "\n", $form['ingredients'] ), 5, 'One ingredient per line' );
		self::render_textarea_row( 'Instructions', 'instructions', implode( "\n", $form['instructions'] ), 5, 'One step per line' );
		self::render_text_input_row( 'Calories', 'estimated_calories', (string) $form['estimated_calories'], '', 'number', '0' );
		self::render_text_input_row( 'Protein (g)', 'estimated_protein_g', (string) $form['estimated_protein_g'], '', 'number', '0', '0.1' );
		self::render_text_input_row( 'Carbs (g)', 'estimated_carbs_g', (string) $form['estimated_carbs_g'], '', 'number', '0', '0.1' );
		self::render_text_input_row( 'Fat (g)', 'estimated_fat_g', (string) $form['estimated_fat_g'], '', 'number', '0', '0.1' );
		self::render_textarea_row( 'Why this works', 'why_this_works', $form['why_this_works'], 3, 'Short fitness-focused note' );
		self::render_text_input_row( 'Source title', 'source_title', $form['source_title'] );
		self::render_text_input_row( 'Source URL', 'source_url', $form['source_url'], '', 'url' );
		echo '</tbody></table>';

		submit_button( 'Save Recipe' );
		echo '</form>';
	}

	private static function render_discovery_form( array $finder ): void {
		echo '<form method="post" style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px;">';
		echo '<h2 style="margin-top:0">Find Recipes With AI</h2>';
		echo '<input type="hidden" name="jf_recipe_action" value="discover_recipes">';
		wp_nonce_field( 'jf_recipe_library_discover' );

		echo '<table class="form-table" role="presentation"><tbody>';
		self::render_text_input_row( 'Search theme', 'query', (string) $finder['query'], '', 'text', '', '', 'Example: high protein chicken bowls' );
		self::render_select_row( 'Meal type', 'meal_type', (string) $finder['meal_type'], [
			'breakfast' => 'Breakfast',
			'lunch'     => 'Lunch',
			'dinner'    => 'Dinner',
			'snack'     => 'Snack',
		] );
		self::render_text_input_row( 'Result count', 'count', (string) $finder['count'], '', 'number', '1', '1', '1 to 10' );
		echo '</tbody></table>';

		submit_button( 'Find Recipes', 'secondary' );
		echo '</form>';
	}

	private static function render_discoveries( array $discoveries ): void {
		echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px;margin-bottom:24px;">';
		echo '<h2 style="margin-top:0">AI Results</h2>';

		foreach ( $discoveries as $index => $recipe ) {
			echo '<div style="border-top:' . ( 0 === $index ? '0' : '1px solid #f0f0f1' ) . ';padding:16px 0;">';
			echo '<h3 style="margin:0 0 8px">' . esc_html( (string) $recipe['recipe_name'] ) . '</h3>';
			echo '<p style="margin:0 0 8px;color:#50575e;"><strong>' . esc_html( ucfirst( (string) $recipe['meal_type'] ) ) . '</strong> · ' . esc_html( (string) round( (float) ( $recipe['estimated_calories'] ?? 0 ) ) ) . ' kcal · ' . esc_html( (string) round( (float) ( $recipe['estimated_protein_g'] ?? 0 ) ) ) . 'g protein</p>';
			if ( ! empty( $recipe['why_this_works'] ) ) {
				echo '<p style="margin:0 0 8px;">' . esc_html( (string) $recipe['why_this_works'] ) . '</p>';
			}
			echo '<p style="margin:0 0 8px;"><strong>Ingredients:</strong> ' . esc_html( implode( ', ', (array) ( $recipe['ingredients'] ?? [] ) ) ) . '</p>';
			if ( ! empty( $recipe['source_url'] ) ) {
				echo '<p style="margin:0 0 12px;"><a href="' . esc_url( (string) $recipe['source_url'] ) . '" target="_blank" rel="noreferrer">' . esc_html( (string) ( $recipe['source_title'] ?: $recipe['source_url'] ) ) . '</a></p>';
			}

			echo '<form method="post">';
			echo '<input type="hidden" name="jf_recipe_action" value="save_recipe">';
			wp_nonce_field( 'jf_recipe_library_save' );
			self::render_recipe_hidden_fields( $recipe );
			submit_button( 'Save To Library', 'primary small', '', false );
			echo '</form>';
			echo '</div>';
		}

		echo '</div>';
	}

	private static function render_library_list( array $recipes ): void {
		echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px;">';
		echo '<h2 style="margin-top:0">Saved Recipes</h2>';

		if ( empty( $recipes ) ) {
			echo '<p>No recipes saved yet.</p>';
			echo '</div>';
			return;
		}

		echo '<table class="widefat striped"><thead><tr><th>Recipe</th><th>Macros</th><th>Source</th><th style="width:120px">Actions</th></tr></thead><tbody>';
		foreach ( $recipes as $recipe ) {
			echo '<tr>';
			echo '<td>';
			echo '<strong>' . esc_html( (string) $recipe['recipe_name'] ) . '</strong><br>';
			echo '<span style="color:#50575e">' . esc_html( ucfirst( (string) $recipe['meal_type'] ) ) . '</span>';
			if ( ! empty( $recipe['why_this_works'] ) ) {
				echo '<p style="margin:6px 0 0;">' . esc_html( (string) $recipe['why_this_works'] ) . '</p>';
			}
			echo '<p style="margin:6px 0 0;color:#50575e">' . esc_html( implode( ', ', array_slice( (array) $recipe['ingredients'], 0, 6 ) ) ) . '</p>';
			echo '</td>';
			echo '<td>' . esc_html( sprintf(
				'%d kcal / %sg P / %sg C / %sg F',
				(int) ( $recipe['estimated_calories'] ?? 0 ),
				self::format_decimal( $recipe['estimated_protein_g'] ?? 0 ),
				self::format_decimal( $recipe['estimated_carbs_g'] ?? 0 ),
				self::format_decimal( $recipe['estimated_fat_g'] ?? 0 )
			) ) . '</td>';
			echo '<td>';
			if ( ! empty( $recipe['source_url'] ) ) {
				echo '<a href="' . esc_url( (string) $recipe['source_url'] ) . '" target="_blank" rel="noreferrer">' . esc_html( (string) ( $recipe['source_title'] ?: $recipe['source_url'] ) ) . '</a><br>';
			}
			echo '<span style="color:#50575e">' . esc_html( ucfirst( str_replace( '_', ' ', (string) ( $recipe['source_type'] ?? 'manual' ) ) ) ) . '</span>';
			echo '</td>';
			echo '<td>';
			echo '<form method="post" onsubmit="return confirm(\'Delete this recipe?\');">';
			echo '<input type="hidden" name="jf_recipe_action" value="delete_recipe">';
			echo '<input type="hidden" name="recipe_id" value="' . esc_attr( (string) ( $recipe['id'] ?? 0 ) ) . '">';
			wp_nonce_field( 'jf_recipe_library_delete_' . (int) ( $recipe['id'] ?? 0 ) );
			submit_button( 'Delete', 'delete small', '', false );
			echo '</form>';
			echo '</td>';
			echo '</tr>';
		}
		echo '</tbody></table>';
		echo '</div>';
	}

	private static function get_recipe_library(): array {
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( array_map( [ __CLASS__, 'normalise_recipe' ], $recipes ) ) : [];

		usort( $recipes, static function( array $left, array $right ): int {
			$meal_cmp = strcmp( (string) ( $left['meal_type'] ?? '' ), (string) ( $right['meal_type'] ?? '' ) );
			if ( 0 !== $meal_cmp ) {
				return $meal_cmp;
			}

			return strcmp( (string) ( $left['recipe_name'] ?? '' ), (string) ( $right['recipe_name'] ?? '' ) );
		} );

		return $recipes;
	}

	private static function upsert_recipe( array $recipe ): void {
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( $recipes ) : [];
		$recipe = self::normalise_recipe( $recipe );
		$updated = false;

		foreach ( $recipes as $index => $existing ) {
			if ( (int) ( $existing['id'] ?? 0 ) === (int) $recipe['id'] ) {
				$recipes[ $index ] = $recipe;
				$updated = true;
				break;
			}
		}

		if ( ! $updated ) {
			$recipes[] = $recipe;
		}

		update_option( 'jf_recipe_library', $recipes, false );
	}

	private static function delete_recipe( int $id ): void {
		$recipes = get_option( 'jf_recipe_library', [] );
		$recipes = is_array( $recipes ) ? array_values( array_filter( $recipes, static fn( $recipe ) => (int) ( $recipe['id'] ?? 0 ) !== $id ) ) : [];
		update_option( 'jf_recipe_library', $recipes, false );
	}

	private static function build_recipe_from_post( array $post ): array {
		$id = (int) ( $post['id'] ?? 0 );
		return self::normalise_recipe( [
			'id'                  => $id > 0 ? $id : self::generate_recipe_id(),
			'recipe_name'         => sanitize_text_field( wp_unslash( $post['recipe_name'] ?? '' ) ),
			'meal_type'           => sanitize_key( (string) ( $post['meal_type'] ?? 'lunch' ) ),
			'ingredients'         => preg_split( '/[\r\n,]+/', (string) wp_unslash( $post['ingredients'] ?? '' ) ) ?: [],
			'instructions'        => preg_split( '/[\r\n]+/', (string) wp_unslash( $post['instructions'] ?? '' ) ) ?: [],
			'estimated_calories'  => (int) ( $post['estimated_calories'] ?? 0 ),
			'estimated_protein_g' => (float) ( $post['estimated_protein_g'] ?? 0 ),
			'estimated_carbs_g'   => (float) ( $post['estimated_carbs_g'] ?? 0 ),
			'estimated_fat_g'     => (float) ( $post['estimated_fat_g'] ?? 0 ),
			'why_this_works'      => sanitize_text_field( wp_unslash( $post['why_this_works'] ?? '' ) ),
			'source_title'        => sanitize_text_field( wp_unslash( $post['source_title'] ?? '' ) ),
			'source_url'          => esc_url_raw( wp_unslash( $post['source_url'] ?? '' ) ),
			'source_type'         => sanitize_key( (string) ( $post['source_type'] ?? 'manual' ) ),
		] );
	}

	private static function normalise_recipe( array $recipe ): array {
		return [
			'id'                  => (int) ( $recipe['id'] ?? self::generate_recipe_id() ),
			'recipe_name'         => sanitize_text_field( (string) ( $recipe['recipe_name'] ?? '' ) ),
			'meal_type'           => sanitize_key( (string) ( $recipe['meal_type'] ?? 'lunch' ) ) ?: 'lunch',
			'ingredients'         => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['ingredients'] ?? [] ) ) ) ),
			'instructions'        => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $recipe['instructions'] ?? [] ) ) ) ),
			'estimated_calories'  => (int) ( $recipe['estimated_calories'] ?? 0 ),
			'estimated_protein_g' => (float) ( $recipe['estimated_protein_g'] ?? 0 ),
			'estimated_carbs_g'   => (float) ( $recipe['estimated_carbs_g'] ?? 0 ),
			'estimated_fat_g'     => (float) ( $recipe['estimated_fat_g'] ?? 0 ),
			'why_this_works'      => sanitize_text_field( (string) ( $recipe['why_this_works'] ?? '' ) ),
			'source_title'        => sanitize_text_field( (string) ( $recipe['source_title'] ?? '' ) ),
			'source_url'          => esc_url_raw( (string) ( $recipe['source_url'] ?? '' ) ),
			'source_type'         => sanitize_key( (string) ( $recipe['source_type'] ?? 'manual' ) ) ?: 'manual',
		];
	}

	private static function empty_recipe_form( string $meal_type = 'lunch' ): array {
		return [
			'id'                  => 0,
			'recipe_name'         => '',
			'meal_type'           => $meal_type,
			'ingredients'         => [],
			'instructions'        => [],
			'estimated_calories'  => 0,
			'estimated_protein_g' => 0,
			'estimated_carbs_g'   => 0,
			'estimated_fat_g'     => 0,
			'why_this_works'      => '',
			'source_title'        => '',
			'source_url'          => '',
			'source_type'         => 'manual',
		];
	}

	private static function render_text_input_row( string $label, string $name, string $value, string $extra = '', string $type = 'text', string $min = '', string $step = '', string $description = '' ): void {
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

	private static function render_textarea_row( string $label, string $name, string $value, int $rows, string $description = '' ): void {
		echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<textarea class="large-text" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" rows="' . esc_attr( (string) $rows ) . '">' . esc_textarea( $value ) . '</textarea>';
		if ( '' !== $description ) {
			echo '<p class="description">' . esc_html( $description ) . '</p>';
		}
		echo '</td></tr>';
	}

	private static function render_select_row( string $label, string $name, string $value, array $options ): void {
		echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<select id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '">';
		foreach ( $options as $option_value => $option_label ) {
			echo '<option value="' . esc_attr( (string) $option_value ) . '"' . selected( $value, (string) $option_value, false ) . '>' . esc_html( (string) $option_label ) . '</option>';
		}
		echo '</select>';
		echo '</td></tr>';
	}

	private static function render_recipe_hidden_fields( array $recipe ): void {
		$recipe = self::normalise_recipe( $recipe );
		echo '<input type="hidden" name="id" value="' . esc_attr( (string) $recipe['id'] ) . '">';
		echo '<input type="hidden" name="recipe_name" value="' . esc_attr( (string) $recipe['recipe_name'] ) . '">';
		echo '<input type="hidden" name="meal_type" value="' . esc_attr( (string) $recipe['meal_type'] ) . '">';
		echo '<input type="hidden" name="ingredients" value="' . esc_attr( implode( "\n", (array) $recipe['ingredients'] ) ) . '">';
		echo '<input type="hidden" name="instructions" value="' . esc_attr( implode( "\n", (array) $recipe['instructions'] ) ) . '">';
		echo '<input type="hidden" name="estimated_calories" value="' . esc_attr( (string) $recipe['estimated_calories'] ) . '">';
		echo '<input type="hidden" name="estimated_protein_g" value="' . esc_attr( (string) $recipe['estimated_protein_g'] ) . '">';
		echo '<input type="hidden" name="estimated_carbs_g" value="' . esc_attr( (string) $recipe['estimated_carbs_g'] ) . '">';
		echo '<input type="hidden" name="estimated_fat_g" value="' . esc_attr( (string) $recipe['estimated_fat_g'] ) . '">';
		echo '<input type="hidden" name="why_this_works" value="' . esc_attr( (string) $recipe['why_this_works'] ) . '">';
		echo '<input type="hidden" name="source_title" value="' . esc_attr( (string) $recipe['source_title'] ) . '">';
		echo '<input type="hidden" name="source_url" value="' . esc_attr( (string) $recipe['source_url'] ) . '">';
		echo '<input type="hidden" name="source_type" value="' . esc_attr( (string) $recipe['source_type'] ) . '">';
	}

	private static function format_decimal( $value ): string {
		$number = (float) $value;
		return ( abs( $number - round( $number ) ) < 0.01 ) ? (string) (int) round( $number ) : number_format( $number, 1 );
	}

	private static function generate_recipe_id(): int {
		return (int) ( time() . wp_rand( 100, 999 ) );
	}
}
