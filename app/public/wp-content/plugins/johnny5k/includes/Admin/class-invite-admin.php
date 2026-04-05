<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Auth\InviteCodes;

/**
 * Admin sub-page: Invite Codes
 *
 * Handles the "Generate" form action and renders the table via PHP — no extra JS needed.
 */
class InviteAdmin {

	public static function render(): void {
		// Handle generate action
		if (
			isset( $_POST['jf_generate_code'] ) &&
			check_admin_referer( 'jf_generate_invite' )
		) {
			$result = InviteCodes::generate( get_current_user_id() );
			if ( is_wp_error( $result ) ) {
				echo '<div class="notice notice-error"><p>' . esc_html( $result->get_error_message() ) . '</p></div>';
			} else {
				echo '<div class="notice notice-success"><p>New code generated: <strong>' . esc_html( $result ) . '</strong></p></div>';
			}
		}

		// Handle delete action
		if (
			isset( $_GET['jf_delete_code'] ) &&
			isset( $_GET['_wpnonce'] ) &&
			wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'jf_delete_code_' . (int) $_GET['jf_delete_code'] )
		) {
			$del = InviteCodes::delete_unused( (int) $_GET['jf_delete_code'] );
			if ( is_wp_error( $del ) ) {
				echo '<div class="notice notice-error"><p>' . esc_html( $del->get_error_message() ) . '</p></div>';
			} else {
				echo '<div class="notice notice-success"><p>Code deleted.</p></div>';
			}
		}

		$codes = InviteCodes::get_all();

		echo '<div class="wrap">';
		echo '<h1>Invite Codes</h1>';

		echo '<form method="post">';
		wp_nonce_field( 'jf_generate_invite' );
		echo '<p><button type="submit" name="jf_generate_code" class="button button-primary">Generate New Code</button></p>';
		echo '</form>';

		echo '<table class="widefat striped" style="margin-top:16px"><thead><tr>
			<th>Code</th><th>Created by</th><th>Created at</th><th>Used by</th><th>Used at</th><th>Action</th>
		</tr></thead><tbody>';

		if ( empty( $codes ) ) {
			echo '<tr><td colspan="6">No invite codes yet.</td></tr>';
		}

		foreach ( $codes as $c ) {
			$delete_url = wp_nonce_url(
				add_query_arg( [ 'jf_delete_code' => $c->id, 'page' => 'jf-invite-codes' ], admin_url( 'admin.php' ) ),
				'jf_delete_code_' . $c->id
			);

			printf(
				'<tr>
					<td><code>%s</code></td>
					<td>%s</td>
					<td>%s</td>
					<td>%s</td>
					<td>%s</td>
					<td>%s</td>
				</tr>',
				esc_html( $c->code ),
				esc_html( $c->created_by_email ?? $c->created_by ),
				esc_html( $c->created_at ),
				esc_html( $c->used_by_email   ?? '—' ),
				esc_html( $c->used_at         ?? '—' ),
				$c->used_by ? '—' : '<a href="' . esc_url( $delete_url ) . '" class="button button-small">Delete</a>'
			);
		}

		echo '</tbody></table></div>';
	}
}
