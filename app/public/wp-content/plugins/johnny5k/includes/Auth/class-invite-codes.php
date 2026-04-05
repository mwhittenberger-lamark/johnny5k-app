<?php
namespace Johnny5k\Auth;

defined( 'ABSPATH' ) || exit;

/**
 * Invite code model.
 *
 * Codes are single-use, no expiry, uppercase alphanumeric with a hyphen
 * in the middle: XXXX-XXXX  (e.g. X7K2-PQ9R)
 */
class InviteCodes {

	// ── Generate ──────────────────────────────────────────────────────────────

	/**
	 * Create a new unused invite code and persist it.
	 *
	 * @param  int $created_by  WP user ID of the admin generating the code.
	 * @return string           The generated code, e.g. "X7K2-PQ9R".
	 */
	public static function generate( int $created_by = 0 ): string {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_invite_codes';

		do {
			$code = self::random_code();
			$exists = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM `$table` WHERE code = %s",
				$code
			) );
		} while ( $exists );

		$wpdb->insert( $table, [
			'code'       => $code,
			'created_by' => $created_by ?: get_current_user_id(),
		] );

		return $code;
	}

	// ── Validate ──────────────────────────────────────────────────────────────

	/**
	 * Check whether a code exists and has not been used.
	 *
	 * @param  string $code  Raw code as submitted (case-insensitive).
	 * @return bool
	 */
	public static function is_valid( string $code ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_invite_codes';

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, used_by FROM `$table` WHERE code = %s",
			strtoupper( trim( $code ) )
		) );

		return $row && $row->used_by === null;
	}

	// ── Consume ───────────────────────────────────────────────────────────────

	/**
	 * Mark a code as consumed by a newly registered user.
	 * Call this only after wp_insert_user() succeeds.
	 *
	 * @param  string $code     The code to consume.
	 * @param  int    $user_id  The WP user ID that registered with this code.
	 * @return bool             True on success.
	 */
	public static function consume( string $code, int $user_id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_invite_codes';

		$updated = $wpdb->update(
			$table,
			[
				'used_by' => $user_id,
				'used_at' => current_time( 'mysql', true ),
			],
			[
				'code'    => strtoupper( trim( $code ) ),
				'used_by' => null,
			]
		);

		return $updated === 1;
	}

	// ── List ──────────────────────────────────────────────────────────────────

	/**
	 * Return all invite codes for the admin UI, newest first.
	 *
	 * @return array<object>
	 */
	public static function get_all(): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_invite_codes';

		return $wpdb->get_results(
			"SELECT ic.*, u.user_email AS used_by_email
			 FROM `$table` ic
			 LEFT JOIN {$wpdb->users} u ON u.ID = ic.used_by
			 ORDER BY ic.created_at DESC"
		) ?: [];
	}

	// ── Delete ────────────────────────────────────────────────────────────────

	/**
	 * Delete an unused code (safety: will not delete consumed codes).
	 *
	 * @param  int $id  PK of the invite code row.
	 * @return bool
	 */
	public static function delete_unused( int $id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_invite_codes';

		return (bool) $wpdb->delete( $table, [ 'id' => $id, 'used_by' => null ] );
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function random_code(): string {
		$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 — avoids visual ambiguity
		$part  = fn() => implode( '', array_map(
			fn() => $chars[ random_int( 0, strlen( $chars ) - 1 ) ],
			range( 1, 4 )
		) );
		return $part() . '-' . $part();
	}
}
