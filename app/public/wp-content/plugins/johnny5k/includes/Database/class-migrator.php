<?php
namespace Johnny5k\Database;

defined( 'ABSPATH' ) || exit;

/**
 * Tracks schema version and applies incremental migrations.
 * Each migration is a static method named migration_X_Y_Z().
 */
class Migrator {

	public static function maybe_migrate(): void {
		$current = get_option( 'jf_db_version', '0' );

		if ( version_compare( $current, '1.0.0', '<' ) ) {
			// v1.0.0 — initial schema, handled by Schema::create_tables() on activation.
			update_option( 'jf_db_version', '1.0.0' );
		}

		if ( version_compare( $current, '1.1.0', '<' ) ) {
			// v1.1.0 — summary_text added to fit_ai_threads (handled by dbDelta via create_tables).
			update_option( 'jf_db_version', '1.1.0' );
		}

		if ( version_compare( $current, '1.1.13', '<' ) ) {
			// v1.1.13 — IronQuest v1 backend tables added (handled by dbDelta via create_tables).
			update_option( 'jf_db_version', '1.1.13' );
		}
	}
}
