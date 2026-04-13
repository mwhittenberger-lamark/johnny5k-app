# johnny5k

## Background jobs

Johnny5k now uses Action Scheduler for recurring background jobs instead of traffic-triggered WP-Cron.

- WordPress page loads no longer trigger cron because `DISABLE_WP_CRON` is enabled in `app/public/wp-config.php`.
- The plugin bootstraps Action Scheduler from Composer and schedules recurring jobs in the `johnny5k` queue group.
- Queue health is visible in WordPress admin under `Johnny5k -> Job Monitor` and in the native Action Scheduler UI under `Tools -> Scheduled Actions`.
- A DreamHost-specific deployment checklist is in [docs/DREAMHOST.md](docs/DREAMHOST.md).

### Local or server runner

Run the queue manually from the site root:

```bash
wp action-scheduler run --group=johnny5k --batches=1 --batch-size=25
```

Or install a server cron entry that executes every minute:

```cron
* * * * * /path/to/site/wp-content/plugins/johnny5k/bin/run-action-scheduler.sh
```

The helper script writes to `wp-content/uploads/johnny5k-action-scheduler.log` by default. Override that path with `JF_ACTION_SCHEDULER_LOG` if needed.

### DreamHost notes

On DreamHost shared hosting, cron usually runs with a limited `PATH`, so point `JF_WP_CLI_BIN` at the full WP-CLI path instead of assuming `wp` is globally available.

If your WP-CLI install is only available as a PHAR, set `JF_WP_CLI_CMD` instead, for example `JF_WP_CLI_CMD='php /home/username/bin/wp-cli.phar --path=/home/username/example.com'`.

Example cron entry:

```cron
* * * * * JF_WP_CLI_BIN=/home/username/bin/wp JF_ACTION_SCHEDULER_LOG=/home/username/logs/johnny5k-action-scheduler.log /home/username/example.com/wp-content/plugins/johnny5k/bin/run-action-scheduler.sh
```

The runner defaults to `--batches=1 --batch-size=25`, which is safer for shared hosting time and memory limits than draining the entire queue in one cron invocation.