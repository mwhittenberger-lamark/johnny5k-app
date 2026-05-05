# IronQuest Tavern Day

## Purpose

Tavern Day is the rest-day counterpart to workout missions.

Workout days should feel like adventures.

Rest days should feel like recovery scenes inside the same world.

Tavern Day keeps IronQuest alive on non-lifting days without pushing the user into unnecessary training.

## Product Rule

Tavern Day must reward recovery, logging, and setup.

It must not punish the user for taking a real rest day.

## Core Thesis

On a rest day, the player should be able to:

1. enter the tavern for their current location
2. make one meaningful recovery or progression choice
3. see exactly what changed
4. leave in under one minute

## Current Phase 2 Action Set

The shipped Phase 2 tavern actions are:

- `rest`
- `side_job`
- `rumors`

Treat these as the canonical Tavern Day actions unless the rules doc is explicitly revised.

`Supplies purchase` can remain a future extension idea, but it is not the current live Tavern Day choice set.

## When Tavern Day Appears

### Primary Trigger

Show Tavern Day when today is a scheduled rest day.

### Secondary Triggers

It may also appear when:

- the user explicitly opens the Tavern from the IronQuest hub
- the user reaches Tavern from the Character Sheet
- the workout flow is already in rest-day mode and IronQuest is enabled

## Current Entry Points

### Workout Launchpad

This is the primary live entry point in the current product.

If the day type is `rest`, the workout-start framing becomes tavern-start framing.

### IronQuest Hub

The hub can deep-link into Tavern Day through `Enter Tavern`.

### Character Sheet

The Character Sheet can deep-link into Tavern Day when the current location has a tavern.

## User Flow

### Happy Path

1. user opens Tavern Day
2. app shows location-specific tavern copy and tavern scene art
3. user sees the available actions
4. user chooses one action
5. app resolves the action immediately
6. app shows a consequence summary:
   - what paid out now
   - what affects the mission board
   - what expires at daily reset
7. Johnny gives one short tavern-style follow-up line

## Core Tavern Actions

### 1. Rest

Purpose:

- direct recovery

Phase 2 effect:

- restore HP immediately

Current mental model:

- effect resolves now
- no hidden mission modifier remains afterward

### 2. Side Job

Purpose:

- keep progression moving on a non-training day

Phase 2 effect:

- grant gold immediately

Current mental model:

- effect resolves now
- no lingering buff to remember

### 3. Rumors

Purpose:

- give future pull without adding friction

Phase 2 effect:

- grant XP immediately
- surface a mission preview or board lead

Current mental model:

- XP resolves now
- the mission lead remains visible until daily reset

## Consequence Clarity

Tavern Day must make its rules explicit.

After a tavern action resolves, the user should be able to answer:

1. what did I already get?
2. what is still active?
3. when does it clear?

Examples:

- `Rest`: `+8 HP`, applies immediately, no lingering effect
- `Side job`: `+10 gold`, applies immediately, no lingering effect
- `Rumors`: `+10 XP`, mission board lead visible until daily reset

## World Art Relationship

Each region tavern can have shared world art.

The tavern screen should use:

- tavern name
- tavern flavor text
- tavern scene art

This makes recovery days feel like a place instead of a text block.

## Data Model

Tavern Day should be renderable from a single response payload.

### Suggested State Shape

```json
{
  "date": "2026-04-29",
  "location_slug": "the_training_grounds",
  "location_name": "The Training Grounds",
  "tavern": {
    "name": "The First Rest",
    "tone": "warm, practical, low-stakes optimism",
    "flavor_text": "Everyone here is still becoming who they are.",
    "art": {
      "art_key": "tavern_scene_the_training_grounds",
      "status": "ready"
    }
  },
  "profile": {
    "class_slug": "mage",
    "hp_current": 82,
    "hp_max": 100,
    "gold": 54,
    "xp": 920
  },
  "today_context": {
    "day_type": "rest",
    "meal_logged": false,
    "sleep_logged": true,
    "steps_today": 3100,
    "cardio_logged": false
  },
  "available_actions": [
    {
      "id": "rest",
      "label": "Take a room",
      "description": "Recover beside the practice fire.",
      "effect_summary": "+8 HP",
      "disabled": false
    },
    {
      "id": "side_job",
      "label": "Pick up a side job",
      "description": "Take the simple work that still pays.",
      "effect_summary": "+10 gold",
      "disabled": false
    },
    {
      "id": "rumors",
      "label": "Listen for rumors",
      "description": "Veterans talk quietly about darkness beyond the road.",
      "effect_summary": "+10 XP and mission preview",
      "disabled": false
    }
  ],
  "selected_action": {
    "action_id": "rumors",
    "effects": {
      "xp_delta": 10,
      "mission_preview": {
        "slug": "captain_of_the_yard",
        "name": "Captain of the Yard"
      }
    }
  },
  "resolved_today": true,
  "johnny_line": "Use today to reset, not to drift."
}
```

## Persistence Model

Phase 2 supports one meaningful tavern action per day.

Recommended persisted fields:

- `user_id`
- `date`
- `location_slug`
- `action_id`
- `resolved_effects_json`
- `follow_up_state_json`

## Guardrails

Do not let Tavern Day drift into:

- a second store
- a narrative-heavy visual novel
- a replacement for workout missions
- a place where the player has to remember hidden buff timing

The tavern is successful when it makes recovery days feel connected and readable.
