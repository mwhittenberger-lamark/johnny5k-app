# IronQuest V1 Implementation Checklist

## Purpose

This document converts the premium architecture into an implementation checklist for the first real shipping version of IronQuest inside Johnny5k.

This is a v1 execution artifact, not a lore or expansion artifact.

## V1 Scope Lock

These constraints are fixed for v1 unless this document is explicitly revised:

- 4 starter locations only
- no subclass system
- no inventory screen
- no gear optimization system
- no spell loadout system
- no resource gating on standard workouts
- no boss gating of the main training loop
- no second standalone app shell

Starter locations for v1, using the canonical location docs and slugs:

- The Training Grounds: `the_training_grounds`
- Grim Hollow Village: `grim_hollow_village`
- The Emberforge: `the_emberforge`
- Whispering Wilds: `whispering_wilds`

## Product Rule

If one rule overrides everything else, it is this:

> IronQuest may enhance motivation, identity, progression, and workout payoff, but it must never prevent a user from training.

## V1 Definition Of Done

V1 is done when all of the following are true:

- a premium user can enable IronQuest and create an identity
- a premium user can select a class and motivation
- a premium user can generate a starter portrait
- the dashboard shows IronQuest mission and progression context
- a workout can attach to an IronQuest mission without slowing normal workout logging
- rest-time narration can appear during workouts and fail safely
- workouts award IronQuest XP and gold
- meals, sleep, cardio, and steps can contribute small supporting progress
- rewards and gallery surfaces show meaningful IronQuest payoff
- analytics can prove whether IronQuest improves behavior and retention

## Implementation Order

Build in this order:

1. Scope and data contract
2. Backend schema and services
3. Seed content
4. Premium onboarding and identity
5. Dashboard and rewards integration
6. Workout mission overlay
7. Daily quest and travel progress
8. Analytics, hardening, and launch checks

## 1. Scope And Data Contract

- [ ] Freeze v1 features against this checklist and stop adding new systems from the broader doc set.
- [ ] Confirm the four starter locations are the only launch content set.
- [ ] Confirm class selection is flavor plus light reward bias only.
- [ ] Confirm HP is readiness flavor plus reward modifier only, not a hard gate.
- [ ] Confirm mission replay is always available.
- [ ] Confirm daily activities can add progress but cannot replace workouts as the main XP source.
- [ ] Write a short acceptance note for each v1 feature so implementation can be tested against behavior instead of interpretation.

Acceptance criteria:

- Every v1 feature maps to a concrete screen, service, endpoint, or seed-data entry.
- No v1 task depends on subclass, inventory, spells, or deep boss systems.

## 2. Backend Schema And Services

### Schema

- [ ] Add `fit_ironquest_profiles` table for IronQuest identity and progression.
- [ ] Add `fit_ironquest_mission_runs` table for mission sessions tied to workouts or cardio.
- [ ] Add `fit_ironquest_unlocks` table for portraits, relic-style milestones, titles, and cleared-location records.
- [ ] Add `fit_ironquest_daily_state` table for daily quest and travel modifiers.
- [ ] Add `fit_ironquest_activity_ledger` table for idempotent reward attribution.

Recommended minimum fields:

- `fit_ironquest_profiles`: `user_id`, `enabled`, `class_slug`, `motivation_slug`, `level`, `xp`, `gold`, `hp_current`, `hp_max`, `current_location_slug`, `active_mission_slug`, `starter_portrait_attachment_id`, `created_at`, `updated_at`
- `fit_ironquest_mission_runs`: `id`, `user_id`, `mission_slug`, `location_slug`, `run_type`, `source_session_id`, `status`, `encounter_phase`, `result_band`, `xp_awarded`, `gold_awarded`, `started_at`, `completed_at`
- `fit_ironquest_unlocks`: `id`, `user_id`, `unlock_type`, `unlock_key`, `source_run_id`, `meta_json`, `created_at`
- `fit_ironquest_daily_state`: `user_id`, `state_date`, `meal_quest_complete`, `sleep_quest_complete`, `cardio_quest_complete`, `steps_quest_complete`, `workout_quest_complete`, `travel_points_earned`, `bonus_state_json`, `updated_at`
- `fit_ironquest_activity_ledger`: `id`, `user_id`, `source_type`, `source_key`, `award_type`, `payload_json`, `created_at`

### Services

- [ ] Create `includes/Services/class-ironquest-profile-service.php`.
- [ ] Create `includes/Services/class-ironquest-mission-service.php`.
- [ ] Create `includes/Services/class-ironquest-progression-service.php`.
- [ ] Create `includes/Services/class-ironquest-daily-state-service.php`.
- [ ] Create `includes/Services/class-ironquest-narrative-service.php`.
- [ ] Create `includes/Services/class-ironquest-reward-service.php`.
- [ ] Create `includes/Services/class-ironquest-entitlement-service.php`.

### Required backend decisions

- [ ] Choose one entitlement source of truth for premium access.
- [ ] Define the exact XP and gold award rules for:
  - full workout
  - short workout
  - cardio session
  - steps target hit
  - meal log
  - sleep log
- [ ] Define result bands for workouts and mission resolution.
- [ ] Define how readiness changes reward quality without blocking training.
- [ ] Define fallback mission selection when no special mission is active.

Acceptance criteria:

- Duplicate source events cannot award IronQuest progression twice.
- A user can always receive a replayable mission.
- No backend rule can mark a user as unable to start a workout.

## 3. REST Endpoints

- [ ] Add `includes/REST/class-ironquest-controller.php`.
- [ ] Register the controller in the main REST router.

Recommended v1 endpoints:

- [ ] `GET /fit/v1/ironquest/profile`
- [ ] `POST /fit/v1/ironquest/enable`
- [ ] `POST /fit/v1/ironquest/disable`
- [ ] `POST /fit/v1/ironquest/identity`
- [ ] `POST /fit/v1/ironquest/missions/start`
- [ ] `POST /fit/v1/ironquest/missions/resolve`
- [ ] `GET /fit/v1/ironquest/missions/active`
- [ ] `POST /fit/v1/ironquest/daily/refresh`
- [ ] `POST /fit/v1/ironquest/daily/progress`
- [ ] `POST /fit/v1/ironquest/route/fast-travel`

Optional internal-only endpoints if needed:

- [ ] `POST /fit/v1/ironquest/narrative/rest-beat`
- [ ] `POST /fit/v1/ironquest/portrait/generate`

Acceptance criteria:

- The PWA can load IronQuest state without scraping unrelated payloads.
- The workout flow can start and resolve missions with a bounded payload.
- Endpoint responses stay small enough for live workout use.

## 4. Seed Content

- [ ] Stop treating markdown as runtime data.
- [ ] Create structured seed registries for classes, motivations, locations, missions, daily quests, and portrait triggers.
- [ ] Add a separate launch-graph registry when v1 runtime progression must differ from canonical source-doc connections.
- [ ] Seed exactly four v1 locations from the existing location list, using the canonical names and slugs.
- [ ] Seed at least one replayable mission per location.
- [ ] Seed at least one starter mission that can be assigned immediately after identity setup.
- [ ] Seed fallback mission definitions for workout, cardio, and recovery day contexts.
- [ ] Seed title milestones and portrait milestone triggers.
- [ ] Seed reward tables for first-clear versus replay rewards.

Suggested registry files:

- `pwa/iron_quest/config/classes.json`
- `pwa/iron_quest/config/motivations.json`
- `pwa/iron_quest/config/locations.json`
- `pwa/iron_quest/config/missions.json`
- `pwa/iron_quest/config/launch_graph.json`
- `pwa/iron_quest/config/daily_quests.json`
- `pwa/iron_quest/config/portrait_triggers.json`

Acceptance criteria:

- V1 content can be validated without reading prose docs.
- Every live mission slug and location slug is defined once.
- Every seeded location has a replayable fallback mission.
- Any runtime unlock-path override is declared in one launch-graph file instead of being hidden inside location metadata.

## 5. Premium Onboarding And Identity

### Backend

- [ ] Decide whether IronQuest setup lives as an extension of current onboarding or as a post-onboarding premium branch.
- [ ] Store `enabled`, `class_slug`, and `motivation_slug` on first IronQuest setup.
- [ ] Reuse existing headshot and generated-image flows where possible.

### Frontend

- [ ] Add an IronQuest premium onboarding entry point after base onboarding completion.
- [ ] Build class selection UI.
- [ ] Build motivation selection UI.
- [ ] Reuse the current face upload flow where available.
- [ ] Trigger starter portrait generation.
- [ ] Show a character reveal handoff into the first mission.

Acceptance criteria:

- A premium user can complete IronQuest setup in one guided flow.
- A user who skips face upload can still enter IronQuest.
- The first mission is assigned automatically after setup.

## 6. Dashboard And Rewards Integration

### Dashboard

- [ ] Add current mission card.
- [ ] Add current location card.
- [ ] Add travel progress card.
- [ ] Add daily quest card.
- [ ] Add readiness summary card.
- [ ] Add IronQuest gallery teaser card.

### Rewards

- [ ] Add IronQuest XP display.
- [ ] Add level and title display.
- [ ] Add milestone unlock presentation.
- [ ] Add portrait history or gallery access.

Acceptance criteria:

- The dashboard answers: where am I, what is my next mission, and what can I do today for progress.
- Rewards clearly show that IronQuest progress is real even before deep world systems exist.

## 7. Workout Mission Overlay

### Mission flow

- [ ] Attach a mission to the workout session when IronQuest is enabled.
- [ ] Show a short mission intro before the workout starts.
- [ ] Support an optional pre-workout stance or choice.
- [ ] Show short rest-time beats only during rest windows.
- [ ] Resolve mission outcome after workout completion.
- [ ] Award XP, gold, and unlock triggers from the result.

### AI and fallback behavior

- [ ] Add `ironquest` as a bounded AI mode if a new mode is needed.
- [ ] Limit prompt context to class, location, mission, encounter phase, exercise, set number, result band, and readiness state.
- [ ] Set a hard timeout budget for rest-time narration.
- [ ] Add deterministic fallback copy when AI is unavailable or late.
- [ ] Ensure story is skippable and does not add extra taps per set.

Acceptance criteria:

- The workout logging path remains as fast as non-IronQuest workout logging.
- Narrative never interrupts active lifting.
- If AI fails, the workout still completes cleanly and mission resolution still works.

## 8. Daily Quests And Travel Progress

- [ ] Define one daily quest for each v1 support behavior: meals, sleep, cardio, steps, workout.
- [ ] Award small XP or gold for support behaviors.
- [ ] Use cardio and steps for travel progress.
- [ ] Use sleep logging for readiness restoration.
- [ ] Use meal logging for small bonus or buff state.
- [ ] Keep all support rewards below the value of a real completed workout.
- [ ] Unlock later locations through accumulated progress, not hard consumable gates.

Acceptance criteria:

- A user can feel momentum from healthy behavior without replacing training with passive logging.
- Travel expands variety and rewards but never strands the user without a mission.

## 9. Entitlement Gating

- [ ] Identify the current premium gating mechanism or create a thin entitlement adapter.
- [ ] Gate IronQuest setup, mission overlay, portrait generation, and premium dashboard cards behind that adapter.
- [ ] Decide how non-premium users see upsell cues without breaking the base flow.
- [ ] Ensure entitlement state is available to both REST and PWA bootstrapping.

Acceptance criteria:

- Premium gating is consistent across backend and frontend.
- Non-premium users never hit broken or half-enabled IronQuest states.

## 10. Analytics

- [ ] Add events for IronQuest enabled, identity completed, portrait generated, mission started, mission completed, mission replayed, travel unlock earned, daily quest completed, and milestone portrait unlocked.
- [ ] Add event properties for class, location, mission slug, run type, result band, readiness band, and entitlement state.
- [ ] Build a comparison view for premium IronQuest users versus non-IronQuest users where possible.
- [ ] Track whether workout completion rate changes when IronQuest is enabled.
- [ ] Track whether cardio, meal logging, sleep logging, and steps improve after IronQuest adoption.

Primary launch metrics:

- premium workout frequency
- workout completion rate
- cardio frequency
- meal logging frequency
- sleep logging frequency
- step-target completion frequency
- live workout repeat usage
- portrait engagement
- premium retention

Acceptance criteria:

- Product decisions after launch can be made from real usage data, not anecdotes.

## 11. Test Coverage

### Backend tests

- [ ] Add schema tests for new IronQuest tables.
- [ ] Add service tests for XP and gold awarding.
- [ ] Add tests for duplicate event protection through the activity ledger.
- [ ] Add tests for replay mission selection.
- [ ] Add tests proving low readiness does not block workouts.

### Frontend tests

- [ ] Add onboarding flow tests for class and motivation setup.
- [ ] Add dashboard rendering tests for IronQuest cards.
- [ ] Add rewards rendering tests for IronQuest progression.
- [ ] Add workout overlay tests for rest-time beats and skip behavior.
- [ ] Add failure-path tests for AI narration timeout and fallback copy.

### Manual QA checklist

- [ ] Premium user can complete base onboarding and IronQuest setup in one pass.
- [ ] Premium user can start a workout even with low readiness.
- [ ] Premium user can replay a mission after completion.
- [ ] Workout session remains usable with AI disabled or timing out.
- [ ] Daily quest progress updates after meal, sleep, cardio, and steps events.
- [ ] Portrait generation success and failure states are both understandable.

## 12. Launch Readiness

- [ ] Seed production-safe v1 content only.
- [ ] Add admin or developer tools for inspecting IronQuest profile state and mission runs.
- [ ] Add migration and rollback notes for schema deployment.
- [ ] Add support notes for common user issues:
  - entitlement missing
  - portrait generation failure
  - mission not attached
  - rewards not appearing
- [ ] Confirm analytics events are visible before launch.

## Explicit Non-Goals For V1

These items are out of scope even if supporting docs exist:

- subclass trees
- inventory and gear management
- spell loadouts
- store simulation depth
- deep boss math
- a full 25-location campaign
- a separate game shell that replaces the main Johnny5k flow

## Recommended First Build Slice

If implementation starts immediately, build this vertical slice first:

1. Entitlement adapter
2. IronQuest profile table and service
3. Structured seed data for classes, motivations, and the four starter locations
4. Premium identity setup flow with starter portrait
5. Dashboard mission card plus rewards XP display
6. One replayable workout mission with deterministic fallback narration

That slice is enough to prove the product direction before building travel and daily quest depth.
