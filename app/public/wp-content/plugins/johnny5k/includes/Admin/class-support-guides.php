<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\SupportGuideService;

class SupportGuides {

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$saved = false;
		$reset = false;

		if ( 'POST' === $_SERVER['REQUEST_METHOD'] && check_admin_referer( 'jf_support_guides_save' ) ) {
			if ( isset( $_POST['jf_reset_support_guides'] ) ) {
				SupportGuideService::save_support_guides( SupportGuideService::default_guides() );
				$reset = true;
			} elseif ( isset( $_POST['jf_save_support_guides'] ) ) {
				SupportGuideService::save_support_guides( wp_unslash( $_POST['jf_support_guides'] ?? [] ) );
				$saved = true;
			}
		}

		$guides = SupportGuideService::get_support_guides_config();
		$analytics = SupportGuideService::support_analytics_payload( 30 );

		echo '<div class="wrap jf-support-guides-page">';
		echo '<h1>Support Guides</h1>';
		echo '<p style="max-width:940px">These guides are Johnny\'s editable in-app help layer. Each guide teaches one real task in the product, gives Johnny grounded copy to start from, and can optionally tell the app exactly where to navigate. Edit the starter pack here in WordPress and Johnny will use it across the app.</p>';

		if ( $saved ) {
			echo '<div class="notice notice-success is-dismissible"><p>Support guides saved.</p></div>';
		}
		if ( $reset ) {
			echo '<div class="notice notice-success is-dismissible"><p>Support guides reset to the starter pack.</p></div>';
		}

		echo '<div style="display:grid;grid-template-columns:minmax(0,2.2fr) minmax(280px,1fr);gap:24px;align-items:start">';
		echo '<div>';
		echo '<form method="post" id="jf-support-guides-form">';
		wp_nonce_field( 'jf_support_guides_save' );
		echo '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 16px">';
		echo '<button type="submit" name="jf_save_support_guides" class="button button-primary">Save Support Guides</button>';
		echo '<button type="button" id="jf-add-support-guide" class="button button-secondary">Add guide</button>';
		echo '<button type="submit" name="jf_reset_support_guides" class="button" onclick="return window.confirm(\'Reset all support guides to the starter pack?\')">Reset to starter pack</button>';
		echo '</div>';

		echo '<div id="jf-support-guide-list" style="display:grid;gap:16px">';
		foreach ( $guides as $index => $guide ) {
			self::render_guide_card( $guide, (string) $index );
		}
		echo '</div>';
		echo '</form>';
		echo '</div>';

		echo '<aside style="display:grid;gap:16px">';
		self::render_help_panel();
		self::render_analytics_panel( $analytics );
		echo '</aside>';
		echo '</div>';

		$template_guide = self::empty_guide();
		echo '<template id="jf-support-guide-template">';
		self::render_guide_card( $template_guide, '__INDEX__' );
		echo '</template>';

		self::render_inline_script( count( $guides ) );
		echo '</div>';
	}

	private static function render_help_panel(): void {
		echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:12px;padding:16px">';
		echo '<h2 style="margin-top:0">What each field does</h2>';
		echo '<ul style="margin:0 0 0 18px;display:grid;gap:8px">';
		echo '<li><strong>Summary</strong>: the short explanation Johnny should trust before improvising.</li>';
		echo '<li><strong>Starter prompt</strong>: the handoff prompt used when a user taps a guided help entry point.</li>';
		echo '<li><strong>Steps</strong>: the exact in-app path Johnny should walk through.</li>';
		echo '<li><strong>Common issues</strong>: the mistakes or confusion points Johnny should watch for.</li>';
		echo '<li><strong>Route path and focus</strong>: where the app should deep-link when Johnny returns an open-screen action.</li>';
		echo '<li><strong>Keywords and intents</strong>: phrases that help the guide match the user\'s message.</li>';
		echo '</ul>';
		echo '<p style="margin:12px 0 0;color:#50575e">Use one guide per task. Keep titles concrete, like <em>Log a meal from a photo</em> or <em>Swap a workout exercise</em>, instead of broad buckets like <em>Nutrition help</em>.</p>';
		echo '</div>';
	}

	private static function render_analytics_panel( array $analytics ): void {
		$totals = is_array( $analytics['totals'] ?? null ) ? $analytics['totals'] : [];
		$top_guides = is_array( $analytics['top_guides'] ?? null ) ? $analytics['top_guides'] : [];

		echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:12px;padding:16px">';
		echo '<h2 style="margin-top:0">Last 30 days</h2>';
		echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">';
		self::render_stat_tile( 'Entrypoints', (int) ( $totals['entrypoints'] ?? 0 ), 'Help opens from the app' );
		self::render_stat_tile( 'Prompt starts', (int) ( $totals['prompts_started'] ?? 0 ), 'Guided prompts sent to Johnny' );
		self::render_stat_tile( 'Resolved', (int) ( $totals['navigations'] ?? 0 ), 'Chats that led to action or navigation' );
		self::render_stat_tile( 'Unresolved', (int) ( $totals['unresolved'] ?? 0 ), 'Chats without a clear next move' );
		echo '</div>';

		if ( ! empty( $top_guides ) ) {
			echo '<h3 style="margin:18px 0 10px">Top guides</h3>';
			echo '<div style="display:grid;gap:10px">';
			foreach ( array_slice( $top_guides, 0, 6 ) as $row ) {
				echo '<div style="border:1px solid #e0e0e0;border-radius:10px;padding:10px 12px;background:#f6f7f7">';
				echo '<strong>' . esc_html( (string) ( $row['guide_id'] ?? 'unknown' ) ) . '</strong>';
				echo '<p style="margin:4px 0 0;color:#50575e">' . esc_html( sprintf(
					'%d prompts, %d resolved, %d unresolved',
					(int) ( $row['prompts_started'] ?? 0 ),
					(int) ( $row['navigations'] ?? 0 ),
					(int) ( $row['unresolved'] ?? 0 )
				) ) . '</p>';
				echo '</div>';
			}
			echo '</div>';
		}
		echo '</div>';
	}

	private static function render_stat_tile( string $label, int $value, string $caption ): void {
		echo '<div style="border:1px solid #e0e0e0;border-radius:10px;padding:12px;background:#f6f7f7">';
		echo '<strong style="display:block;font-size:20px">' . esc_html( number_format_i18n( $value ) ) . '</strong>';
		echo '<span style="display:block;margin-top:4px">' . esc_html( $label ) . '</span>';
		echo '<p style="margin:6px 0 0;color:#50575e">' . esc_html( $caption ) . '</p>';
		echo '</div>';
	}

	private static function render_guide_card( array $guide, string $index ): void {
		$title = (string) ( $guide['title'] ?? '' );
		echo '<section class="jf-support-guide-card" style="background:#fff;border:1px solid #dcdcde;border-radius:12px;padding:16px">';
		echo '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px">';
		echo '<div>';
		echo '<h2 style="margin:0 0 4px;font-size:18px">' . esc_html( $title !== '' ? $title : 'New support guide' ) . '</h2>';
		echo '<p style="margin:0;color:#50575e">Task-level help copy and optional deep-link metadata.</p>';
		echo '</div>';
		echo '<div style="display:flex;gap:8px;align-items:center">';
		echo '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="jf_support_guides[' . esc_attr( $index ) . '][enabled]" value="1"' . checked( ! empty( $guide['enabled'] ), true, false ) . '> Enabled</label>';
		echo '<button type="button" class="button-link-delete jf-remove-support-guide">Remove</button>';
		echo '</div>';
		echo '</div>';

		echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">';
		self::render_text_input( 'Title', 'title', $guide, $index, 'Log a meal' );
		self::render_text_input( 'ID', 'id', $guide, $index, 'log-meal' );
		self::render_text_input( 'Action label', 'action_label', $guide, $index, 'Open meal logging' );
		self::render_text_input( 'Route path', 'route_path', $guide, $index, '/nutrition' );
		self::render_text_input( 'Route screen', 'route_screen', $guide, $index, 'nutrition' );
		self::render_text_input( 'Focus section', 'focus_section', $guide, $index, 'savedMeals' );
		self::render_text_input( 'Focus tab', 'focus_tab', $guide, $index, 'sleep' );
		self::render_textarea( 'Route notice', 'route_notice', $guide, $index, 2, 'Shown after Johnny opens the route.' );
		echo '</div>';

		self::render_textarea( 'Summary', 'summary', $guide, $index, 3, 'Short source-of-truth explanation Johnny should trust.' );
		self::render_textarea( 'Starter prompt', 'starter_prompt', $guide, $index, 3, 'Used when a guided help entry point opens Johnny.' );

		echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">';
		self::render_list_textarea( 'Keywords', 'keywords', $guide, $index, 'One keyword or phrase per line.' );
		self::render_list_textarea( 'Intents', 'intents', $guide, $index, 'Full user asks that should strongly match this guide.' );
		self::render_list_textarea( 'Steps', 'steps', $guide, $index, 'One step per line. Keep it concrete and in product order.' );
		self::render_list_textarea( 'Common issues', 'common_issues', $guide, $index, 'One confusion point per line.' );
		echo '</div>';
		self::render_list_textarea( 'Related tasks', 'related_tasks', $guide, $index, 'One related task per line.' );
		echo '</section>';
	}

	private static function render_text_input( string $label, string $field, array $guide, string $index, string $placeholder = '' ): void {
		echo '<label style="display:grid;gap:6px">';
		echo '<span>' . esc_html( $label ) . '</span>';
		echo '<input type="text" class="regular-text" style="width:100%;max-width:none" name="jf_support_guides[' . esc_attr( $index ) . '][' . esc_attr( $field ) . ']" value="' . esc_attr( (string) ( $guide[ $field ] ?? '' ) ) . '" placeholder="' . esc_attr( $placeholder ) . '">';
		echo '</label>';
	}

	private static function render_textarea( string $label, string $field, array $guide, string $index, int $rows, string $description = '' ): void {
		echo '<label style="display:grid;gap:6px;margin-top:12px">';
		echo '<span>' . esc_html( $label ) . '</span>';
		echo '<textarea rows="' . esc_attr( (string) $rows ) . '" style="width:100%" name="jf_support_guides[' . esc_attr( $index ) . '][' . esc_attr( $field ) . ']">' . esc_textarea( (string) ( $guide[ $field ] ?? '' ) ) . '</textarea>';
		if ( '' !== $description ) {
			echo '<span style="color:#50575e">' . esc_html( $description ) . '</span>';
		}
		echo '</label>';
	}

	private static function render_list_textarea( string $label, string $field, array $guide, string $index, string $description = '' ): void {
		$value = implode( "\n", array_map( 'strval', is_array( $guide[ $field ] ?? null ) ? $guide[ $field ] : [] ) );
		echo '<label style="display:grid;gap:6px;margin-top:12px">';
		echo '<span>' . esc_html( $label ) . '</span>';
		echo '<textarea rows="5" style="width:100%" name="jf_support_guides[' . esc_attr( $index ) . '][' . esc_attr( $field ) . ']">' . esc_textarea( $value ) . '</textarea>';
		if ( '' !== $description ) {
			echo '<span style="color:#50575e">' . esc_html( $description ) . '</span>';
		}
		echo '</label>';
	}

	private static function empty_guide(): array {
		return [
			'id' => '',
			'title' => '',
			'enabled' => 1,
			'action_label' => '',
			'route_notice' => '',
			'summary' => '',
			'keywords' => [],
			'intents' => [],
			'route_path' => '',
			'route_screen' => '',
			'focus_section' => '',
			'focus_tab' => '',
			'starter_prompt' => '',
			'steps' => [],
			'common_issues' => [],
			'related_tasks' => [],
		];
	}

	private static function render_inline_script( int $guide_count ): void {
		?>
		<script>
		(function () {
			const list = document.getElementById('jf-support-guide-list');
			const addButton = document.getElementById('jf-add-support-guide');
			const template = document.getElementById('jf-support-guide-template');
			let nextIndex = <?php echo (int) max( 1, $guide_count ); ?>;

			function wireCard(card) {
				const removeButton = card.querySelector('.jf-remove-support-guide');
				if (!removeButton) {
					return;
				}
				removeButton.addEventListener('click', function () {
					card.remove();
				});
			}

			list.querySelectorAll('.jf-support-guide-card').forEach(wireCard);

			addButton.addEventListener('click', function () {
				const html = template.innerHTML.replaceAll('__INDEX__', String(nextIndex++));
				const fragment = document.createRange().createContextualFragment(html);
				const card = fragment.querySelector('.jf-support-guide-card');
				if (!card) {
					return;
				}
				list.appendChild(card);
				wireCard(card);
				card.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		}());
		</script>
		<?php
	}
}