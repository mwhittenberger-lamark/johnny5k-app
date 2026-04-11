<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * API Cost Tracker
 *
 * Logs every OpenAI and ClickSend call so per-user and aggregate costs
 * are visible from the WP Admin cost dashboard.
 */
class CostTracker {

	// Current OpenAI prices (USD) — update when model pricing changes
	private const OPENAI_PRICE_PER_1K = [
		'gpt-4o'              => [ 'in' => 0.005,  'out' => 0.015  ],
		'gpt-4o-mini'         => [ 'in' => 0.00015, 'out' => 0.0006 ],
		'gpt-4-turbo'         => [ 'in' => 0.01,   'out' => 0.03   ],
		'gpt-4.1'             => [ 'in' => 0.002,  'out' => 0.008  ],
		'gpt-4.1-mini'        => [ 'in' => 0.0004, 'out' => 0.0016 ],
		'gpt-4.1-nano'        => [ 'in' => 0.0001, 'out' => 0.0004 ],
	];

	// Current Gemini Developer API prices (USD) for text input/output tokens.
	// gemini-3-pro-image-preview is estimated using Gemini 3 Pro token rates.
	private const GEMINI_PRICE_PER_1M = [
		'gemini-3-pro-image-preview' => [ 'in' => 2.00, 'out' => 12.00 ],
	];

	// ── Log OpenAI call ───────────────────────────────────────────────────────

	/**
	 * Log a completed OpenAI API call.
	 *
	 * @param int    $user_id
	 * @param string $model      e.g. 'gpt-4o-mini'
	 * @param string $endpoint   e.g. '/v1/responses'
	 * @param int    $tokens_in
	 * @param int    $tokens_out
	 * @param array  $metadata   Any extra JSON-serialisable context.
	 */
	public static function log_openai(
		int $user_id,
		string $model,
		string $endpoint,
		int $tokens_in,
		int $tokens_out,
		array $metadata = []
	): void {
		$cost = self::estimate_openai_cost( $model, $tokens_in, $tokens_out );

		self::insert( [
			'user_id'       => $user_id ?: null,
			'service'       => 'openai',
			'endpoint'      => $endpoint,
			'tokens_in'     => $tokens_in,
			'tokens_out'    => $tokens_out,
			'units'         => $tokens_in + $tokens_out,
			'cost_usd'      => $cost,
			'metadata_json' => wp_json_encode( array_merge( $metadata, [ 'model' => $model ] ) ),
		] );
	}

	// ── Log ClickSend SMS ─────────────────────────────────────────────────────

	/**
	 * Log a ClickSend SMS send.
	 *
	 * @param int   $user_id
	 * @param float $cost_usd   Cost returned by ClickSend API.
	 * @param array $metadata
	 */
	public static function log_clicksend(
		int $user_id,
		float $cost_usd,
		array $metadata = []
	): void {
		self::insert( [
			'user_id'       => $user_id ?: null,
			'service'       => 'clicksend',
			'endpoint'      => '/v3/sms/send',
			'tokens_in'     => null,
			'tokens_out'    => null,
			'units'         => 1,
			'cost_usd'      => $cost_usd,
			'metadata_json' => $metadata ? wp_json_encode( $metadata ) : null,
		] );
	}

	/**
	 * Log a completed Gemini API image call.
	 *
	 * @param int    $user_id
	 * @param string $model
	 * @param string $endpoint
	 * @param int    $tokens_in
	 * @param int    $tokens_out
	 * @param array  $metadata
	 */
	public static function log_gemini_image(
		int $user_id,
		string $model,
		string $endpoint,
		int $tokens_in,
		int $tokens_out,
		array $metadata = []
	): void {
		$cost = self::estimate_gemini_cost( $model, $tokens_in, $tokens_out );

		self::insert( [
			'user_id'       => $user_id ?: null,
			'service'       => 'gemini',
			'endpoint'      => $endpoint,
			'tokens_in'     => $tokens_in,
			'tokens_out'    => $tokens_out,
			'units'         => $tokens_in + $tokens_out,
			'cost_usd'      => $cost,
			'metadata_json' => wp_json_encode( array_merge( $metadata, [ 'model' => $model ] ) ),
		] );
	}

	// ── Summary queries ───────────────────────────────────────────────────────

	/**
	 * Total cost per user for the current calendar month.
	 *
	 * @return array<int, object>
	 */
	public static function monthly_by_user(): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_api_cost_logs';
		$users = $wpdb->users;

		return $wpdb->get_results(
			"SELECT l.user_id,
			        u.user_email,
			        l.service,
			        COUNT(*) AS call_count,
			        SUM(l.cost_usd) AS total_cost_usd
			 FROM `$table` l
			 LEFT JOIN `$users` u ON u.ID = l.user_id
			 WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')
			 GROUP BY l.user_id, u.user_email, l.service
			 ORDER BY total_cost_usd DESC"
		) ?: [];
	}

	/**
	 * Grand total cost for the current month.
	 *
	 * @return object
	 */
	public static function monthly_total(): object {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_api_cost_logs';

		return $wpdb->get_row(
			"SELECT SUM(cost_usd) AS total_cost_usd
			 FROM `$table`
			 WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')"
		) ?: (object) [ 'total_cost_usd' => 0 ];
	}

	/**
	 * Daily totals for the last 30 days.
	 *
	 * @return array<int, object>
	 */
	public static function daily_totals_last_30(): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_api_cost_logs';

		return $wpdb->get_results(
			"SELECT DATE(created_at) AS log_date,
			        service,
			        COUNT(*) AS call_count,
			        SUM(cost_usd) AS total_cost_usd
			 FROM `$table`
			 WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
			 GROUP BY DATE(created_at), service
			 ORDER BY log_date ASC, service ASC"
		) ?: [];
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	private static function estimate_openai_cost( string $model, int $in, int $out ): float {
		$prices = self::OPENAI_PRICE_PER_1K[ $model ] ?? [ 'in' => 0.005, 'out' => 0.015 ];
		return round(
			( $in  / 1000 * $prices['in']  ) +
			( $out / 1000 * $prices['out'] ),
			6
		);
	}

	private static function estimate_gemini_cost( string $model, int $in, int $out ): float {
		$prices = self::GEMINI_PRICE_PER_1M[ $model ] ?? self::GEMINI_PRICE_PER_1M['gemini-3-pro-image-preview'];

		return round(
			( $in  / 1000000 * $prices['in'] ) +
			( $out / 1000000 * $prices['out'] ),
			6
		);
	}

	private static function insert( array $data ): void {
		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_api_cost_logs', $data );
	}
}
