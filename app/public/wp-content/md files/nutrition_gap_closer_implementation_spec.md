# Nutrition Gap Closer: Implementation Spec

## Purpose

This feature answers one question fast:

> Given how the user has eaten today, what is the smartest next nutrition move?

It is not a macro report, recipe browser, or chat experience.

The output should feel like a sharp coach recommendation with immediate action.

## Product Goal

In one dashboard card, identify the single highest-priority nutrition gap, explain it in one sentence, recommend one practical next move, and offer up to 3 actions that lead directly into useful app flows.

## MVP Scope

### In scope

- One dashboard card
- One primary gap type
- One diagnosis line
- One recommendation line
- Up to 3 action buttons
- One optional secondary note
- Deterministic gap detection
- AI-generated phrasing only after the system has already chosen the gap and action set

### Out of scope for MVP

- Long-form chat
- Multi-gap optimization
- Full preference learning
- Deep pattern modeling
- Reminder automation
- Adaptive ranking based on prior acceptance

## Core Principle

The system should be rules-first and phrasing-second.

That means:

1. The app computes the current nutrition state.
2. The app ranks the likely gap types with deterministic rules.
3. The app chooses one primary gap and one action set.
4. AI, if used, only turns that structured result into polished copy.

This avoids product drift, improves testability, and prevents the model from inventing logic.

## Inputs

### Required MVP inputs

These are the only inputs MVP should depend on.

- Local datetime for the user
- Calories consumed today
- Protein consumed today
- Carbs consumed today
- Fat consumed today
- Fiber consumed today, if available
- Calorie target
- Protein target
- Carbs target
- Fat target
- Meals logged today
- Whether dinner has been logged
- Whether the user has already trained today
- Whether the user still has a planned workout today
- Pantry items, if any
- Saved meals, if any
- Recipe suggestions, if any
- Grocery gap items, if any

### Optional MVP inputs

Use these only when available. Do not block the feature on them.

- Goal type: fat loss, maintenance, gain
- Sodium
- Typical meal timing
- Convenience vs cooking preference
- Disliked foods

### Phase 2 inputs

Do not build MVP around these.

- Recurring under-eating patterns
- Weekend drift
- Rescue mode vs prevention mode preference
- Acceptance history
- AI confidence from previous food scans

## Derived Variables

The backend should compute these values before any AI phrasing step.

- `current_time_local`
- `minutes_left_in_day`
- `meal_count_today`
- `has_logged_dinner`
- `remaining_calories = calorie_target - calories_consumed`
- `remaining_protein = protein_target - protein_consumed`
- `remaining_carbs = carb_target - carbs_consumed`
- `remaining_fat = fat_target - fat_consumed`
- `fiber_low = fiber_consumed < 18`
- `is_late_day = local_time >= 17:00`
- `is_very_late = local_time >= 20:30`
- `is_day_mostly_done = local_time >= 19:30`
- `protein_gap_high = remaining_protein >= 35`
- `protein_gap_medium = remaining_protein >= 20`
- `under_eating_late = is_late_day && calories_consumed <= 0.65 * calorie_target`
- `over_target = remaining_calories < 0`
- `over_target_moderate = remaining_calories <= -250`
- `over_target_high = remaining_calories <= -400`
- `few_meals_logged = meal_count_today <= 1`
- `low_confidence_intake = few_meals_logged && is_late_day`
- `can_still_fix_today = !is_very_late && remaining_calories >= 250`
- `has_pantry_support = pantry_count > 0`
- `has_saved_meal_support = saved_meal_count > 0`
- `has_recipe_support = recipe_count > 0`

These thresholds can be tuned later, but they must exist in code and tests.

## Gap Types

The system may return one of these values only:

- `protein_gap`
- `calorie_gap_under`
- `calorie_gap_over`
- `meal_structure_gap`
- `fiber_satiety_gap`
- `pantry_gap`
- `tomorrow_gap`
- `on_track`
- `low_confidence`

## Priority Model

The system ranks gaps in this order.

### Tier 1: adherence-critical

- `low_confidence`
- `calorie_gap_over`
- `calorie_gap_under`
- `protein_gap`

### Tier 2: quality / satiety

- `meal_structure_gap`
- `fiber_satiety_gap`

### Tier 3: setup / tomorrow protection

- `pantry_gap`
- `tomorrow_gap`

### Tier 4: no urgent issue

- `on_track`

## Decision Rules

Apply these top to bottom. First matching rule wins.

### Rule 1: low-confidence intake

If:

- `low_confidence_intake = true`

Return:

- `gap_type = low_confidence`
- `mode = clarify_or_rough_fix`

### Rule 2: over-calorie stabilize tonight

If:

- `over_target_high = true`
- `is_late_day = true`

Return:

- `gap_type = calorie_gap_over`
- `mode = stabilize_tonight`

### Rule 3: protein-first rescue

If:

- `protein_gap_high = true`
- `can_still_fix_today = true`
- `remaining_calories >= 300`

Return:

- `gap_type = protein_gap`
- `mode = fix_today_protein`

### Rule 4: under-eating late

If:

- `under_eating_late = true`

Return:

- `gap_type = calorie_gap_under`
- `mode = finish_with_real_meal`

### Rule 5: fiber / satiety risk

If:

- `fiber_low = true`
- `is_late_day = true`
- `remaining_calories > 150`
- not already matched by Rules 1 to 4

Return:

- `gap_type = fiber_satiety_gap`
- `mode = increase_volume_and_satiety`

### Rule 6: pantry support missing

If:

- primary chosen action would require food
- `has_pantry_support = false`
- not already matched by Rules 1 to 5

Return:

- `gap_type = pantry_gap`
- `mode = close_food_access_gap`

### Rule 7: day mostly done

If:

- `is_day_mostly_done = true`
- `can_still_fix_today = false`
- not already matched by Rules 1 to 6

Return:

- `gap_type = tomorrow_gap`
- `mode = prepare_tomorrow`

### Rule 8: on track

If none of the above match:

- `gap_type = on_track`
- `mode = finish_clean`

## Mode Definitions

Modes are internal behavior presets.

- `clarify_or_rough_fix`
- `stabilize_tonight`
- `fix_today_protein`
- `finish_with_real_meal`
- `increase_volume_and_satiety`
- `close_food_access_gap`
- `prepare_tomorrow`
- `finish_clean`

## Output Contract

This is the canonical payload returned by gap detection.

```json
{
  "gap_type": "protein_gap",
  "mode": "fix_today_protein",
  "priority": "high",
  "confidence": "high",
  "diagnosis_data": {
    "remaining_calories": 650,
    "remaining_protein": 48,
    "meal_count_today": 2,
    "is_late_day": true,
    "has_logged_dinner": false
  },
  "copy": {
    "headline": "Your biggest nutrition gap",
    "diagnosis": "You're still 48g short on protein with enough calories left to fix it tonight.",
    "recommendation": "Eat one protein-centered dinner, then finish with a simple protein snack."
  },
  "actions": [
    {
      "type": "show_meal_options",
      "label": "Show 3 meal options",
      "payload": {
        "goal": "protein_focus",
        "max_results": 3
      }
    },
    {
      "type": "show_pantry_options",
      "label": "Use foods I have",
      "payload": {
        "goal": "protein_focus",
        "max_results": 3
      }
    },
    {
      "type": "build_tonight_plan",
      "label": "Build tonight's plan",
      "payload": {
        "mode": "protein_focus"
      }
    }
  ],
  "secondary_note": "Fiber is also low, so include fruit or vegetables with dinner."
}
```

## Action Contract

Only these action types are allowed in MVP.

### `show_meal_options`

Purpose:

- Show 3 practical next-meal suggestions

Behavior:

- Opens Nutrition
- Uses current targets, remaining calories, remaining protein, local time, and preferences
- Returns exactly 3 options

Payload:

```json
{
  "goal": "protein_focus|light_dinner|volume_meal|tomorrow_prep",
  "max_results": 3
}
```

### `show_pantry_options`

Purpose:

- Show next-meal options based on pantry items only

Behavior:

- Opens Pantry-aware nutrition suggestions
- Returns 2 to 3 options

Payload:

```json
{
  "goal": "protein_focus|light_dinner|volume_meal",
  "max_results": 3
}
```

### `build_tonight_plan`

Purpose:

- Convert the recommendation into a simple evening plan

Behavior:

- Builds a mini-plan with dinner, optional snack, and optional cutoff note
- Opens Nutrition with a generated plan view

Payload:

```json
{
  "mode": "protein_focus|stabilize_tonight|finish_real_meal|volume_and_satiety"
}
```

### `build_tomorrow_plan`

Purpose:

- Lock in tomorrow breakfast and lunch when today is mostly done

Behavior:

- Opens Nutrition
- Creates 1 to 2 meal suggestions or drafts

Payload:

```json
{
  "meals": ["breakfast", "lunch"]
}
```

### `build_grocery_list`

Purpose:

- Generate a minimal grocery list to support tonight or tomorrow

Behavior:

- Opens grocery gap
- Adds or suggests essentials only

Payload:

```json
{
  "scope": "tonight|tomorrow",
  "goal": "protein_focus|recovery|basic_coverage"
}
```

### `stabilize_evening`

Purpose:

- Support over-target evenings without shame language

Behavior:

- Opens Nutrition
- Shows a lightweight dinner direction and tomorrow reset option

Payload:

```json
{
  "mode": "damage_control"
}
```

## UX Rules

### Card anatomy

- Headline: fixed label or short gap title
- Diagnosis: one sentence
- Recommendation: one sentence
- Actions: up to 3 buttons
- Secondary note: optional, one line max

### Word-count guidance

- Diagnosis: max 22 words
- Recommendation: max 18 words
- Secondary note: max 16 words

### Tone rules

- Direct
- Supportive
- Non-shaming
- No clinical nutrition jargon unless necessary
- No “you failed” framing
- No fake precision when the day is mostly gone

### Good phrasing

- “You’re still light on protein, but this is fixable.”
- “Tonight is about stabilizing, not making it perfect.”
- “The smarter move now is setting up tomorrow.”

### Bad phrasing

- “Fiber intake is below recommendation.”
- “You exceeded calories.”
- “You have 43.2g protein remaining.”

## Confidence Handling

### High confidence

Use normal recommendation behavior.

### Medium confidence

Return a recommendation, but soften certainty.

Example:

- “Based on what’s logged, the next best move is probably...”

### Low confidence

Do not force fake precision.

Allowed behaviors:

- ask for one clarifying input
- offer rough-mode guidance
- encourage fast logging of the missing meal

Low-confidence action set should be limited to:

- `log_missing_meal`
- `estimate_recent_food`
- `show_meal_options`

If those actions do not already exist, MVP should instead return:

- one recommendation
- one fallback action into Nutrition

## AI Role

AI should not decide the gap type in MVP.

AI may be used to generate:

- diagnosis copy
- recommendation copy
- secondary note copy

AI input should include:

- chosen gap type
- mode
- structured numeric state
- tone rules
- word-count limits

AI output should be plain text fields only.

## API Shape

Recommended backend response for the dashboard card:

```json
{
  "nutrition_gap_card": {
    "gap_type": "protein_gap",
    "mode": "fix_today_protein",
    "priority": "high",
    "confidence": "high",
    "headline": "Your biggest nutrition gap",
    "diagnosis": "You're still 48g short on protein with enough calories left to fix it tonight.",
    "recommendation": "Eat one protein-centered dinner, then finish with a simple protein snack.",
    "secondary_note": "Fiber is also low, so include fruit or vegetables with dinner.",
    "actions": [
      {
        "type": "show_meal_options",
        "label": "Show 3 meal options",
        "payload": {
          "goal": "protein_focus",
          "max_results": 3
        }
      },
      {
        "type": "show_pantry_options",
        "label": "Use foods I have",
        "payload": {
          "goal": "protein_focus",
          "max_results": 3
        }
      },
      {
        "type": "build_tonight_plan",
        "label": "Build tonight's plan",
        "payload": {
          "mode": "protein_focus"
        }
      }
    ]
  }
}
```

## Acceptance Criteria

### AC1: one primary gap only

The card must always show exactly one primary gap type.

### AC2: deterministic routing

Given the same inputs, the feature must return the same `gap_type`, `mode`, and actions.

### AC3: max 3 actions

The card must never render more than 3 actions.

### AC4: no dead-end CTA

Every action must route to an implemented app flow.

### AC5: over-target handling

When the user is materially over target late in the day, the copy must switch to stabilization language and must not suggest “making up” the day with extreme restriction.

### AC6: low-confidence handling

When confidence is low, the copy must explicitly reflect uncertainty and avoid exact macro-style prescriptions.

### AC7: on-track handling

When the day is on track, the card must not invent a problem just to produce urgency.

## Test Fixtures

These fixtures should be implemented in unit tests or snapshot tests.

### Fixture 1: clear protein gap

Input:

- time: 18:30
- calories: 1350 / 2000
- protein: 92 / 140
- carbs: 130 / 220
- fat: 42 / 70
- meals logged: 2
- dinner logged: false

Expected:

- `gap_type = protein_gap`
- `mode = fix_today_protein`
- action 1 = `show_meal_options`
- action 2 = `show_pantry_options`
- no clarification copy

### Fixture 2: late under-eating

Input:

- time: 18:30
- calories: 1100 / 2000
- protein: 70 / 150
- meals logged: 1
- dinner logged: false

Expected:

- `gap_type = calorie_gap_under`
- `mode = finish_with_real_meal`

### Fixture 3: over-target evening

Input:

- time: 19:15
- calories: 2350 / 1900
- protein: 118 / 140
- meals logged: 4

Expected:

- `gap_type = calorie_gap_over`
- `mode = stabilize_tonight`
- at least one action = `stabilize_evening` or `build_tomorrow_plan`
- copy uses non-shaming stabilization language

### Fixture 4: low-confidence day

Input:

- time: 18:45
- calories: 420 / 2100
- meals logged: 1
- dinner logged: false
- meal log confidence: low or unknown

Expected:

- `gap_type = low_confidence`
- `mode = clarify_or_rough_fix`
- copy acknowledges incomplete logging

### Fixture 5: day mostly done

Input:

- time: 21:00
- calories: 1750 / 2000
- protein: 92 / 150
- meals logged: 3

Expected:

- `gap_type = tomorrow_gap`
- `mode = prepare_tomorrow`
- primary action = `build_tomorrow_plan`

### Fixture 6: on track

Input:

- time: 17:45
- calories: 1550 / 2000
- protein: 128 / 140
- meals logged: 3

Expected:

- `gap_type = on_track`
- `mode = finish_clean`
- brief affirmation
- no invented urgency

## Analytics

Track these events:

- `nutrition_gap_card_seen`
- `nutrition_gap_action_clicked`
- `nutrition_gap_action_completed`
- `nutrition_gap_type_returned`
- `nutrition_gap_confidence_returned`

Recommended dimensions:

- `gap_type`
- `mode`
- `confidence`
- `time_bucket`
- `goal_type`
- `action_type`

## Implementation Order

1. Build deterministic gap detection service.
2. Define and ship the card payload shape.
3. Connect the dashboard card UI.
4. Map each action to a real app flow.
5. Add AI copy generation on top of the deterministic result.
6. Add confidence handling refinements.
7. Add phase-two pattern logic later.

## Notes

This spec intentionally favors reliability over cleverness.

If the system is going to be wrong sometimes, it should be wrong in predictable and understandable ways, not in surprising AI-generated ways.
