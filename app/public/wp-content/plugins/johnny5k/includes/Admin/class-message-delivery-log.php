<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Read-only admin ledger for Johnny's scheduled and completed outreach.
 */
class MessageDeliveryLog {
	private const PER_PAGE = 50;

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'johnny5k' ) );
		}

		$filters = self::filters_from_request();
		$page = max( 1, absint( $_GET['paged'] ?? 1 ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$result = self::query_deliveries( $filters, $page );

		echo '<div class="wrap jf-delivery-log">';
		echo '<h1>Johnny Message Delivery Log</h1>';
		echo '<p class="description">A combined audit trail for SMS, browser push, and custom messages Johnny places in chat.</p>';
		self::render_summary( $result['counts'] );
		self::render_filters( $filters );
		self::render_table( $result['rows'] );
		self::render_pagination( $page, (int) $result['total'] );
		self::render_styles();
		echo '</div>';
	}

	private static function filters_from_request(): array {
		$channel = sanitize_key( wp_unslash( $_GET['channel'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$status = sanitize_key( wp_unslash( $_GET['status'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		return [
			'channel' => in_array( $channel, [ 'sms', 'push', 'in_app' ], true ) ? $channel : '',
			'status' => in_array( $status, [ 'queued', 'sent', 'failed', 'suppressed', 'skipped' ], true ) ? $status : '',
			'search' => sanitize_text_field( wp_unslash( $_GET['s'] ?? '' ) ), // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		];
	}

	public static function query_deliveries( array $filters, int $page = 1 ): array {
		global $wpdb;

		$where = [ '1=1' ];
		$args = [];
		if ( '' !== ( $filters['channel'] ?? '' ) ) {
			$where[] = 'l.channel = %s';
			$args[] = $filters['channel'];
		}
		if ( '' !== ( $filters['status'] ?? '' ) ) {
			$where[] = 'l.status = %s';
			$args[] = $filters['status'];
		}
		if ( '' !== ( $filters['search'] ?? '' ) ) {
			$like = '%' . $wpdb->esc_like( $filters['search'] ) . '%';
			$where[] = '(u.display_name LIKE %s OR u.user_email LIKE %s OR l.title LIKE %s OR l.message_preview LIKE %s)';
			array_push( $args, $like, $like, $like, $like );
		}

		$where_sql = implode( ' AND ', $where );
		$count_sql = "SELECT COUNT(*) FROM {$wpdb->prefix}fit_coach_delivery_logs l LEFT JOIN {$wpdb->users} u ON u.ID = l.user_id WHERE {$where_sql}";
		$total = (int) $wpdb->get_var( $args ? $wpdb->prepare( $count_sql, $args ) : $count_sql );
		$offset = ( max( 1, $page ) - 1 ) * self::PER_PAGE;
		$list_sql = "SELECT l.*, u.display_name, u.user_email
			FROM {$wpdb->prefix}fit_coach_delivery_logs l
			LEFT JOIN {$wpdb->users} u ON u.ID = l.user_id
			WHERE {$where_sql}
			ORDER BY COALESCE(l.sent_at, l.created_at) DESC, l.id DESC
			LIMIT %d OFFSET %d";
		$list_args = array_merge( $args, [ self::PER_PAGE, $offset ] );
		$rows = $wpdb->get_results( $wpdb->prepare( $list_sql, $list_args ), ARRAY_A );

		$counts = $wpdb->get_results(
			"SELECT status, COUNT(*) AS total FROM {$wpdb->prefix}fit_coach_delivery_logs GROUP BY status",
			ARRAY_A
		);

		return [
			'rows' => is_array( $rows ) ? $rows : [],
			'total' => $total,
			'counts' => self::normalize_counts( is_array( $counts ) ? $counts : [] ),
		];
	}

	private static function normalize_counts( array $rows ): array {
		$counts = [ 'queued' => 0, 'sent' => 0, 'failed' => 0, 'suppressed' => 0, 'skipped' => 0 ];
		foreach ( $rows as $row ) {
			$status = sanitize_key( (string) ( $row['status'] ?? '' ) );
			if ( array_key_exists( $status, $counts ) ) {
				$counts[ $status ] = (int) ( $row['total'] ?? 0 );
			}
		}
		return $counts;
	}

	private static function render_summary( array $counts ): void {
		echo '<div class="jf-delivery-summary">';
		foreach ( [ 'queued' => 'Scheduled / queued', 'sent' => 'Successful', 'failed' => 'Failed', 'suppressed' => 'Suppressed' ] as $status => $label ) {
			echo '<div><span>' . esc_html( $label ) . '</span><strong>' . esc_html( number_format_i18n( (int) ( $counts[ $status ] ?? 0 ) ) ) . '</strong></div>';
		}
		echo '</div>';
	}

	private static function render_filters( array $filters ): void {
		echo '<form method="get" class="jf-delivery-filters">';
		echo '<input type="hidden" name="page" value="jf-message-delivery-log">';
		echo '<label><span>Channel</span><select name="channel">';
		self::option( '', 'All channels', $filters['channel'] );
		self::option( 'sms', 'SMS', $filters['channel'] );
		self::option( 'push', 'Push notification', $filters['channel'] );
		self::option( 'in_app', 'Johnny in chat', $filters['channel'] );
		echo '</select></label>';
		echo '<label><span>Status</span><select name="status">';
		self::option( '', 'All statuses', $filters['status'] );
		foreach ( [ 'queued', 'sent', 'failed', 'suppressed', 'skipped' ] as $status ) {
			self::option( $status, ucfirst( $status ), $filters['status'] );
		}
		echo '</select></label>';
		echo '<label class="jf-delivery-search"><span>Recipient or message</span><input type="search" name="s" value="' . esc_attr( $filters['search'] ) . '" placeholder="Name, email, title, or message"></label>';
		echo '<button class="button button-primary">Filter log</button>';
		echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=jf-message-delivery-log' ) ) . '">Clear</a>';
		echo '</form>';
	}

	private static function option( string $value, string $label, string $selected_value ): void {
		echo '<option value="' . esc_attr( $value ) . '"' . selected( $selected_value, $value, false ) . '>' . esc_html( $label ) . '</option>';
	}

	private static function render_table( array $rows ): void {
		echo '<div class="jf-delivery-table-wrap"><table class="widefat striped jf-delivery-table">';
		echo '<thead><tr><th>Scheduled / created</th><th>Sent</th><th>Channel</th><th>Recipient</th><th>Message</th><th>Status</th></tr></thead><tbody>';
		if ( [] === $rows ) {
			echo '<tr><td colspan="6" class="jf-delivery-empty">No delivery records match these filters.</td></tr>';
		} else {
			foreach ( $rows as $row ) {
				self::render_row( $row );
			}
		}
		echo '</tbody></table></div>';
	}

	private static function render_row( array $row ): void {
		$payload = json_decode( (string) ( $row['payload_json'] ?? '' ), true );
		$scheduled = self::scheduled_at( is_array( $payload ) ? $payload : [], (string) ( $row['created_at'] ?? '' ) );
		$channel = (string) ( $row['channel'] ?? 'in_app' );
		$status = (string) ( $row['status'] ?? 'queued' );
		$name = trim( (string) ( $row['display_name'] ?? '' ) );
		$email = trim( (string) ( $row['user_email'] ?? '' ) );
		$title = trim( (string) ( $row['title'] ?? '' ) );
		$message = trim( (string) ( $row['message_preview'] ?? '' ) );
		$error = trim( (string) ( $row['error_message'] ?? '' ) );

		echo '<tr>';
		echo '<td><strong>' . esc_html( self::format_datetime( $scheduled ) ) . '</strong><small>Logged ' . esc_html( self::format_datetime( (string) ( $row['created_at'] ?? '' ) ) ) . '</small></td>';
		echo '<td>' . esc_html( self::format_datetime( (string) ( $row['sent_at'] ?? '' ), '—' ) ) . '</td>';
		echo '<td><span class="jf-channel jf-channel--' . esc_attr( $channel ) . '">' . esc_html( self::channel_label( $channel ) ) . '</span></td>';
		echo '<td><strong>' . esc_html( '' !== $name ? $name : 'User #' . (int) ( $row['user_id'] ?? 0 ) ) . '</strong><small>' . esc_html( $email ) . '</small></td>';
		echo '<td><strong>' . esc_html( '' !== $title ? $title : 'Johnny message' ) . '</strong><div class="jf-message-body">' . nl2br( esc_html( $message ) ) . '</div></td>';
		echo '<td><span class="jf-status jf-status--' . esc_attr( $status ) . '">' . esc_html( ucfirst( $status ) ) . '</span>';
		if ( '' !== $error ) {
			echo '<small class="jf-delivery-error">' . esc_html( $error ) . '</small>';
		}
		echo '</td></tr>';
	}

	private static function scheduled_at( array $payload, string $fallback ): string {
		$candidates = [
			$payload['scheduled_at'] ?? '',
			$payload['due_at'] ?? '',
			$payload['follow_up']['due_at'] ?? '',
			$payload['reminder']['scheduled_at'] ?? '',
		];
		foreach ( $candidates as $candidate ) {
			if ( is_string( $candidate ) && '' !== trim( $candidate ) ) {
				return $candidate;
			}
		}
		return $fallback;
	}

	private static function channel_label( string $channel ): string {
		return [ 'sms' => 'SMS', 'push' => 'Push', 'in_app' => 'Johnny in chat' ][ $channel ] ?? ucfirst( $channel );
	}

	private static function format_datetime( string $value, string $empty = 'Not scheduled' ): string {
		if ( '' === trim( $value ) ) {
			return $empty;
		}
		$timestamp = strtotime( $value . ( preg_match( '/(?:Z|[+-]\d{2}:?\d{2})$/', $value ) ? '' : ' UTC' ) );
		return false === $timestamp ? $value : wp_date( 'M j, Y · g:i a T', $timestamp );
	}

	private static function render_pagination( int $page, int $total ): void {
		$pages = (int) ceil( $total / self::PER_PAGE );
		if ( $pages <= 1 ) {
			return;
		}
		$links = paginate_links( [
			'base' => add_query_arg( 'paged', '%#%' ),
			'format' => '',
			'current' => $page,
			'total' => $pages,
			'type' => 'list',
		] );
		if ( $links ) {
			echo '<nav class="jf-delivery-pagination" aria-label="Delivery log pages">' . wp_kses_post( $links ) . '</nav>';
		}
	}

	private static function render_styles(): void {
		echo '<style>
		.jf-delivery-log{max-width:1440px}.jf-delivery-summary{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px;margin:22px 0}.jf-delivery-summary>div{background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:16px}.jf-delivery-summary span,.jf-delivery-table small{display:block;color:#646970;margin-top:4px}.jf-delivery-summary strong{display:block;font-size:26px;margin-top:5px}.jf-delivery-filters{display:flex;align-items:end;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid #dcdcde;padding:14px;margin:0 0 16px}.jf-delivery-filters label span{display:block;font-weight:600;margin-bottom:5px}.jf-delivery-filters select,.jf-delivery-filters input{min-height:36px}.jf-delivery-search{flex:1;min-width:260px}.jf-delivery-search input{width:100%}.jf-delivery-table-wrap{overflow:auto}.jf-delivery-table{min-width:1050px}.jf-delivery-table th{white-space:nowrap}.jf-delivery-table td{vertical-align:top;padding:14px 10px}.jf-delivery-table td:nth-child(1){width:170px}.jf-delivery-table td:nth-child(2){width:150px}.jf-delivery-table td:nth-child(3){width:110px}.jf-delivery-table td:nth-child(4){width:180px}.jf-message-body{max-width:540px;line-height:1.45;margin-top:6px;white-space:normal}.jf-channel,.jf-status{display:inline-block;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700;white-space:nowrap}.jf-channel{background:#e8f0fe;color:#174ea6}.jf-channel--sms{background:#e6f4ea;color:#137333}.jf-channel--in_app{background:#f3e8fd;color:#7627a5}.jf-status{background:#f0f0f1;color:#3c434a}.jf-status--sent{background:#dff6e5;color:#116329}.jf-status--failed{background:#fce8e6;color:#a50e0e}.jf-status--queued{background:#fff4ce;color:#704d00}.jf-status--suppressed,.jf-status--skipped{background:#eceff1;color:#455a64}.jf-delivery-error{color:#b32d2e!important;max-width:210px;line-height:1.35}.jf-delivery-empty{text-align:center;padding:40px!important}.jf-delivery-pagination .page-numbers{display:flex;gap:5px;list-style:none;justify-content:flex-end}.jf-delivery-pagination a,.jf-delivery-pagination span{display:block;padding:7px 10px;background:#fff;border:1px solid #dcdcde;text-decoration:none}.jf-delivery-pagination .current{background:#2271b1;color:#fff}@media(max-width:782px){.jf-delivery-summary{grid-template-columns:repeat(2,1fr)}.jf-delivery-filters>*{width:100%}.jf-delivery-filters select{width:100%}}
		</style>';
	}
}
