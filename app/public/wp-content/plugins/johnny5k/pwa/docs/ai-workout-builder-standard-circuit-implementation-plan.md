# AI Workout Builder: Standard and Circuit Workouts

## Objective

Let a user describe a workout to Johnny in ordinary language, review Johnny's interpretation, edit it, and then save or start it as either:

- a **standard workout**, where all planned sets for one exercise are completed before advancing; or
- a **circuit workout**, where one target for each exercise is completed in order and the sequence is repeated for a configured number of rounds.

Example input:

> A circuit of 10 pushups then 20 incline dumbell press, then 10 reps of bent over row and 20 reps per arm of single arm row then 1 minute bodyweight squat and 1 minute plan hold. Repeat 3 times.

Expected interpretation:

1. Push-up — 10 reps
2. Incline dumbbell press — 20 reps
3. Bent-over row — 10 reps
4. Single-arm row — 20 reps per arm
5. Bodyweight squat — 60 seconds
6. Plank hold — 60 seconds
7. Repeat for 3 rounds

Johnny should visibly disclose corrections such as `dumbell` → `dumbbell` and `plan hold` → `plank hold` before the user starts the workout.

## Product principles

1. **Conversation creates a draft, never a hidden completed action.** Johnny may queue a workout draft, but the user reviews and explicitly chooses **Start workout** or **Save for later**.
2. **AI interprets; application code validates.** Exercise access, numeric limits, equipment, health flags, and workout structure must be validated deterministically on the server.
3. **Ask only consequential questions.** Infer harmless details and show them in the preview. Ask when an ambiguity would materially change the workout, such as missing circuit rounds or whether a unilateral rep target is total or per side.
4. **Preserve the user's intent.** Keep the requested order, targets, units, per-side instructions, and rest instructions. Do not silently replace a requested exercise.
5. **Existing workouts remain standard workouts.** All legacy drafts and sessions must behave exactly as they do now without a data backfill.
6. **One workout system.** Extend the current custom-draft, preview, session, logging, history, and live-workout paths instead of creating circuit-only endpoints or screens.

## Current system findings

The existing flow is a strong starting point:

- Johnny already exposes a `create_custom_workout` AI tool.
- The tool currently accepts `name`, `day_type`, `time_tier`, `exercise_names`, and `coach_note`.
- `AiToolHandlerService` converts those names into a custom draft through `POST /workout/custom-draft`.
- Custom drafts are stored in user metadata and appear in the existing Workout preview.
- The preview can be reordered, adjusted, and started through the existing workout endpoints.
- Active sessions and Live Workout Mode currently assume exercise-by-exercise progression using `planned_sets`, `planned_rep_min`, and `planned_rep_max`.

The missing capabilities are structured AI prescriptions, timed targets, per-side targets, session structure metadata, circuit-aware progression, and a review UI that clearly communicates Johnny's interpretation.

## Canonical data model

Use `standard` and `circuit` as the only initial workout structures. Keep muscle-group/day type separate from structure; for example, a workout may be both `full_body` and `circuit`.

### Draft and API shape

```json
{
  "name": "Full Body Circuit",
  "day_type": "full_body",
  "workout_structure": "circuit",
  "rounds": 3,
  "rest_between_exercises_seconds": 15,
  "rest_between_rounds_seconds": 90,
  "coach_note": "Three steady rounds. Keep two reps in reserve.",
  "interpretation_notes": [
    "Interpreted ‘plan hold’ as ‘plank hold’."
  ],
  "exercises": [
    {
      "exercise_name": "Push-up",
      "target_type": "reps",
      "target_reps": 10,
      "reps_per_side": false,
      "notes": ""
    },
    {
      "exercise_name": "Single-arm dumbbell row",
      "target_type": "reps",
      "target_reps": 20,
      "reps_per_side": true,
      "notes": "20 reps on each arm"
    },
    {
      "exercise_name": "Bodyweight squat",
      "target_type": "duration",
      "target_duration_seconds": 60,
      "reps_per_side": false,
      "notes": ""
    }
  ]
}
```

### Standard workout interpretation

For standard workouts, each exercise continues to use `sets`, with either a rep range or a duration target:

```json
{
  "workout_structure": "standard",
  "exercises": [
    {
      "exercise_name": "Bench press",
      "sets": 3,
      "target_type": "reps",
      "target_rep_min": 8,
      "target_rep_max": 10
    }
  ]
}
```

### Validation rules

- `workout_structure`: `standard` or `circuit`; default `standard`.
- `rounds`: required for circuits; integer `1–20`.
- `rest_between_exercises_seconds`: integer `0–900`.
- `rest_between_rounds_seconds`: integer `0–1800`.
- `exercises`: `1–30` resolved, accessible exercises.
- `target_type`: `reps` or `duration` for the first release.
- Rep targets: integer `1–500`; normalize a single value into equal min/max values where needed.
- Duration targets: integer `5–3600` seconds.
- `reps_per_side`: boolean and valid only for a rep target.
- Standard exercise sets: integer `1–20`.
- Circuit exercises use the session's round count for planned completions; do not accept conflicting per-exercise round counts in the first release.
- Reject unresolved exercise names with a useful response that identifies each unresolved item. Never silently choose a low-confidence match.
- Return canonical matched exercise IDs/names plus interpretation notes to the client.

## Persistence and migration

Add fields through `Database/class-schema.php`, the migrator, and `install.sql`. Follow the project's `fit_` table-prefix convention at runtime.

### `fit_workout_sessions`

- `workout_structure enum('standard','circuit') NOT NULL DEFAULT 'standard'`
- `rounds_total smallint unsigned NOT NULL DEFAULT 1`
- `rest_between_exercises_seconds int unsigned DEFAULT NULL`
- `rest_between_rounds_seconds int unsigned DEFAULT NULL`
- `custom_title varchar(150) DEFAULT NULL` if the current custom title is not otherwise persisted on the session

### `fit_workout_session_exercises`

- `target_type enum('reps','duration') NOT NULL DEFAULT 'reps'`
- `planned_duration_seconds int unsigned DEFAULT NULL`
- `reps_per_side tinyint(1) NOT NULL DEFAULT 0`
- Continue using `planned_rep_min`, `planned_rep_max`, `planned_sets`, and `sort_order`.
- For a circuit, materialize `planned_sets = rounds_total` for compatibility with existing completion summaries while treating each set number as its circuit round.

### `fit_workout_sets`

- `duration_seconds int unsigned DEFAULT NULL`
- `circuit_round smallint unsigned DEFAULT NULL`
- Standard rep-based logs remain unchanged.
- Circuit logs set `circuit_round` explicitly and use the same value for `set_number`.
- Timed targets record actual elapsed time in `duration_seconds`; `reps` may remain zero.

### Backward compatibility

- Defaults make every existing session a one-round standard workout.
- API normalizers must synthesize defaults when fields are absent, including older custom drafts stored in user metadata.
- Existing clients may continue sending `exercise_names`; the server converts them to default rep-based exercise prescriptions.
- History, analytics, calorie estimates, and IronQuest rewards must continue counting completed sessions and logged work without requiring circuit fields.

## Backend implementation

### 1. Extend custom workout drafts

Update `WorkoutController` custom-draft normalization to:

- normalize structure, rounds, rest, interpretation notes, and structured exercises;
- preserve explicit order;
- resolve each exercise against the user's accessible exercise library;
- support aliases and spelling-tolerant candidate lookup;
- return exact matches and a list of normalized interpretations;
- persist all normalized fields in the existing user-meta draft;
- include the fields in preview and start payloads;
- write structure fields into the new session columns when starting.

Do not reuse the current duplicate-exercise suppression blindly. A workout may intentionally contain the same library exercise more than once in different positions in a future multi-block design. For this release, either reject duplicates explicitly with a clear error or preserve them with distinct `plan_exercise_id` values; preserving them is preferred.

### 2. Upgrade Johnny's AI tool contract

Replace the name-only primary contract for `create_custom_workout` with structured exercises while temporarily retaining `exercise_names` for compatibility.

The tool schema should include:

- `workout_structure`
- `rounds`
- both rest values
- structured `exercises`
- per-exercise target type, reps/range, duration, sets, per-side flag, and notes
- `interpretation_notes`

Update the tool description with explicit rules:

- recognize “circuit,” “rounds,” and “repeat N times” as circuit indicators;
- preserve exercise order;
- convert minutes to seconds;
- recognize “each arm,” “per arm,” “each side,” and “per side”;
- use `duration` for holds or time-boxed movements;
- do not invent weight when the user did not provide it;
- make conservative spelling corrections and disclose them;
- default to `standard` only when circuit intent is absent.

### 3. Keep deterministic hydration as a fallback

`hydrate_custom_workout_arguments_from_message` currently repairs incomplete tool arguments. Extend it only as a fallback for common, high-confidence patterns:

- `repeat 3 times`, `3 rounds`, `three rounds`
- `1 minute`, `45 seconds`
- `20 per arm`, `10 each side`
- ordered separators such as `then`, commas, and numbered lists

The model's structured tool call should be the primary parser. Deterministic hydration protects against omitted fields and should never overwrite a valid explicit tool value without recording an interpretation note.

### 4. Add server-side safety checks

Before saving a draft:

- verify exercise access and active status;
- compare equipment with user preferences and report mismatches;
- inspect active injury/pain/mobility flags and surface warnings;
- cap excessive sets, rounds, reps, duration, and total estimated workout volume;
- detect a likely unilateral movement with an ambiguous rep target and return a clarification requirement when confidence is low;
- distinguish blocking validation errors from non-blocking warnings.

The API response should contain `warnings`, `interpretation_notes`, and `needs_clarification`. A draft with a blocking ambiguity must not be startable until resolved.

### 5. Return complete session metadata everywhere

Update current-session, preview, start, workout-detail, history-detail, restart, swap, quick-add, restore, and offline queue payloads so structure and target fields survive every mutation. Exercise swaps must retain the original prescription unless the user explicitly changes it.

## Frontend implementation

### 1. Add the “Build with Johnny” entry point

Place a prominent action on the Workout launchpad:

> **Build with Johnny**<br>
> Describe the workout you want in your own words.

Open the existing Johnny drawer with workout context and starter suggestions:

- “Build a 45-minute push workout.”
- “Make a three-round bodyweight circuit.”
- “Use this exact workout…”

The global Johnny drawer remains available; both entry points use the same AI tool.

### 2. Build an explicit review state

After Johnny creates a draft, navigate to the Workout screen and display:

- workout title;
- a Standard/Circuit segmented control;
- rounds and rest controls for circuits;
- ordered exercise cards;
- reps, rep range, duration, sets, and per-side labels;
- interpretation notes and safety/equipment warnings;
- unresolved exercises or clarification prompts;
- actions for **Edit**, **Ask Johnny to change it**, **Save for later**, and **Start workout**.

The user must be able to:

- reorder, remove, add, and swap exercises;
- change structure;
- edit rounds and rest;
- change an exercise between reps and duration;
- edit sets, targets, and per-side behavior;
- return to Johnny with a request such as “make it two rounds” or “replace rows with band rows.”

### 3. Standard active-workout behavior

Keep the existing progression model:

1. Show the active exercise.
2. Log its planned sets.
3. Advance to the next exercise.
4. Use the configured between-set and between-exercise rest guidance.

Timed standard exercises use the same timer component introduced for circuits.

### 4. Circuit active-workout behavior

Introduce a small pure progression module rather than scattering round logic across components. Its state is derived from persisted logs:

```text
active round + active exercise + completed logs
                         |
                         v
              next exercise in round
                         |
              final exercise completed?
                  /                 \
                no                  yes
                |                    |
       exercise rest          final round?
                               /       \
                             no         yes
                             |           |
                       round rest     completion
```

The interface should show:

- `Round 2 of 3` prominently;
- exercise position, such as `4 of 6`;
- the current target, including `20 each arm` or `1:00`;
- the next exercise;
- exercise-rest and round-rest timers;
- completed/current/upcoming states for each circuit item;
- controls to pause, skip, edit the logged result, or end early.

Circuit completion is derived from one completed log per exercise per round. Reloading, going offline, or reopening Live Workout Mode must reconstruct the same position from saved and queued logs.

### 5. Logging behavior

- Rep target: prefill the prescribed reps; the user records actual reps and optional weight/RIR/RPE.
- Per-side target: clearly label the prescribed value as per side. In the first release, log one result representing equal work on both sides and provide a note/edit path for unequal sides.
- Duration target: offer a countdown/count-up timer and record actual seconds.
- Never auto-complete a set merely because a timer expired; require an intentional completion action.
- Offline queued writes include `circuit_round`, `target_type`, and duration data and remain idempotent.

### 6. History and summaries

History should identify the workout structure and summarize circuits as, for example:

> Full Body Circuit · 3 rounds · 18 stations completed · 24 min

Exercise detail should group circuit logs by round. AI summaries and live coaching prompts should receive round, position, target type, and per-side context so Johnny does not say “one more set” when the correct instruction is “next station” or “next round.”

## Delivery phases

### Phase 1 — Domain model and backward compatibility

- Add schema fields and migration checks.
- Add PHP normalization helpers for workout structure and targets.
- Extend draft, preview, start, current-session, and detail responses.
- Add unit/integration tests proving old sessions default to standard.

**Exit criterion:** both structures can round-trip through API/storage without changing the current UI.

### Phase 2 — Manual review and session execution

- Add the Standard/Circuit review controls.
- Add timed and per-side prescriptions.
- Implement pure standard/circuit progression helpers.
- Update regular and Live Workout Mode interfaces.
- Make logging, reload restoration, rest timers, and offline queue circuit-aware.

**Exit criterion:** a circuit can be manually constructed, started, completed across three rounds, reloaded mid-session, and displayed correctly in history.

### Phase 3 — Johnny structured workout creation

- Upgrade the AI tool schema and handler.
- Add fallback message hydration.
- Add interpretation notes, warnings, and clarification responses.
- Add “Build with Johnny” and assistant action cards that open the draft review.

**Exit criterion:** the example prompt produces the expected six-station, three-round review draft without manual restructuring.

### Phase 4 — Hardening and rollout

- Add analytics and diagnostics.
- Exercise spelling, alias, equipment, health-warning, and extreme-value cases.
- Test offline and interrupted sessions.
- Roll out behind an `ai_workout_builder_enabled` feature flag.
- Enable for internal/admin users, then a small cohort, then all users.

**Exit criterion:** no regression in standard workout completion, circuit recovery works after reload/offline use, and draft correction/start rates meet initial targets.

## Test plan

### Backend

- Legacy draft/session normalizes to `standard` and preserves existing behavior.
- Structured standard and circuit payloads round-trip through draft, preview, and start.
- Rounds/rest/rep/duration bounds are enforced.
- Timed and per-side targets persist.
- Exercise spelling aliases return canonical matches and interpretation notes.
- Low-confidence and missing exercises return actionable errors.
- Equipment and health warnings do not disappear during preview/start.
- Swaps preserve prescriptions.
- Restart/discard/restore operations preserve circuit metadata.
- Completion and history aggregate both structures correctly.

### Frontend

- Review renders standard and circuit drafts.
- Switching structure exposes/hides the correct controls without losing exercise targets.
- Reordering and editing preserve stable exercise identifiers.
- Circuit progression advances exercise → round → completion correctly.
- Rest timers distinguish station rest from round rest.
- Timed exercises record actual duration.
- Per-side labels are announced accessibly.
- Reload reconstructs the current circuit position.
- Offline queued logs do not duplicate a circuit station.
- Johnny action results navigate to the correct draft.

### Required acceptance scenarios

1. The supplied natural-language example produces six exercises in the stated order, three rounds, two timed targets, and one per-arm target.
2. “Bench press 3x8, row 3x10, squat 3x8” produces a standard workout.
3. “Do those exercises for four rounds, 30 seconds between moves and two minutes between rounds” produces a circuit with explicit rest values.
4. A user can correct Johnny's inferred “plank hold” before starting.
5. A circuit can be completed with the network disconnected and synchronizes without duplicate rounds.
6. Every existing workout test continues to pass with no structure fields supplied.

## Observability

Track privacy-conscious product events without storing raw prompt text in analytics:

- builder opened;
- draft creation succeeded/failed;
- inferred structure;
- clarification required;
- unresolved exercise count;
- draft edited after AI generation;
- draft abandoned, saved, or started;
- circuit started/completed/ended early;
- reload/offline recovery;
- validation and sync error codes.

Initial success measures:

- percentage of AI drafts that reach preview;
- percentage started or saved;
- percentage requiring manual exercise correction;
- standard and circuit completion rates;
- circuit sync/recovery failure rate;
- no decline in existing standard-workout completion.

## Decisions for the first release

- Support one ordered circuit block per workout; warm-up, supersets, and multiple blocks come later.
- Support rep and duration targets; distance and calorie targets come later.
- Log unilateral work as one per-side result rather than separate left/right sets.
- Use the existing exercise library and personal exercises; Johnny does not automatically create missing exercises while building a workout.
- Apply user-profile rest defaults only when the prompt omits rest, and clearly label those values as defaults in the review.
- Keep circuit editing available before start; during an active circuit, allow safe target edits and skips but do not allow structure conversion.

## Definition of done

- Users can create, review, edit, save, start, complete, and revisit both standard and circuit workouts.
- Johnny reliably converts the supplied example into the expected structured circuit.
- Circuit rounds, timed exercises, per-side targets, and rest periods survive API calls, reloads, offline queues, and history views.
- Existing saved workouts require no migration by users and continue as standard workouts.
- Server validation—not AI output—controls accepted exercises and numeric/safety constraints.
- Automated backend and frontend coverage includes all required acceptance scenarios.
