# Johnny 5000 Implementation Brief for GitHub Copilot Agent

## Purpose

This document explains what a GitHub Copilot agent needs to know to implement five improvements that will make **Johnny 5000** feel more real, interactive, and natively tied to the Johnny5k app.

This brief is based on the current plugin structure and AI implementation in:

- `app/public/wp-content/plugins/johnny5k/johnny5k.php`
- `app/public/wp-content/plugins/johnny5k/includes/REST/class-router.php`
- `app/public/wp-content/plugins/johnny5k/includes/REST/class-ai-controller.php`
- `app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php`

---

## Current Architecture Summary

### Plugin bootstrap
The main plugin file:
- defines the plugin constants
- autoloads classes from `includes/`
- runs DB setup and scheduled events
- registers REST routes through `Johnny5k\REST\Router::register_routes()`

### REST routing
The router currently registers:
- auth
- onboarding
- body metrics
- dashboard
- training
- workout
- AI
- admin API

AI-specific routes are currently handled through `AiController`.

### Current AI capabilities
Johnny already supports:
- general chat via `POST /fit/v1/ai/chat`
- meal image analysis
- food label image analysis
- thread history retrieval
- thread clearing
- workout summary generation
- weekly check-in generation
- SMS copy generation

### Current AI design pattern
The current pattern is:

1. Build a system prompt from:
   - admin-edited persona prompt
   - limited user context
2. Load recent thread messages
3. Append latest user message
4. Call OpenAI Responses API
5. Save user and assistant messages to DB
6. Return plain text plus optional web sources

This is a good base, but Johnny still behaves mostly as a text responder instead of an embedded product agent.

---

# Goal State

Johnny 5000 should feel like:

- a coach who knows the user's current behavior, not just profile fields
- an assistant with memory over time
- a system that adapts tone and behavior by context
- a native in-app actor that can do things, not just say things
- a more distinct, behaviorally consistent product character

---

# Implementation Priorities

Implement these in this order unless blocked:

1. Expand live user context
2. Add durable memory summaries
3. Add structured in-app actions
4. Add mode-aware behavior
5. Rewrite the core persona contract

---

# Suggestion 1: Expand Johnny's live user context

## Problem
`AiService::build_system_prompt()` currently injects only a narrow set of user fields:
- first name
- goal type
- experience
- target calories
- target protein
- latest weight

This is not enough to make Johnny feel deeply aware of what the user is actually doing.

## Desired outcome
Johnny should respond using current behavioral context, such as:
- recent workout consistency
- days since last workout
- average calories and protein over the last week
- meal logging consistency
- pantry status
- saved meal usage
- whether the user is trending on or off goal

## Files likely to edit
- `app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php`

## Required implementation work

### 1. Expand `get_user_context(int $user_id): array`
Add fields such as:
- `workouts_last_7_days`
- `days_since_last_workout`
- `avg_calories_last_7_days`
- `avg_protein_last_7_days`
- `meal_logs_last_7_days`
- `days_with_meal_logs_last_7_days`
- `saved_meals_count`
- `pantry_item_count`
- `weight_change_last_14_days`
- `adherence_summary`
- `goal_trend_summary`

### 2. Reuse existing helper logic where appropriate
There is already logic in:
- `compile_weekly_stats()`
- nutrition summary methods
- pantry and saved meal flows

Do not duplicate calculations carelessly if they can be modularized.

### 3. Expand `build_system_prompt()`
Append a cleaner and more useful user-context block, for example:

- User's name
- Current goal
- Daily calorie target
- Protein target
- Latest weight
- Weight trend over last 2 weeks
- Workouts completed in last 7 days
- Days since last workout
- Avg calories last 7 days
- Avg protein last 7 days
- Meal logging consistency
- Pantry count
- Saved meals count

### 4. Keep prompts concise
Do not dump raw DB output or large JSON structures into the prompt.
Prefer short factual lines.

## Acceptance criteria
- Chat replies reference recent user behavior when relevant
- The system prompt remains compact enough for chat use
- No noticeable slowdown from excessive DB queries
- Missing data is handled gracefully

## Example target behavior
Instead of:
> Try to hit your protein goal today.

Johnny should say things more like:
> You averaged 126 g of protein this week against a 180 g target, so today I'd push protein hard in your first two meals.

---

# Suggestion 2: Add durable memory summaries per thread

## Problem
The app stores message history in `fit_ai_messages`, but only uses the most recent window of messages. This creates short-term continuity, but weak long-term memory.

## Desired outcome
Johnny should remember key user preferences, recurring struggles, and recent commitments across conversations.

## Files likely to edit
- `app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php`
- database schema file used by plugin activation and migration logic
- possibly controller files if memory refresh endpoints are added

## Required implementation work

### Option A: Add summary column to thread table
Preferred simple version:
- add a nullable `summary_text` column to `fit_ai_threads`

### Option B: Add dedicated memory table
If more extensibility is desired:
- create `fit_ai_thread_memory`
- fields might include:
  - `id`
  - `thread_id`
  - `summary_text`
  - `updated_at`

Option A is simpler and likely enough for now.

### 1. Generate summary snapshots
After every N assistant responses, generate/update a thread summary.

Suggested trigger:
- every 4 to 6 user turns
- or when thread message count exceeds a threshold

### 2. Summary content should capture
- goals the user is currently pursuing
- recurring nutrition or workout issues
- explicit plans Johnny has suggested
- preferences in coaching style
- commitments the user made
- notable recent wins or frustrations

### 3. Use summary in `chat()`
Before adding recent messages, prepend a short memory block:
- thread summary
- possibly a user-level coaching memory if added later

### 4. Avoid runaway size
Summaries should stay brief, around 8 to 15 lines max.

### 5. Do not replace raw history entirely
Use both:
- thread summary
- last recent messages

## Acceptance criteria
- Johnny shows continuity across longer threads
- Old but important context is not lost
- Token usage does not grow uncontrollably
- Summary refresh logic does not break chat flow

## Example memory summary
```text
Current coaching memory:
- User is focused on fat loss while preserving strength.
- User struggles most with weekend overeating.
- User responds well to direct accountability.
- Johnny recently told the user to front-load protein and walk after dinner.
- User wants quick weekday lunch options.
```

---

# Suggestion 3: Add structured in-app actions

## Problem
`POST /fit/v1/ai/chat` currently returns only:
- `reply`
- `sources`
- `used_web_search`

So Johnny can talk, but he cannot directly participate in app workflows.

## Desired outcome
Johnny should be able to return structured actions the frontend can interpret.

## Files likely to edit
- `app/public/wp-content/plugins/johnny5k/includes/REST/class-ai-controller.php`
- `app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php`
- frontend code that consumes `/fit/v1/ai/chat`

## Required implementation work

### 1. Extend the response contract for `/ai/chat`
Return:
- `reply`
- `actions`
- `sources`
- `used_web_search`

### 2. Add a lightweight action schema
Start small. Example supported actions:

- `open_screen`
- `create_saved_meal_draft`
- `suggest_recipe_plan`
- `show_nutrition_summary`
- `show_grocery_gap`
- `queue_follow_up`
- `highlight_goal_issue`

Example response:
```json
{
  "reply": "I pulled together a cleaner lunch option and surfaced your grocery gaps.",
  "actions": [
    {
      "type": "create_saved_meal_draft",
      "payload": {
        "name": "High-Protein Lunch Draft",
        "meal_type": "lunch",
        "items": []
      }
    },
    {
      "type": "open_screen",
      "payload": {
        "screen": "saved_meals"
      }
    }
  ]
}
```

### 3. Implement action generation conservatively
For v1:
- allow the model to return JSON inside a strict schema
- parse it safely
- if parsing fails, fall back to plain text reply with empty actions

### 4. Add a helper such as
- `AiService::chat_with_actions()`
or
- upgrade `AiService::chat()` to support action-capable responses

### 5. Separate visible reply from machine-readable intent
Do not force the frontend to parse natural language.

## Important safety / product rules
- Johnny should not perform destructive actions automatically
- He may suggest or draft, but not silently delete user data
- Favor reversible actions and UI navigation first

## Acceptance criteria
- Frontend receives machine-readable actions from chat
- Actions are optional and safe
- Plain-text fallback still works
- Chat remains backward-compatible for older consumers if necessary

---

# Suggestion 4: Add mode-aware behavior

## Problem
General chat currently uses one broad persona and one broad pipeline. That makes Johnny sound similar across very different scenarios.

## Desired outcome
Johnny should behave differently in different situations while preserving identity.

## Possible modes
- `general`
- `coach`
- `nutrition`
- `workout_review`
- `accountability`
- `planning`
- `education`

## Files likely to edit
- `app/public/wp-content/plugins/johnny5k/includes/REST/class-ai-controller.php`
- `app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php`
- frontend caller for `/ai/chat`

## Required implementation work

### 1. Allow `/ai/chat` to accept a mode parameter
Example request body:
```json
{
  "message": "What should I eat tonight?",
  "thread_key": "main",
  "mode": "nutrition"
}
```

### 2. Add a mode-specific prompt layer
Keep the main persona, then append mode instructions.

Example:
- `nutrition`: practical, swap-oriented, macro-aware
- `accountability`: shorter, firmer, direct
- `planning`: structured output, next steps, checklist feel
- `education`: more explanation, less urgency
- `workout_review`: performance framing and recovery notes

### 3. Add a resolver helper
Possible method:
- `private static function get_mode_instructions(string $mode): string`

### 4. Keep defaults safe
If mode is missing or invalid:
- fall back to `general`

## Acceptance criteria
- Different app contexts produce meaningfully different Johnny behavior
- Johnny retains a consistent voice across modes
- Invalid modes do not break the endpoint

---

# Suggestion 5: Rewrite the base persona as a behavioral contract

## Problem
The current default persona is decent, but it describes Johnny more than it operationalizes him.

Current persona concepts:
- cool
- buff
- knowledgeable
- kind
- direct
- warm
- occasionally funny
- not corporate

This gives brand flavor, but does not fully define response behavior.

## Desired outcome
Johnny should have a stronger operating contract that governs:
- what he notices
- how he speaks
- how direct he is
- how he uses data
- how he handles uncertainty
- how he avoids repetitive app-assistant language

## Files likely to edit
- `app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php`
- possibly admin prompt editor defaults and descriptions if exposed in admin UI

## Required implementation work

### 1. Replace the default persona with a more operational version
Key rules to encode:

- Johnny notices patterns and names them clearly
- He references user data whenever useful
- He gives one practical next step early
- He avoids generic motivational filler
- He is supportive without sounding overly polished
- He is concise unless detail is requested
- He varies phrasing and avoids repetitive openings
- He is honest when the user is off track
- He never sounds corporate or app-like
- He feels like a real coach, not a mascot

### 2. Keep admin-editable override behavior
The admin-configured system prompt should still work.
Do not remove customization support.

### 3. Consider versioning persona defaults
If the admin prompt is empty, use the improved default.
If the admin prompt is present, optionally append system-level behavioral rules after it.

## Acceptance criteria
- Johnny's responses feel more distinct and less templated
- Responses are more action-oriented
- SMS generation and chat feel like the same character
- Persona remains configurable by admin

## Suggested upgraded default persona
```text
You are Johnny 5000, the user's embedded fitness coach inside the Johnny5k app.

You are direct, calm, warm, observant, and grounded. You do not sound corporate, generic, or like a chatbot. You speak like a strong, experienced coach who actually knows the user's data and gives a damn.

Behavior rules:
- Notice patterns and say them clearly.
- Use the user's current data whenever it helps.
- Give one useful next step early.
- Avoid generic motivational fluff.
- Be honest when the user is off track, but never demeaning.
- Stay concise unless the user asks for detail.
- Vary your sentence openings and rhythm.
- Sound like a real person, not a feature.
- If you do not know something, say so plainly.
```

---

# Additional Technical Improvement: tighten message history loading

## Problem
`chat()` currently loads all messages for the thread, then slices the last 18 in PHP.

## Desired change
Reduce DB work by limiting at the query level or pairing a smaller message window with thread summaries.

## Suggested implementation
Either:
- query only the last N rows and reverse in application code if needed
- or keep current behavior temporarily if summary support lands first

## Acceptance criteria
- lower overhead on long threads
- no change in visible behavior

---

# Database / Migration Guidance

## Likely schema work
If implementing thread memory summaries:
- add `summary_text` to `fit_ai_threads`
or
- add a dedicated memory table

## Migration expectations
Update the plugin DB schema creation / migration path so:
- new installs create the required column/table
- existing installs migrate safely
- `jf_db_version` is incremented

## Copilot note
Search for the schema creation class referenced by:
- `Johnny5k\Database\Schema::create_tables()`
- `Johnny5k\Database\Schema::seed_defaults()`

Make migrations idempotent.

---

# API Contract Recommendations

## Suggested new `/ai/chat` request shape
```json
{
  "message": "Help me plan dinner.",
  "thread_key": "main",
  "mode": "nutrition"
}
```

## Suggested new `/ai/chat` response shape
```json
{
  "reply": "You've been a bit light on protein this week, so dinner should do some catching up. I'd build it around chicken, rice, and something green.",
  "actions": [
    {
      "type": "show_grocery_gap",
      "payload": {}
    }
  ],
  "sources": [],
  "used_web_search": false
}
```

## Backward compatibility
If older consumers expect only `reply`, `sources`, and `used_web_search`, make sure:
- `actions` is optional
- old clients do not break if they ignore it

---

# Implementation Phasing

## Phase 1
- expand user context
- improve default persona
- tighten prompt structure

## Phase 2
- add mode parameter and mode instructions
- add thread summaries / memory

## Phase 3
- add structured action response support
- wire frontend behaviors to action types

---

# Testing Guidance

## Unit / integration checks
Validate:
- chat still works with no mode provided
- chat still works with empty thread history
- missing user data does not produce warnings
- invalid model responses fail gracefully
- malformed action JSON does not crash chat
- thread summaries update correctly
- web search behavior remains unchanged unless explicitly improved

## Manual QA scenarios
1. New user with no data
2. User with body metrics but no recent meals
3. User with strong meal logging consistency
4. User with long chat thread
5. Nutrition-mode chat
6. Accountability-mode chat
7. Chat response with action objects
8. Admin-custom persona prompt present
9. Admin-custom persona prompt absent

---

# Non-goals for this implementation
Do not do these unless explicitly requested:
- full autonomous workflow execution
- destructive AI actions without confirmation
- major redesign of the OpenAI transport layer
- replacing the current AI controller architecture entirely
- massive prompt inflation with raw tables or large JSON objects

---

# Definition of Done

This work is complete when:

- Johnny uses richer live context in normal chat
- Johnny retains useful continuity beyond the last few turns
- Johnny supports mode-aware behavior
- Johnny can return structured, machine-readable in-app actions
- Johnny's persona feels more real, less templated, and more native to the product
- all changes are backward-compatible or safely versioned

---

# Final Guidance to Copilot Agent

Prefer small, clean, reviewable commits.

Recommended sequence:
1. Refactor context gathering
2. Improve system prompt composition
3. Add mode support
4. Add memory summary storage and refresh logic
5. Add structured actions to chat response
6. Update frontend integration points if present in repo

When in doubt:
- preserve existing behavior
- add new capabilities behind defaults
- favor deterministic parsing and safe fallbacks
- keep Johnny concise, grounded, and data-aware
