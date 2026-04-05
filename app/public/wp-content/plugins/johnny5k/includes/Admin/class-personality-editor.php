<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Admin sub-page: Johnny 5000 Personality Editor
 *
 * Editable fields for the persona. On save the compiled system prompt is
 * regenerated and stored in `jf_johnny_system_prompt` (wp_options).
 * A live-test chat box sends messages through the admin REST endpoint.
 */
class PersonalityEditor {

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		// Handle save
		if (
			$_SERVER['REQUEST_METHOD'] === 'POST' &&
			isset( $_POST['jf_save_persona'] ) &&
			check_admin_referer( 'jf_persona_save' )
		) {
			$fields = [
				'name'    => 'sanitize_text_field',
				'tagline' => 'sanitize_text_field',
				'tone'    => 'sanitize_textarea_field',
				'rules'   => 'sanitize_textarea_field',
				'extra'   => 'sanitize_textarea_field',
			];

			$persona = [];
			foreach ( $fields as $key => $fn ) {
				$persona[ $key ] = call_user_func( $fn, wp_unslash( $_POST[ 'jf_persona_' . $key ] ?? '' ) );
			}

			update_option( 'jf_johnny_persona', $persona );

			$compiled = self::compile( $persona );
			update_option( 'jf_johnny_system_prompt', $compiled );

			echo '<div class="notice notice-success"><p>Persona saved successfully.</p></div>';
		}

		$persona = (array) get_option( 'jf_johnny_persona', [] );
		$prompt  = (string) get_option( 'jf_johnny_system_prompt', '' );

		$defaults = [
			'name'    => 'Johnny 5000',
			'tagline' => 'Your AI fitness coach and big brother.',
			'tone'    => 'warm, encouraging, confident, occasionally funny',
			'rules'   => '',
			'extra'   => '',
		];
		$persona = array_merge( $defaults, $persona );

		echo '<div class="wrap" id="jf-personality-editor">';
		echo '<h1>Johnny 5000 Personality Editor</h1>';
		echo '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">';

		// ── Left: Persona fields ──────────────────────────────────────────────
		echo '<div>';
		echo '<form method="post">';
		wp_nonce_field( 'jf_persona_save' );
		self::field( 'Name',             'name',    $persona['name'],    'text' );
		self::field( 'Tagline',          'tagline', $persona['tagline'], 'text' );
		self::field( 'Tone & style',     'tone',    $persona['tone'],    'textarea' );
		self::field( 'Extra rules',      'rules',   $persona['rules'],   'textarea' );
		self::field( 'Additional notes', 'extra',   $persona['extra'],   'textarea' );

		echo '<p><button type="submit" name="jf_save_persona" class="button button-primary">Save Persona</button></p>';
		echo '</form>';

		// Compiled prompt preview
		if ( $prompt ) {
			echo '<h3>Compiled System Prompt</h3>';
			echo '<pre style="background:#f6f7f7;padding:12px;border:1px solid #ddd;white-space:pre-wrap;word-break:break-word">' . esc_html( $prompt ) . '</pre>';
		}
		echo '</div>';

		// ── Right: Live test chat box ─────────────────────────────────────────
		echo '<div>';
		echo '<h2>Live Test Chat</h2>';
		echo '<div id="jf-chat-log" style="border:1px solid #ddd;border-radius:6px;padding:12px;height:320px;overflow-y:auto;background:#fafafa;font-size:13px;"></div>';
		echo '<div style="display:flex;gap:8px;margin-top:8px">';
		echo '<input type="text" id="jf-chat-input" style="flex:1;padding:6px" placeholder="Say something to Johnny…" />';
		echo '<button id="jf-chat-send" class="button button-primary">Send</button>';
		echo '</div>';
		echo '</div>'; // right

		echo '</div>'; // grid
		echo '</div>'; // wrap

		// Inline script for the chat box (admin-only, no nonce needed for nonce is embedded)
		$nonce    = wp_create_nonce( 'wp_rest' );
		$endpoint = esc_url( rest_url( 'fit/v1/admin/persona/test' ) );

		?>
		<script>
		(function(){
			const log   = document.getElementById('jf-chat-log');
			const input = document.getElementById('jf-chat-input');
			const btn   = document.getElementById('jf-chat-send');
			const nonce = <?php echo wp_json_encode( $nonce ); ?>;
			const url   = <?php echo wp_json_encode( $endpoint ); ?>;

			function addMsg(who, text, html) {
				const bubble = document.createElement('div');
				bubble.style.cssText = 'margin:4px 0;padding:8px 12px;border-radius:6px;max-width:85%;line-height:1.5;' +
					(who === 'you' ? 'background:#0073aa;color:#fff;margin-left:auto;text-align:right' :
					                 'background:#e0e0e0;color:#333');

				if (html && who !== 'you') {
					bubble.innerHTML = html;
					bubble.querySelectorAll('p, ul, ol').forEach(el => {
						el.style.margin = '0 0 8px';
					});
					bubble.querySelectorAll('li').forEach(el => {
						el.style.marginBottom = '4px';
					});
					const last = bubble.lastElementChild;
					if (last) {
						last.style.marginBottom = '0';
					}
				} else {
					bubble.textContent = text;
				}

				log.appendChild(bubble);
				log.scrollTop = log.scrollHeight;
			}

			btn.addEventListener('click', async function() {
				const msg = input.value.trim();
				if (!msg) return;
				input.value = '';
				addMsg('you', msg);
				btn.disabled = true;

				try {
					const res = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': nonce
						},
						body: JSON.stringify({ message: msg })
					});
					const data = await res.json();
					addMsg('johnny', data.reply || data.message || 'Error', data.reply_html || '');
				} catch(e) {
					addMsg('johnny', 'Request failed: ' + e.message);
				} finally {
					btn.disabled = false;
					input.focus();
				}
			});

			input.addEventListener('keydown', function(e) {
				if (e.key === 'Enter') btn.click();
			});
		})();
		</script>
		<?php
	}

	private static function field( string $label, string $key, string $value, string $type ): void {
		echo '<div style="margin-bottom:16px">';
		echo '<label style="display:block;font-weight:600;margin-bottom:4px" for="jf_persona_' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label>';

		if ( $type === 'textarea' ) {
			printf(
				'<textarea name="jf_persona_%s" id="jf_persona_%s" rows="4" style="width:100%%">%s</textarea>',
				esc_attr( $key ),
				esc_attr( $key ),
				esc_textarea( $value )
			);
		} else {
			printf(
				'<input type="text" name="jf_persona_%s" id="jf_persona_%s" value="%s" style="width:100%%" />',
				esc_attr( $key ),
				esc_attr( $key ),
				esc_attr( $value )
			);
		}

		echo '</div>';
	}

	private static function compile( array $p ): string {
		$name    = $p['name']    ?? 'Johnny 5000';
		$tagline = $p['tagline'] ?? '';
		$tone    = $p['tone']    ?? '';
		$rules   = $p['rules']   ?? '';
		$extra   = $p['extra']   ?? '';

		$out  = "You are {$name}. {$tagline}\n\n";
		$out .= "Personality & tone: {$tone}\n\n";
		$out .= "Core rules:\n";
		$out .= "- Always be honest that you are an AI.\n";
		$out .= "- Never shame or belittle the user.\n";
		$out .= "- Keep responses concise but warm.\n";
		$out .= "- Focus on the user's goals and progress.\n";
		if ( $rules ) $out .= "- {$rules}\n";
		if ( $extra )  $out .= "\nAdditional instructions:\n{$extra}\n";

		return $out;
	}
}
