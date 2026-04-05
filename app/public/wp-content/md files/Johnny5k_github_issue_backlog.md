# Johnny5k GitHub Issue Backlog

This backlog translates the Johnny5k product specification into implementation-ready GitHub issues grouped by epic. Each issue includes a title, goal, key requirements, dependencies, and suggested acceptance criteria.

---

# Epic 1: Project Foundation and Platform Setup

## Issue 1.1: Initialize WordPress plugin architecture
**Goal**  
Create the base custom plugin that will own Johnny5k business logic.

**Requirements**
- Create plugin bootstrap file
- Register activation/deactivation hooks
- Establish service/provider structure
- Add environment/config loading
- Add versioning constant
- Add namespaced autoloading or equivalent structure

**Acceptance Criteria**
- Plugin activates successfully in WordPress
- Base folder structure is committed
- Core services can be registered without fatal errors

---

## Issue 1.2: Define application constants and configuration system
**Goal**  
Create a centralized configuration layer for feature flags, API keys, AI settings, and operational defaults.

**Requirements**
- Environment-aware config loading
- Support AI model settings
- Support feature flags
- Support cron intervals
- Support per-environment toggles

**Acceptance Criteria**
- Config values can be read from one shared layer
- Missing required config is surfaced safely
- Feature flags can enable/disable modules

**Dependencies**
- Issue 1.1

---

## Issue 1.3: Establish database migration framework
**Goal**  
Provide a repeatable way to create and evolve custom `wp_fit_*` tables.

**Requirements**
- Migration runner on plugin activation/update
- Versioned schema tracking
- Roll-forward strategy
- Logging for migration failures

**Acceptance Criteria**
- Migrations run once per version
- DB version is stored
- New tables can be added without manual SQL execution

**Dependencies**
- Issue 1.1

---

## Issue 1.4: Set up REST API namespace and route loader
**Goal**  
Create a scalable REST route registration pattern under `/wp-json/fit/v1/`.

**Requirements**
- Namespace constant
- Modular route registration
- Permission callback structure
- Shared response helpers
- Shared validation helpers

**Acceptance Criteria**
- Route groups can register independently
- Permission handling is centralized
- Error responses follow a consistent shape

**Dependencies**
- Issue 1.1

---

## Issue 1.5: Create background jobs and cron framework
**Goal**  
Support recurring operational jobs such as calorie recalculations and award rescoring.

**Requirements**
- Cron registration
- Job dispatcher
- Logging
- Manual re-run support for admin
- Safety against duplicate runs

**Acceptance Criteria**
- Scheduled jobs can be registered and executed
- Duplicate overlapping runs are prevented
- Failed jobs are logged clearly

**Dependencies**
- Issue 1.1, Issue 1.2

---

# Epic 2: Authentication, Account, and Session Layer

## Issue 2.1: Implement front-end account flows using WordPress auth
**Goal**  
Provide signup, login, logout, and password reset for app users.

**Requirements**
- Signup endpoint/UI support
- Login endpoint/UI support
- Logout support
- Password reset initiation
- Nonce/session handling for app usage

**Acceptance Criteria**
- User can create an account and log in
- User can log out cleanly
- Password reset flow can be initiated successfully

**Dependencies**
- Issue 1.4

---

## Issue 2.2: Prevent normal users from accessing WP admin
**Goal**  
Ensure standard app users cannot use WordPress admin interfaces.

**Requirements**
- Capability restrictions
- Redirect/block admin access
- Preserve admin access for team roles

**Acceptance Criteria**
- Standard app users cannot access `/wp-admin`
- Admin/editor/operator roles retain intended access

**Dependencies**
- Issue 2.1

---

## Issue 2.3: Build account profile and preference storage
**Goal**  
Persist app-specific account settings separately from base WordPress user records.

**Requirements**
- Profile editing
- Preferences editing
- Onboarding state
- Consent/disclaimer storage
- Account deletion request support

**Acceptance Criteria**
- Profile updates persist to custom tables
- Preferences can be updated without touching WP admin
- Consent state is auditable

**Dependencies**
- Issue 1.3, Issue 2.1

---

# Epic 3: Database Schema Implementation

## Issue 3.1: Create user profile and preference tables
**Goal**  
Implement the `wp_fit_user_profiles`, `wp_fit_user_preferences`, and `wp_fit_user_health_flags` tables.

**Requirements**
- Schema creation
- Indexes
- Data access layer
- Validation rules

**Acceptance Criteria**
- Tables are created successfully
- CRUD operations function correctly
- User uniqueness constraints are enforced

**Dependencies**
- Issue 1.3

---

## Issue 3.2: Create goal and body tracking tables
**Goal**  
Implement goal, body metrics, sleep, step, and cardio tables.

**Requirements**
- `wp_fit_user_goals`
- `wp_fit_body_metrics`
- `wp_fit_sleep_logs`
- `wp_fit_step_logs`
- `wp_fit_cardio_logs`

**Acceptance Criteria**
- All tables exist
- Date-based queries are performant
- User history can be retrieved accurately

**Dependencies**
- Issue 1.3

---

## Issue 3.3: Create exercise library and programming tables
**Goal**  
Implement exercise, substitution, and program template tables.

**Requirements**
- `wp_fit_exercises`
- `wp_fit_exercise_substitutions`
- `wp_fit_program_templates`
- `wp_fit_program_template_days`
- `wp_fit_program_template_exercises`

**Acceptance Criteria**
- Exercise library supports substitutions and programming defaults
- Template queries return valid ordered structures

**Dependencies**
- Issue 1.3

---

## Issue 3.4: Create user training plan and workout logging tables
**Goal**  
Implement training plan, session, session exercise, set, and snapshot tables.

**Requirements**
- `wp_fit_user_training_plans`
- `wp_fit_user_training_days`
- `wp_fit_user_training_day_exercises`
- `wp_fit_workout_sessions`
- `wp_fit_workout_session_exercises`
- `wp_fit_workout_sets`
- `wp_fit_exercise_performance_snapshots`

**Acceptance Criteria**
- Training plans can be persisted and queried
- Sessions and sets can be logged with history
- Performance snapshots can be generated reliably

**Dependencies**
- Issue 1.3

---

## Issue 3.5: Create nutrition, pantry, and meal tables
**Goal**  
Implement foods, saved meals, meals, meal items, pantry, and recipe suggestion tables.

**Requirements**
- `wp_fit_foods`
- `wp_fit_saved_meals`
- `wp_fit_meals`
- `wp_fit_meal_items`
- `wp_fit_pantry_items`
- `wp_fit_recipe_suggestions`

**Acceptance Criteria**
- Meals and meal items persist correctly
- Saved meals can be reused
- Pantry items support suggestions logic later

**Dependencies**
- Issue 1.3

---

## Issue 3.6: Create AI analysis, progress photo, gamification, and chat tables
**Goal**  
Implement remaining tables for AI workflows and user engagement.

**Requirements**
- `wp_fit_media_analysis_jobs`
- `wp_fit_progress_photos`
- `wp_fit_awards`
- `wp_fit_user_awards`
- `wp_fit_daily_scores`
- `wp_fit_ai_threads`
- `wp_fit_ai_messages`

**Acceptance Criteria**
- AI jobs can be tracked through lifecycle states
- Awarding and scoring data persists correctly
- AI thread history is queryable by user

**Dependencies**
- Issue 1.3

---

# Epic 4: Onboarding and User Personalization

## Issue 4.1: Build onboarding step flow UI
**Goal**  
Create the complete onboarding journey from body basics through summary.

**Requirements**
- Multi-step mobile-first UI
- Save partial progress
- Resume later
- Validation per step

**Acceptance Criteria**
- Users can complete all onboarding steps
- Incomplete onboarding can be resumed
- Required fields are enforced

**Dependencies**
- Issue 2.3

---

## Issue 4.2: Implement onboarding data endpoints
**Goal**  
Create `start`, `complete`, and `restart` onboarding endpoints.

**Requirements**
- POST `/onboarding/start`
- POST `/onboarding/complete`
- POST `/onboarding/restart`
- Validation and persistence
- Version tracking

**Acceptance Criteria**
- Onboarding endpoints persist and return expected state
- Restart preserves auditability/version behavior

**Dependencies**
- Issue 1.4, Issue 3.1

---

## Issue 4.3: Generate initial calorie target and macro targets from onboarding
**Goal**  
Translate onboarding data into initial nutrition targets.

**Requirements**
- Baseline formula logic
- Goal modifier support
- Protein/carbs/fat target generation
- Store rationale

**Acceptance Criteria**
- Initial targets are generated after onboarding completion
- Targets are persisted with explainable logic

**Dependencies**
- Issue 3.1, Issue 3.2, Issue 4.2

---

## Issue 4.4: Generate initial training split from onboarding
**Goal**  
Create the user's first weekly training plan based on onboarding inputs.

**Requirements**
- Consider goal, experience, injuries, equipment, schedule, session length
- Produce push/pull/legs structure with shoulders included
- Support bonus arms/shoulders day where appropriate

**Acceptance Criteria**
- User receives a valid first training split
- Generated plan respects major constraints

**Dependencies**
- Issue 3.3, Issue 3.4, Issue 4.2

---

# Epic 5: Dashboard and Home Experience

## Issue 5.1: Implement home dashboard API
**Goal**  
Provide app-ready dashboard data for today.

**Requirements**
- GET `/dashboard/today`
- Calories/macros/micros status
- Steps and sleep status
- Today's workout assignment
- Tomorrow recommendation
- Streaks and awards summary

**Acceptance Criteria**
- Endpoint returns all dashboard cards in one response
- Response shape is stable and documented

**Dependencies**
- Issue 3.2, Issue 3.4, Issue 3.6

---

## Issue 5.2: Implement weekly dashboard and compliance API
**Goal**  
Provide weekly trends, score breakdown, and consistency metrics.

**Requirements**
- GET `/dashboard/week`
- Compliance calculations
- Weekly score summary
- Trend data for charts

**Acceptance Criteria**
- Weekly endpoint returns actionable trend data
- Score values reconcile with stored daily scores

**Dependencies**
- Issue 3.2, Issue 3.6

---

## Issue 5.3: Build home dashboard UI
**Goal**  
Render the primary Home tab experience.

**Requirements**
- Greeting and encouragement snippet
- Macro/calorie cards
- Steps/sleep cards
- Workout card
- Tomorrow plan card
- Quick actions
- Motivation/tip/story sections

**Acceptance Criteria**
- Home tab is mobile-first and fast
- All primary actions are accessible within one or two taps

**Dependencies**
- Issue 5.1, Issue 5.2

---

# Epic 6: Training Engine

## Issue 6.1: Implement program template administration
**Goal**  
Allow admins to manage base program templates and template days.

**Requirements**
- CRUD for templates
- CRUD for template day order and time tier
- CRUD for template exercises and slot metadata

**Acceptance Criteria**
- Admin can create/update templates without SQL
- Template ordering and slot metadata are preserved correctly

**Dependencies**
- Issue 3.3

---

## Issue 6.2: Implement workout generation engine
**Goal**  
Generate day-level and plan-level workouts from rules rather than hardcoded plans.

**Requirements**
- Consider age, injuries, equipment, history, soreness/readiness, session length
- Include shoulder movement on push/pull/legs
- Support short/medium/full session variants
- Avoid excessive recent repetition

**Acceptance Criteria**
- Workout generator outputs valid ordered exercise lists
- Constraints are respected across tested user scenarios

**Dependencies**
- Issue 3.3, Issue 3.4, Issue 4.4

---

## Issue 6.3: Implement exercise substitution engine
**Goal**  
Provide recommended swaps based on constraints and similar stimulus.

**Requirements**
- Similar training effect
- Joint-friendly options
- Equipment-aware options
- Reason tags for each substitution

**Acceptance Criteria**
- Swap suggestions are available for eligible exercises
- Reason tags explain why each option appears

**Dependencies**
- Issue 3.3, Issue 6.2

---

## Issue 6.4: Implement progression and performance logic
**Goal**  
Support double progression, load progression, top set/backoff, and deload triggers.

**Requirements**
- Track prior exposure performance
- Recommend next load/rep target
- Handle stalls and deload conditions
- Store performance snapshots

**Acceptance Criteria**
- Recommended loads/reps change sensibly over time
- Deload or swap suggestions occur after repeated regression/stalls

**Dependencies**
- Issue 3.4

---

## Issue 6.5: Implement tomorrow plan recommendation engine
**Goal**  
Recommend the next day's best training assignment and rationale.

**Requirements**
- Consider recent training, recovery, calorie target, and readiness
- Choose from push, pull, legs, arms_shoulders, cardio, rest
- Provide simple explanation

**Acceptance Criteria**
- Endpoint returns recommended day type and rationale
- Recommendations reflect recent workload and recovery state

**Dependencies**
- Issue 3.2, Issue 3.4, Issue 6.2

---

# Epic 7: Workout Logging UX and APIs

## Issue 7.1: Implement workout session endpoints
**Goal**  
Support start, read, complete, and history retrieval for workout sessions.

**Requirements**
- POST `/workouts/session/start`
- GET `/workouts/session/{id}`
- POST `/workouts/session/{id}/complete`
- GET `/workouts/history`

**Acceptance Criteria**
- Sessions can be started, resumed, completed, and viewed in history

**Dependencies**
- Issue 1.4, Issue 3.4

---

## Issue 7.2: Implement set logging endpoints
**Goal**  
Allow creation, update, and deletion of logged workout sets.

**Requirements**
- POST `/workouts/session-exercise/{id}/sets`
- PUT `/workouts/sets/{id}`
- DELETE `/workouts/sets/{id}`

**Acceptance Criteria**
- Sets can be logged with weight, reps, RIR, RPE, and pain flag
- Set changes update summaries correctly

**Dependencies**
- Issue 7.1

---

## Issue 7.3: Implement swap/add exercise session actions
**Goal**  
Support swap exercise, add abs, add challenge, and exercise add/remove within sessions.

**Requirements**
- POST swap endpoint
- POST quick-add abs endpoint
- POST quick-add challenge endpoint
- Add/remove session exercise endpoints

**Acceptance Criteria**
- Users can modify live sessions without corruption
- Original exercise tracking is preserved for swaps

**Dependencies**
- Issue 7.1, Issue 6.3

---

## Issue 7.4: Build active workout logging screen
**Goal**  
Create the core one-hand workout logging experience.

**Requirements**
- Large inputs
- Last-session reference
- Today recommendation
- Quick weight controls
- Sticky add set / swap / add abs / add challenge / finish controls

**Acceptance Criteria**
- Core logging actions take one or two taps
- Screen is usable with one hand on mobile
- Last-session data and recommendations are visible

**Dependencies**
- Issue 7.1, Issue 7.2, Issue 7.3

---

## Issue 7.5: Build workout summary screen
**Goal**  
Provide a meaningful post-session recap.

**Requirements**
- Completed exercises
- Set count
- Volume summary
- PR/improvement markers
- AI recap placeholder/support

**Acceptance Criteria**
- Summary screen appears after completion
- Key performance outcomes are visible immediately

**Dependencies**
- Issue 7.1, Issue 6.4

---

# Epic 8: Recovery and Activity Tracking

## Issue 8.1: Implement sleep logging and trends
**Goal**  
Track sleep entries and expose trend data.

**Requirements**
- POST `/sleep`
- GET `/sleep`
- GET `/sleep/trends`

**Acceptance Criteria**
- Users can log sleep hours and quality
- Trend endpoint returns chart-friendly data

**Dependencies**
- Issue 3.2, Issue 1.4

---

## Issue 8.2: Implement steps logging and trends
**Goal**  
Track daily steps and expose trend data.

**Requirements**
- POST `/steps`
- GET `/steps`
- GET `/steps/trends`

**Acceptance Criteria**
- Step entries persist correctly
- Trend data aggregates by date reliably

**Dependencies**
- Issue 3.2, Issue 1.4

---

## Issue 8.3: Implement cardio logging and trends
**Goal**  
Track cardio sessions and expose trend data.

**Requirements**
- POST `/cardio`
- GET `/cardio`
- GET `/cardio/trends`

**Acceptance Criteria**
- Cardio entries include type, duration, intensity
- Trend summaries are accurate

**Dependencies**
- Issue 3.2, Issue 1.4

---

## Issue 8.4: Feed recovery/activity data into training and calorie logic
**Goal**  
Ensure steps, sleep, cardio, and readiness influence recommendations.

**Requirements**
- Training engine consumes recent recovery data
- Calorie adjustment logic considers activity/recovery context

**Acceptance Criteria**
- Training recommendations change appropriately with recovery state
- Calorie adjustments account for meaningful context inputs

**Dependencies**
- Issue 8.1, Issue 8.2, Issue 8.3, Issue 6.5, Issue 9.2

---

# Epic 9: Nutrition Engine

## Issue 9.1: Implement food search and custom food management
**Goal**  
Allow users to search foods and create reusable food records.

**Requirements**
- GET `/foods/search`
- POST `/foods`
- PUT `/foods/{id}`

**Acceptance Criteria**
- Foods can be searched and reused
- Custom foods persist with nutrition data

**Dependencies**
- Issue 3.5, Issue 1.4

---

## Issue 9.2: Implement calorie adjustment algorithm
**Goal**  
Perform weekly calorie target reviews based on adherence and trend data.

**Requirements**
- Initial formula + weekly correction
- Small change logic
- Low adherence guardrail
- Protect protein minimum
- Store prior target and change reason

**Acceptance Criteria**
- Weekly adjustments produce explainable target changes
- No reduction occurs when adherence is too low to judge

**Dependencies**
- Issue 3.2, Issue 3.5, Issue 4.3

---

## Issue 9.3: Implement meal CRUD and day views
**Goal**  
Support meal logging, editing, deletion, and day-specific retrieval.

**Requirements**
- POST `/meals`
- PUT `/meals/{id}`
- GET `/meals`
- GET `/meals/day/{date}`
- DELETE `/meals/{id}`

**Acceptance Criteria**
- Meals and meal items can be created and edited
- Day views reconcile to daily totals correctly

**Dependencies**
- Issue 3.5, Issue 1.4

---

## Issue 9.4: Implement saved meals workflows
**Goal**  
Allow users to save, duplicate, edit, and one-tap log common meals.

**Requirements**
- GET `/saved-meals`
- POST `/saved-meals`
- PUT `/saved-meals/{id}`
- DELETE `/saved-meals/{id}`

**Acceptance Criteria**
- Saved meals can be created from existing meals or manually
- One-tap logging creates valid meals from saved templates

**Dependencies**
- Issue 3.5, Issue 9.3

---

## Issue 9.5: Implement pantry CRUD and pantry-aware logic
**Goal**  
Track pantry items and enable future pantry-based meal suggestions.

**Requirements**
- POST `/pantry-items`
- GET `/pantry-items`
- PUT `/pantry-items/{id}`
- DELETE `/pantry-items/{id}`

**Acceptance Criteria**
- Pantry items can be managed from mobile UI
- Expiring-soon and availability data can be queried

**Dependencies**
- Issue 3.5, Issue 1.4

---

## Issue 9.6: Implement meal planner, recipe suggestion, and grocery gap endpoints
**Goal**  
Provide practical meal suggestions based on pantry and remaining macros.

**Requirements**
- POST `/meal-planner/suggest`
- POST `/meal-planner/modify-standard-meal`
- POST `/recipes/suggest-from-pantry`
- POST `/recipes/grocery-gap-suggestions`

**Acceptance Criteria**
- Suggestions account for macros/calories remaining and goal
- Grocery gap responses show what small purchases unlock

**Dependencies**
- Issue 9.4, Issue 9.5, Issue 9.2

---

# Epic 10: AI Meal Vision, Label Parsing, and Progress Photo Analysis

## Issue 10.1: Integrate OpenAI structured output service layer
**Goal**  
Create a shared AI service that supports structured outputs, image inputs, and tool orchestration.

**Requirements**
- OpenAI client wrapper
- JSON schema enforcement
- Retry/error handling
- Request/response logging
- Model config support

**Acceptance Criteria**
- Structured responses can be requested and validated
- Image-capable calls work through one shared service

**Dependencies**
- Issue 1.2

---

## Issue 10.2: Implement media analysis job lifecycle
**Goal**  
Track pending, processing, completed, failed, and needs_review AI media jobs.

**Requirements**
- Job creation
- Status transitions
- Raw response storage
- Parsed output storage
- Failure handling

**Acceptance Criteria**
- AI media workflows create auditable jobs
- Failed jobs can be retried or reviewed

**Dependencies**
- Issue 3.6, Issue 10.1

---

## Issue 10.3: Implement meal photo analysis workflow
**Goal**  
Allow users to upload a meal image, receive editable structured estimates, and confirm final truth.

**Requirements**
- POST `/ai/analyze-meal-photo`
- POST `/ai/confirm-meal-photo`
- Candidate items with confidence
- User confirmation step before persistence

**Acceptance Criteria**
- Meal image returns editable food item estimates
- Confirmed result is stored as the source of truth
- Unconfirmed AI output is stored separately

**Dependencies**
- Issue 10.1, Issue 10.2, Issue 9.3

---

## Issue 10.4: Implement food label parsing workflow
**Goal**  
Allow users to scan labels and save reusable foods from structured parsed output.

**Requirements**
- POST `/ai/parse-food-label`
- POST `/ai/confirm-food-label`
- Null-safe extraction for uncertain fields

**Acceptance Criteria**
- Label scan produces structured nutrition data
- Confirmed label creates reusable food records

**Dependencies**
- Issue 10.1, Issue 10.2, Issue 9.1

---

## Issue 10.5: Implement progress photo analysis workflow
**Goal**  
Allow baseline and follow-up photo comparisons with supportive AI analysis.

**Requirements**
- POST `/ai/analyze-progress-photo`
- POST `/progress-photos`
- GET `/progress-photos`
- GET `/progress-photos/timeline`

**Acceptance Criteria**
- Users can upload and view progress photos over time
- Analysis remains encouraging and non-shaming
- Baseline and previous comparisons are available

**Dependencies**
- Issue 10.1, Issue 10.2, Issue 3.6

---

## Issue 10.6: Build nutrition AI review screens
**Goal**  
Create the meal review and label review mobile flows.

**Requirements**
- Meal AI review screen
- Edit/add/remove item controls
- Label review form
- Confirm and save flows

**Acceptance Criteria**
- Users can correct AI output before saving
- Review screens are mobile-friendly and clear about uncertainty

**Dependencies**
- Issue 10.3, Issue 10.4

---

# Epic 11: Progress, Scoring, and Gamification

## Issue 11.1: Implement awards definitions and awarding service
**Goal**  
Support award definitions and user award assignment.

**Requirements**
- Award CRUD in admin
- Award evaluation service
- Context JSON when award granted

**Acceptance Criteria**
- Awards can be configured in admin
- Eligible awards can be granted automatically

**Dependencies**
- Issue 3.6

---

## Issue 11.2: Implement daily and weekly scoring engine
**Goal**  
Calculate nutrition, training, recovery, and consistency scores.

**Requirements**
- Daily score calculation
- Weekly aggregation
- Recompute support
- Visibility in dashboard

**Acceptance Criteria**
- Scores persist per date
- Weekly summaries match underlying daily data

**Dependencies**
- Issue 3.6, Issue 8.4, Issue 9.2

---

## Issue 11.3: Build awards and milestones UI
**Goal**  
Show earned badges, recent awards, and next milestone opportunities.

**Requirements**
- Awards screen
- Home dashboard summary card
- Personal leaderboard/milestones panel

**Acceptance Criteria**
- Users can review earned awards and next possible goals
- Award visuals appear in relevant surfaces

**Dependencies**
- Issue 11.1, Issue 11.2, Issue 5.3

---

# Epic 12: AI Coach and Tool-Oriented Assistant

## Issue 12.1: Implement AI coach thread and message persistence
**Goal**  
Store AI conversation history in structured thread/message tables.

**Requirements**
- Thread creation
- Message creation
- Reset support
- User-scoped retrieval

**Acceptance Criteria**
- Threads and messages persist correctly
- Reset clears active conversational context safely

**Dependencies**
- Issue 3.6

---

## Issue 12.2: Build internal AI tool registry
**Goal**  
Expose application capabilities to the AI layer as internal callable tools.

**Requirements**
- Profile/context tools
- Training tools
- Recovery tools
- Nutrition tools
- Image tools
- Logging tools
- Motivation tools

**Acceptance Criteria**
- AI can invoke backend tools without direct DB writes
- Tool inputs/outputs are validated

**Dependencies**
- Issue 10.1, Issue 12.1

---

## Issue 12.3: Implement `/ai/chat` orchestration endpoint
**Goal**  
Process user messages, call needed tools, and return structured AI responses.

**Requirements**
- POST `/ai/chat`
- Tool routing
- Safety rules
- Structured response support for cards
- Fallback plain chat response

**Acceptance Criteria**
- AI responses are grounded in real user data
- AI does not invent unretrieved user state
- Structured cards can be returned when relevant

**Dependencies**
- Issue 12.2

---

## Issue 12.4: Build AI coach tab UI
**Goal**  
Create the chat interface and suggestion chip experience.

**Requirements**
- Chat history
- Suggestion chips
- Structured response cards
- Reset thread action

**Acceptance Criteria**
- Users can ask contextual questions from mobile UI
- Structured responses render as useful cards when appropriate

**Dependencies**
- Issue 12.3

---

## Issue 12.5: Implement AI safety guardrails and prompt management
**Goal**  
Ensure the AI coach remains safe, supportive, and consistent.

**Requirements**
- Stable system prompt
- Prompt templates managed in admin
- Rules against invented data
- Rules against harmful dieting/training guidance
- Progress photo tone guardrails

**Acceptance Criteria**
- Prompt definitions are editable by admins
- Safety rules are enforceable and tested in representative scenarios

**Dependencies**
- Issue 10.1, Issue 12.2

---

# Epic 13: Admin and Operational Controls

## Issue 13.1: Build exercise library admin screens
**Goal**  
Allow admins to manage exercises and substitution mappings.

**Requirements**
- Exercise CRUD
- Metadata editing
- Substitution mapping UI

**Acceptance Criteria**
- Admin can manage the exercise library without code changes

**Dependencies**
- Issue 3.3

---

## Issue 13.2: Build recipe, challenge, and content admin screens
**Goal**  
Allow admins to manage recipes, challenge exercises, and curated motivational content.

**Requirements**
- Recipe library
- Challenge exercise library
- Motivation/tip/story content blocks

**Acceptance Criteria**
- Curated content can be updated from admin
- No live scraping dependency is required for daily content

**Dependencies**
- Issue 3.5

---

## Issue 13.3: Build AI operations and cost visibility tools
**Goal**  
Support AI parse review, retry workflows, and token/cost monitoring.

**Requirements**
- AI jobs review list
- Retry action
- Token/cost dashboard
- Error logging visibility

**Acceptance Criteria**
- Admins can identify failed AI jobs and retry them
- Basic token/cost observability is available

**Dependencies**
- Issue 10.2

---

## Issue 13.4: Build feature flag and app settings management
**Goal**  
Allow controlled rollout and runtime configuration of app capabilities.

**Requirements**
- Feature flags UI
- App settings UI
- AI model config UI
- Notification preferences defaults

**Acceptance Criteria**
- Features can be toggled without deployment
- Settings changes are applied safely

**Dependencies**
- Issue 1.2

---

# Epic 14: Mobile App Shell and Navigation

## Issue 14.1: Build app shell and bottom-tab navigation
**Goal**  
Create the mobile-first navigation structure for Home, Workout, Nutrition, Progress, and Coach.

**Requirements**
- App shell
- Bottom tabs
- Auth guard
- Shared header/footer patterns

**Acceptance Criteria**
- Logged-in users can navigate all main tabs cleanly
- Tab state behaves correctly on mobile devices

**Dependencies**
- Issue 2.1

---

## Issue 14.2: Build auth screens and onboarding entry flow
**Goal**  
Create welcome, login, signup, and onboarding transition screens.

**Requirements**
- Welcome screen
- Login screen
- Signup screen
- Terms/disclaimer acceptance
- Route into onboarding

**Acceptance Criteria**
- New user can move from signup into onboarding without dead ends
- Existing user can log in directly to the app shell

**Dependencies**
- Issue 2.1, Issue 4.1

---

## Issue 14.3: Implement client-side caching and offline queue strategy
**Goal**  
Improve resilience for temporary connectivity loss and fast mobile interactions.

**Requirements**
- Cached dashboard/workout state
- Offline queue for log actions where appropriate
- Retry behavior
- Conflict-handling strategy

**Acceptance Criteria**
- Core logging flows tolerate short connectivity loss
- Queue retry behavior is predictable and safe

**Dependencies**
- Issue 14.1, Issue 7.4, Issue 9.3

---

# Epic 15: QA, Validation, and Release Readiness

## Issue 15.1: Convert agent checklist into QA test cases
**Goal**  
Translate the compliance checklist into concrete manual/automated test cases.

**Requirements**
- Acceptance tests by epic
- Core end-to-end journey tests
- Negative tests for AI safety and permissions
- Mobile UX checks

**Acceptance Criteria**
- Test suite covers onboarding, workouts, nutrition, dashboard, and AI coach
- Critical regressions can be detected before release

**Dependencies**
- Johnny5k_agent_checklist.md

---

## Issue 15.2: Write API contract documentation
**Goal**  
Document request/response shapes for all core endpoints.

**Requirements**
- Endpoint catalog
- Example payloads
- Error shapes
- Auth expectations
- Versioning notes

**Acceptance Criteria**
- Front-end and AI integration can rely on stable API contracts

**Dependencies**
- Issues across Epics 4 through 12

---

## Issue 15.3: Run performance and usability validation for core mobile flows
**Goal**  
Confirm that the most important flows are fast and practical on mobile devices.

**Requirements**
- Workout logging usability test
- Dashboard load timing
- Nutrition review flow timing
- One-hand interaction validation

**Acceptance Criteria**
- Workout logging actions remain low-friction
- No major mobile UX blockers remain for MVP release

**Dependencies**
- Issue 7.4, Issue 5.3, Issue 10.6, Issue 14.3

---

# Suggested Milestone Grouping

## Milestone: MVP Foundation
- Epic 1
- Epic 2
- Epic 3
- Epic 4
- Epic 14

## Milestone: Training and Dashboard MVP
- Epic 5
- Epic 6
- Epic 7
- Epic 8

## Milestone: Nutrition MVP
- Epic 9

## Milestone: AI Workflows
- Epic 10
- Epic 12

## Milestone: Progress and Motivation
- Epic 11
- Epic 13

## Milestone: Release Readiness
- Epic 15

---

# Suggested Labels

- `epic`
- `backend`
- `frontend`
- `mobile`
- `wordpress`
- `database`
- `api`
- `ai`
- `nutrition`
- `training`
- `recovery`
- `gamification`
- `admin`
- `qa`
- `mvp`
- `phase-2`
- `phase-3`

---

# Notes for Import

When converting these into GitHub issues:
- Create each epic as a parent tracking issue
- Create child issues beneath the epic using task lists or linked issues
- Apply milestone labels by implementation phase
- Mark AI safety, auth, and workout logging items as highest priority
