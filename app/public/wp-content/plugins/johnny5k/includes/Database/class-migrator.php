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
			// v1.2.2 — replace the original default palette with Modern Skyscraper.
			$schemes = get_option( 'jf_color_schemes', [] );
			$defaults = \Johnny5k\REST\AdminApiController::default_color_schemes();
			if ( is_array( $schemes ) && ! empty( $defaults[0] ) ) {
				$updated = false;
				foreach ( $schemes as $index => $scheme ) {
					if ( 'classic' === sanitize_key( (string) ( $scheme['id'] ?? '' ) ) ) {
						$schemes[ $index ] = $defaults[0];
						$updated = true;
						break;
					}
				}
				if ( ! $updated ) array_unshift( $schemes, $defaults[0] );
				update_option( 'jf_color_schemes', $schemes, false );
			}
			update_option( 'jf_db_version', '1.2.2' );
		}

		if ( version_compare( $current, '1.2.3', '<' ) ) {
			// v1.2.3 — keep cyan structural and reserve coral for warning/error semantics.
			$schemes = get_option( 'jf_color_schemes', [] );
			$defaults = \Johnny5k\REST\AdminApiController::default_color_schemes();
			if ( is_array( $schemes ) && ! empty( $defaults[0] ) ) {
				$updated = false;
				foreach ( $schemes as $index => $scheme ) {
					if ( 'classic' === sanitize_key( (string) ( $scheme['id'] ?? '' ) ) ) {
						$schemes[ $index ] = $defaults[0];
						$updated = true;
						break;
					}
				}
				if ( ! $updated ) {
					array_unshift( $schemes, $defaults[0] );
				}
				update_option( 'jf_color_schemes', $schemes, false );
			}
			update_option( 'jf_db_version', '1.2.3' );
		}

		if ( version_compare( $current, '1.2.4', '<' ) ) {
			// v1.2.4 — repair installs whose lifecycle marked the palette migration complete without running it.
			$schemes = get_option( 'jf_color_schemes', [] );
			$defaults = \Johnny5k\REST\AdminApiController::default_color_schemes();
			if ( is_array( $schemes ) && ! empty( $defaults[0] ) ) {
				$classic_index = null;
				foreach ( $schemes as $index => $scheme ) {
					if ( 'classic' === sanitize_key( (string) ( $scheme['id'] ?? '' ) ) ) {
						$classic_index = $index;
						break;
					}
				}

				if ( null === $classic_index ) {
					array_unshift( $schemes, $defaults[0] );
				} else {
					$schemes[ $classic_index ] = $defaults[0];
				}
				update_option( 'jf_color_schemes', array_values( $schemes ), false );
			}
			update_option( 'jf_db_version', '1.2.4' );
		}
	}
}
