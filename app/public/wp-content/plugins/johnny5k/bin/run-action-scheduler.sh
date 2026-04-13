#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_FILE="${JF_ACTION_SCHEDULER_LOG:-$SITE_ROOT/wp-content/uploads/johnny5k-action-scheduler.log}"
WP_CLI_BIN="${JF_WP_CLI_BIN:-wp}"
WP_CLI_CMD="${JF_WP_CLI_CMD:-}"
BATCHES="${JF_ACTION_SCHEDULER_BATCHES:-1}"
BATCH_SIZE="${JF_ACTION_SCHEDULER_BATCH_SIZE:-25}"

cd "$SITE_ROOT"

if [[ -n "$WP_CLI_CMD" ]]; then
	eval "$WP_CLI_CMD" action-scheduler run --group=johnny5k --batches='${BATCHES}' --batch-size='${BATCH_SIZE}' >> "$LOG_FILE" 2>&1
	exit $?
fi

if ! command -v "$WP_CLI_BIN" >/dev/null 2>&1; then
	echo "WP-CLI binary not found: $WP_CLI_BIN" >> "$LOG_FILE"
	exit 127
fi

"$WP_CLI_BIN" action-scheduler run --group=johnny5k --batches="$BATCHES" --batch-size="$BATCH_SIZE" >> "$LOG_FILE" 2>&1