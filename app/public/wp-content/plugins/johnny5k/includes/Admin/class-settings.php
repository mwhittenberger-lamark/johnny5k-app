<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

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
		'jf_clicksend_username'  => [ 'label' => 'ClickSend Username',       'type' => 'text',     'placeholder' => 'you@email.com' ],
		'jf_clicksend_api_key'   => [ 'label' => 'ClickSend API Key',        'type' => 'password', 'placeholder' => ''             ],
		'jf_clicksend_sender_id' => [ 'label' => 'SMS Sender ID (≤11 chars)','type' => 'text',     'placeholder' => 'Johnny5k'    ],
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

		// ── ClickSend section ─────────────────────────────────────────────
		echo '<tr><th colspan="2"><h2 style="margin:0;padding-top:16px">ClickSend SMS</h2></th></tr>';
		self::render_field( 'jf_clicksend_username' );
		self::render_field( 'jf_clicksend_api_key' );
		self::render_field( 'jf_clicksend_sender_id' );
		echo '<tr><td></td><td><p class="description">Used for daily motivation and milestone SMS messages. Credentials found in your ClickSend dashboard under <strong>API Credentials</strong>.</p></td></tr>';

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

		self::render_test_script();

		echo '</div>'; // .wrap
	}

	// ── Private helpers ───────────────────────────────────────────────────

	private static function render_field( string $key ): void {
		$field = self::FIELDS[ $key ];
		$val   = (string) get_option( $key, '' );

		// Mask stored values — show last 4 chars only
		$display = '';
		if ( $val !== '' ) {
			$display = $field['type'] === 'password'
				? str_repeat( '•', max( 0, strlen( $val ) - 4 ) ) . substr( $val, -4 )
				: $val;
		}

		echo '<tr>';
		echo '<th scope="row"><label for="' . esc_attr( $key ) . '">' . esc_html( $field['label'] ) . '</label></th>';
		echo '<td>';
		echo '<input type="' . esc_attr( $field['type'] ) . '" ';
		echo 'id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '" ';
		echo 'value="" ';
		echo 'placeholder="' . esc_attr( $val !== '' ? $display : $field['placeholder'] ) . '" ';
		echo 'class="regular-text">';

		if ( $val !== '' ) {
			echo '<span style="color:#666;margin-left:8px">✓ Set</span>';
		}
		echo '</td>';
		echo '</tr>';
	}

	private static function render_test_script(): void {
		$nonce = wp_create_nonce( 'wp_rest' );
		?>
		<script>
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
		</script>
		<?php
	}
}
