<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\AdminApiController;

/**
 * Settings page — stores all API keys and integration config as wp_options.
 *
 * Options saved here:
 *   jf_openai_api_key          — OpenAI secret key (sk-…)
 *   jf_clicksend_username      — ClickSend account username / email
 *   jf_clicksend_api_key       — ClickSend API key
 *   jf_clicksend_sender_id     — SMS sender name (max 11 chars) or number
 */
class Settings {

	/** Option keys managed by this page. */
	private const FIELDS = [
		'jf_openai_api_key'      => [ 'label' => 'OpenAI API Key',          'type' => 'password', 'placeholder' => 'sk-…'        ],
		'jf_usda_api_key'        => [ 'label' => 'USDA API Key',            'type' => 'password', 'placeholder' => 'DEMO_KEY or your key' ],
		'jf_clicksend_username'  => [ 'label' => 'ClickSend Username',       'type' => 'text',     'placeholder' => 'you@email.com' ],
		'jf_clicksend_api_key'   => [ 'label' => 'ClickSend API Key',        'type' => 'password', 'placeholder' => ''             ],
		'jf_clicksend_sender_id' => [ 'label' => 'SMS Sender ID (≤11 chars)','type' => 'text',     'placeholder' => 'Johnny5000'  ],
	];

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$saved   = false;
		$errors  = [];

		// ── Handle form save ──────────────────────────────────────────────
		if ( $_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer( 'jf_settings_save' ) ) {
			foreach ( self::FIELDS as $key => $field ) {
				$val = sanitize_text_field( wp_unslash( $_POST[ $key ] ?? '' ) );

				// Don't overwrite an existing key with an empty submission
				// (form shows masked value; user may not have re-typed it)
				if ( $val === '' && get_option( $key ) !== false ) {
					continue;
				}

				if ( $key === 'jf_clicksend_sender_id' && mb_strlen( $val ) > 11 ) {
					$errors[] = 'Sender ID must be 11 characters or fewer.';
					continue;
				}

				update_option( $key, $val, false );
			}

			if ( isset( $_POST['jf_color_schemes'] ) ) {
				update_option(
					'jf_color_schemes',
					AdminApiController::sanitize_color_schemes( wp_unslash( $_POST['jf_color_schemes'] ) ),
					false
				);
			}

			if ( empty( $errors ) ) {
				$saved = true;
			}
		}

		// ── Render ────────────────────────────────────────────────────────
		echo '<div class="wrap">';
		echo '<h1>Johnny5k — Settings</h1>';

		if ( $saved ) {
			echo '<div class="notice notice-success is-dismissible"><p>Settings saved.</p></div>';
		}
		foreach ( $errors as $e ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $e ) . '</p></div>';
		}

		echo '<form method="post">';
		wp_nonce_field( 'jf_settings_save' );

		echo '<table class="form-table" role="presentation">';

		// ── OpenAI section ────────────────────────────────────────────────
		echo '<tr><th colspan="2"><h2 style="margin:0">OpenAI</h2></th></tr>';
		self::render_field( 'jf_openai_api_key' );
		echo '<tr><td></td><td><p class="description">Used for the AI coach (Johnny 5000), meal analysis, and workout summaries. Get your key at <strong>platform.openai.com/api-keys</strong>.</p></td></tr>';
		echo '<tr><th colspan="2"><h2 style="margin:0;padding-top:16px">Nutrition Sources</h2></th></tr>';
		self::render_field( 'jf_usda_api_key' );
		echo '<tr><td></td><td><p class="description">Used to improve meal-photo nutrition accuracy with USDA FoodData Central. Leave blank to fall back to USDA demo access.</p></td></tr>';

		// ── ClickSend section ─────────────────────────────────────────────
		$current_sender_id = (string) get_option( 'jf_clicksend_sender_id', '' );
		$effective_sender_id = $current_sender_id !== '' ? $current_sender_id : 'Johnny5000';
		echo '<tr><th colspan="2"><h2 style="margin:0;padding-top:16px">ClickSend SMS</h2></th></tr>';
		self::render_field( 'jf_clicksend_username' );
		self::render_field( 'jf_clicksend_api_key' );
		echo '<tr><th scope="row">Effective SMS Sender</th><td><strong>' . esc_html( $effective_sender_id ) . '</strong><p class="description" style="margin:6px 0 0">This is the sender name Johnny5k will use when texting users. If you leave the field below blank, it falls back to Johnny5000.</p></td></tr>';
		self::render_field( 'jf_clicksend_sender_id' );
		echo '<tr><td></td><td><p class="description">Used for daily motivation and milestone SMS messages. Credentials found in your ClickSend dashboard under <strong>API Credentials</strong>.</p></td></tr>';

		echo '<tr><th colspan="2"><h2 style="margin:0;padding-top:16px">Color Schemes</h2></th></tr>';
		echo '<tr><td colspan="2">';
		self::render_color_schemes_editor();
		echo '</td></tr>';

		echo '</table>';

		submit_button( 'Save Settings' );
		echo '</form>';

		// ── Connection test buttons ───────────────────────────────────────
		echo '<hr>';
		echo '<h2>Test Connections</h2>';
		echo '<p>';
		echo '<button class="button" id="jf-test-openai">Test OpenAI</button> ';
		echo '<span id="jf-openai-result" style="margin-left:8px"></span>';
		echo '</p>';
		echo '<h2 style="margin-top:24px">Test SMS Reminder</h2>';
		echo '<p class="description">Sends a real SMS to the selected user using their saved phone, timezone, and reminder settings context.</p>';
		echo '<p>';
		echo '<select id="jf-sms-user" style="min-width:280px"></select> ';
		echo '<select id="jf-sms-trigger">';
		echo '<option value="workout_reminder">Workout reminder</option>';
		echo '<option value="meal_reminder">Meal reminder</option>';
		echo '<option value="sleep_reminder">Sleep reminder</option>';
		echo '<option value="weekly_summary">Weekly summary</option>';
		echo '</select> ';
		echo '<button class="button" id="jf-test-sms">Send Test SMS</button> ';
		echo '<span id="jf-sms-result" style="margin-left:8px"></span>';
		echo '</p>';
		self::render_recent_sms_logs();

		self::render_test_script();

		echo '</div>'; // .wrap
	}

	// ── Private helpers ───────────────────────────────────────────────────

	private static function render_field( string $key ): void {
		$field = self::FIELDS[ $key ];
		$val   = (string) get_option( $key, '' );

		$is_secret = $field['type'] === 'password';
		$display = '';
		if ( $val !== '' && $is_secret ) {
			$display = str_repeat( '•', max( 0, strlen( $val ) - 4 ) ) . substr( $val, -4 );
		}

		echo '<tr>';
		echo '<th scope="row"><label for="' . esc_attr( $key ) . '">' . esc_html( $field['label'] ) . '</label></th>';
		echo '<td>';
		echo '<input type="' . esc_attr( $field['type'] ) . '" ';
		echo 'id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '" ';
		echo 'value="' . esc_attr( $is_secret ? '' : $val ) . '" ';
		echo 'placeholder="' . esc_attr( $is_secret && $val !== '' ? $display : $field['placeholder'] ) . '" ';
		echo 'class="regular-text">';

		if ( $val !== '' ) {
			echo '<span style="color:#666;margin-left:8px">✓ Set</span>';
		}
		echo '</td>';
		echo '</tr>';
	}

	private static function render_recent_sms_logs(): void {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT l.id, l.user_id, l.phone, l.trigger_type, l.message_preview, l.status, l.cost_usd,
			        l.clicksend_message_id, l.sent_at, l.created_at, u.user_email, p.first_name, p.last_name
			 FROM {$wpdb->prefix}fit_sms_logs l
			 LEFT JOIN {$wpdb->prefix}users u ON u.ID = l.user_id
			 LEFT JOIN {$wpdb->prefix}fit_user_profiles p ON p.user_id = l.user_id
			 ORDER BY l.created_at DESC
			 LIMIT 25"
		);

		echo '<h2 style="margin-top:28px">Recent SMS Activity</h2>';
		echo '<p class="description">Latest 25 SMS sends and failures recorded by Johnny5k.</p>';

		if ( empty( $rows ) ) {
			echo '<p>No SMS activity logged yet.</p>';
			return;
		}

		echo '<table class="widefat striped" style="max-width:100%;margin-top:12px">';
		echo '<thead><tr>';
		echo '<th>User</th>';
		echo '<th>Trigger</th>';
		echo '<th>Status</th>';
		echo '<th>Phone</th>';
		echo '<th>Preview</th>';
		echo '<th>Cost</th>';
		echo '<th>Sent At (UTC)</th>';
		echo '<th>Created</th>';
		echo '</tr></thead><tbody>';

		foreach ( $rows as $row ) {
			$name = trim( implode( ' ', array_filter( [ $row->first_name ?? '', $row->last_name ?? '' ] ) ) );
			$user_label = $name ?: ( $row->user_email ?: 'Unknown user' );
			$user_meta = $row->user_email && $name ? '<br><span style="color:#666">' . esc_html( $row->user_email ) . '</span>' : '';
			$status_color = match ( $row->status ) {
				'sent' => '#127c39',
				'failed' => '#b42318',
				default => '#8a6d1f',
			};

			echo '<tr>';
			echo '<td><strong>' . esc_html( $user_label ) . '</strong>' . $user_meta . '</td>';
			echo '<td>' . esc_html( self::format_trigger_label( (string) $row->trigger_type ) ) . '</td>';
			echo '<td><span style="font-weight:700;color:' . esc_attr( $status_color ) . '">' . esc_html( ucfirst( (string) $row->status ) ) . '</span>';
			if ( ! empty( $row->clicksend_message_id ) ) {
				echo '<br><span style="color:#666">ID: ' . esc_html( (string) $row->clicksend_message_id ) . '</span>';
			}
			echo '</td>';
			echo '<td>' . esc_html( (string) $row->phone ) . '</td>';
			echo '<td style="max-width:320px">' . esc_html( (string) $row->message_preview ) . '</td>';
			echo '<td>' . esc_html( null !== $row->cost_usd ? '$' . number_format( (float) $row->cost_usd, 4 ) : '—' ) . '</td>';
			echo '<td>' . esc_html( $row->sent_at ? (string) $row->sent_at : '—' ) . '</td>';
			echo '<td>' . esc_html( (string) $row->created_at ) . '</td>';
			echo '</tr>';
		}

		echo '</tbody></table>';
	}

	private static function format_trigger_label( string $trigger_type ): string {
		return ucwords( str_replace( '_', ' ', $trigger_type ) );
	}

	private static function render_color_schemes_editor(): void {
		$schemes = AdminApiController::get_color_schemes_config();
		$color_keys = [ 'bg', 'bg2', 'bg3', 'border', 'text', 'textMuted', 'accent', 'accent2', 'accent3', 'danger', 'success', 'yellow' ];

		echo '<p class="description" style="margin:0 0 12px">These color schemes feed the in-app profile selector. The first scheme acts as the fallback default.</p>';
		echo '<div id="jf-color-schemes" style="display:grid;gap:16px">';

		foreach ( $schemes as $index => $scheme ) {
			self::render_color_scheme_card( $scheme, $index, $color_keys );
		}

		echo '</div>';
		echo '<p style="margin-top:12px"><button type="button" class="button" id="jf-add-color-scheme">Add Color Scheme</button></p>';
		echo '<script type="text/template" id="jf-color-scheme-template">';
		self::render_color_scheme_card( AdminApiController::default_color_schemes()[0], '__INDEX__', $color_keys );
		echo '</script>';
	}

	private static function render_color_scheme_card( array $scheme, $index, array $color_keys ): void {
		$id = esc_attr( (string) ( $scheme['id'] ?? '' ) );
		$label = esc_attr( (string) ( $scheme['label'] ?? '' ) );
		$description = esc_attr( (string) ( $scheme['description'] ?? '' ) );

		echo '<div class="jf-color-scheme-card" style="padding:16px;border:1px solid #d0d7de;border-radius:12px;background:#fff">';
		echo '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px">';
		echo '<strong>Color Scheme</strong>';
		echo '<button type="button" class="button-link-delete jf-remove-color-scheme">Remove</button>';
		echo '</div>';
		echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">';
		echo '<p style="margin:0"><label><strong>ID</strong><br><input class="regular-text" name="jf_color_schemes[' . esc_attr( (string) $index ) . '][id]" value="' . $id . '"></label></p>';
		echo '<p style="margin:0"><label><strong>Label</strong><br><input class="regular-text" name="jf_color_schemes[' . esc_attr( (string) $index ) . '][label]" value="' . $label . '"></label></p>';
		echo '<p style="margin:0;grid-column:1 / -1"><label><strong>Description</strong><br><input class="regular-text" style="width:100%" name="jf_color_schemes[' . esc_attr( (string) $index ) . '][description]" value="' . $description . '"></label></p>';
		echo '</div>';
		echo '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:14px">';

		foreach ( $color_keys as $color_key ) {
			$value = esc_attr( (string) ( $scheme['colors'][ $color_key ] ?? '#000000' ) );
			echo '<label style="display:grid;gap:6px">';
			echo '<strong>' . esc_html( $color_key ) . '</strong>';
			echo '<span style="display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px;align-items:center">';
			echo '<input type="color" value="' . $value . '" data-color-sync="jf_color_schemes_' . esc_attr( (string) $index ) . '_' . esc_attr( $color_key ) . '">';
			echo '<input class="regular-text" data-color-text="jf_color_schemes_' . esc_attr( (string) $index ) . '_' . esc_attr( $color_key ) . '" name="jf_color_schemes[' . esc_attr( (string) $index ) . '][colors][' . esc_attr( $color_key ) . ']" value="' . $value . '">';
			echo '</span>';
			echo '</label>';
		}

		echo '</div>';
		echo '</div>';
	}

	private static function render_test_script(): void {
		$nonce = wp_create_nonce( 'wp_rest' );
		?>
		<script>
		(async function loadSmsUsers() {
			const select = document.getElementById('jf-sms-user');
			const result = document.getElementById('jf-sms-result');
			if (!select) return;
			select.innerHTML = '<option value="">Loading users…</option>';
			try {
				const res = await fetch('/wp-json/fit/v1/admin/users', {
					credentials: 'same-origin',
					headers: { 'X-WP-Nonce': '<?php echo esc_js( $nonce ); ?>' },
				});
				const users = await res.json();
				if (!res.ok) {
					throw new Error(users?.message || 'Failed to load users.');
				}
				if (!Array.isArray(users)) {
					throw new Error('Unexpected admin users response.');
				}
				if (users.length === 0) {
					select.innerHTML = '<option value="">No users found</option>';
					if (result) {
						result.textContent = 'No WordPress users are available for SMS testing.';
						result.style.color = '#666';
					}
					return;
				}
				select.innerHTML = users.map(user => {
					const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.user_email;
					return `<option value="${user.user_id}">${name} (${user.user_email})</option>`;
				}).join('');
				if (result) {
					result.textContent = '';
				}
			} catch (e) {
				select.innerHTML = '<option value="">Unable to load users</option>';
				if (result) {
					result.textContent = '✗ ' + e.message;
					result.style.color = 'red';
				}
			}
		})();

		document.getElementById('jf-test-openai')?.addEventListener('click', async function() {
			const el = document.getElementById('jf-openai-result');
			el.textContent = 'Testing…';
			try {
				const res = await fetch('/wp-json/fit/v1/admin/persona/test', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': '<?php echo esc_js( $nonce ); ?>' },
					body: JSON.stringify({ message: 'Say "OK" if you can read this.' }),
				});
				const data = await res.json();
				if (data.reply) {
					el.textContent = '✓ OpenAI connected: ' + data.reply.slice(0, 80);
					el.style.color = 'green';
				} else {
					el.textContent = '✗ ' + (data.message || JSON.stringify(data));
					el.style.color = 'red';
				}
			} catch (e) {
				el.textContent = '✗ ' + e.message;
				el.style.color = 'red';
			}
		});

		document.getElementById('jf-test-sms')?.addEventListener('click', async function() {
			const el = document.getElementById('jf-sms-result');
			const userSelect = document.getElementById('jf-sms-user');
			const triggerSelect = document.getElementById('jf-sms-trigger');
			if (!userSelect?.value) {
				el.textContent = 'Select a user first.';
				el.style.color = 'red';
				return;
			}
			el.textContent = 'Sending…';
			try {
				const res = await fetch('/wp-json/fit/v1/admin/sms/test', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': '<?php echo esc_js( $nonce ); ?>' },
					body: JSON.stringify({ user_id: Number(userSelect.value), trigger_type: triggerSelect.value }),
				});
				const data = await res.json();
				if (data?.sent && data?.result) {
					el.textContent = `✓ Sent to ${data.result.phone} | ${data.result.timezone} | local now ${data.result.local_now} | scheduled hour ${data.result.scheduled_hour}:00 | enabled ${data.result.enabled ? 'yes' : 'no'}`;
					el.style.color = 'green';
				} else {
					el.textContent = '✗ ' + (data.message || JSON.stringify(data));
					el.style.color = 'red';
				}
			} catch (e) {
				el.textContent = '✗ ' + e.message;
				el.style.color = 'red';
			}
		});

		(function initColorSchemeEditor() {
			const container = document.getElementById('jf-color-schemes');
			const addButton = document.getElementById('jf-add-color-scheme');
			const template = document.getElementById('jf-color-scheme-template');
			if (!container || !addButton || !template) return;

			function syncIndexes() {
				[...container.querySelectorAll('.jf-color-scheme-card')].forEach((card, index) => {
					card.querySelectorAll('input').forEach(input => {
						input.name = input.name.replace(/jf_color_schemes\[[^\]]+\]/, `jf_color_schemes[${index}]`);
					});
				});
			}

			addButton.addEventListener('click', function() {
				const index = container.querySelectorAll('.jf-color-scheme-card').length;
				const html = template.innerHTML
					.replace(/__INDEX__/g, String(index))
					.replace('value="classic"', `value="scheme-${Date.now()}"`)
					.replace('value="Classic Launch"', `value="New Scheme"`)
					.replace('value="The current Johnny5k palette."', `value="Custom color scheme"`);
				container.insertAdjacentHTML('beforeend', html);
				syncIndexes();
			});

			container.addEventListener('click', function(event) {
				if (!event.target.classList.contains('jf-remove-color-scheme')) return;
				const cards = container.querySelectorAll('.jf-color-scheme-card');
				if (cards.length <= 1) {
					window.alert('At least one color scheme is required.');
					return;
				}
				event.target.closest('.jf-color-scheme-card')?.remove();
				syncIndexes();
			});

			container.addEventListener('input', function(event) {
				const syncKey = event.target.getAttribute('data-color-sync');
				if (syncKey) {
					const textInput = container.querySelector(`[data-color-text="${syncKey}"]`);
					if (textInput) textInput.value = event.target.value;
					return;
				}

				const textKey = event.target.getAttribute('data-color-text');
				if (textKey) {
					const colorInput = container.querySelector(`[data-color-sync="${textKey}"]`);
					if (colorInput && /^#[0-9a-fA-F]{6}$/.test(event.target.value)) {
						colorInput.value = event.target.value;
					}
				}
			});
		})();
		</script>
		<?php
	}
}
