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

		if ( version_compare( $current, '1.2.0', '<' ) ) {
			// v1.2.0 — standard/circuit workout structure and timed prescription fields.
			// Schema::create_tables() applies the additive columns through dbDelta.
			update_option( 'jf_db_version', '1.2.0' );
		}

		if ( version_compare( $current, '1.2.1', '<' ) ) {
			// v1.2.1 — reusable per-user saved workout library.
			update_option( 'jf_db_version', '1.2.1' );
		}

		if ( version_compare( $current, '1.2.2', '<' ) ) {
			// v1.2.2 — historical palette migration (retired in v1.2.5).
			update_option( 'jf_db_version', '1.2.2' );
		}

		if ( version_compare( $current, '1.2.3', '<' ) ) {
			// v1.2.3 — historical palette migration (retired in v1.2.5).
			update_option( 'jf_db_version', '1.2.3' );
		}

		if ( version_compare( $current, '1.2.4', '<' ) ) {
			// v1.2.4 — historical palette migration (retired in v1.2.5).
			update_option( 'jf_db_version', '1.2.4' );
		}

		if ( version_compare( $current, '1.2.5', '<' ) ) {
			// v1.2.5 — themes are code-owned; remove the retired WordPress palette option.
			delete_option( 'jf_color_schemes' );
			update_option( 'jf_db_version', '1.2.5' );
		}

		if ( version_compare( $current, '1.2.6', '<' ) ) {
			// v1.2.6 — fit_foods.category column and expanded source enum values
			// (usda_ai_text, usda_ai_photo, ai_tile), applied via dbDelta/ensure_food_source_values
			// in Schema::create_tables().
			update_option( 'jf_db_version', '1.2.6' );
		}
	}
}
