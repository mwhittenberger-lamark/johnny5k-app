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

1. Enter the tavern for their current location
2. Make one meaningful recovery or progression choice
3. Optionally complete one healthy behavior
4. Leave with a small reward, buff, or mission hint

The entire loop should take under one minute.

## Source Content

Tavern flavor should come from the current location documents.

Source fields already exist in the location docs:

- tavern name
- tavern tone
- tavern flavor text
- tavern-themed actions

The baseline Tavern Day action set already exists in the rules:

- Rest
- Side job
- Rumors
- Supplies purchase

## When Tavern Day Appears

### Primary Trigger

Show Tavern Day when today is a scheduled rest day.

### Secondary Triggers

It may also appear when:

- the user explicitly opens the Tavern from the IronQuest hub
- the user completed a mission yesterday and has no mission-ready training today
- recovery/readiness logic suggests a lighter day and the plan is already rest-focused

## Entry Points

### Dashboard

Recommended card:

- title: current tavern name
- short flavor line
- one primary CTA: `Enter tavern`

### Workout Screen

If the day type is `rest`, swap the mission-start framing for tavern-start framing.

### IronQuest Hub

Keep Tavern as a stable destination in the hub so users can revisit it even if they bypass the dashboard card.

## User Flow

### Happy Path

1. User opens Tavern Day
2. App shows location-specific tavern art/copy
3. User sees 3 to 4 available actions
4. User chooses one action
5. App applies immediate result or grants a pending bonus
6. Johnny gives one short tavern-style follow-up line
7. User optionally deep-links to nutrition, body, or tomorrow\'s workout setup

## Core Tavern Actions

### 1. Rest

Purpose:

- direct recovery

Base effect:

- recover HP

Recommended Phase 2 effect:

- `+8 HP`, capped by `hp_max`

### 2. Side Job

Purpose:

- keep progression moving on a non-training day

Base effect:

- grant gold

Recommended Phase 2 effect:

- `+10 gold`

### 3. Rumors

Purpose:

- give flavor and future pull

Base effect:

- grant XP and preview or reveal a mission

Recommended Phase 2 effect:

- `+10 XP`
- mission preview or world hint

### 4. Supplies

Purpose:

- light setup for the next mission

Base effect:

- spend gold for a small next-mission edge

Recommended Phase 2 behavior:

- do not force full inventory complexity
- treat this as a simple preparation action or deferred buff

## Johnny5k-Aligned Rest-Day Actions

These actions tie Tavern Day back to the Johnny5k behavior loop.

### Hearty Meal

Trigger:

- user logs a protein-forward meal

Effect:

- small tavern bonus, XP, or recovery bump

### Early Room

Trigger:

- user logs sleep or hits bedtime target

Effect:

- readiness-flavored reward or recovery bonus

### Scout The Roads

Trigger:

- user hits a modest walk or cardio target on a rest day

Effect:

- travel preview, small XP, or rumor bonus

### Study The Board

Trigger:

- user asks Johnny what tomorrow should look like

Effect:

- route to dashboard/workout planning with tavern-flavored coaching

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
    "flavor_text": "Everyone here is still becoming who they are."
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
      "id": "rumors",
      "label": "Listen for rumors",
      "description": "Veterans talk quietly about darkness beyond the road.",
      "effect_summary": "+10 XP and mission preview",
      "disabled": false
    }
  ],
  "selected_action": null,
  "resolved_today": false,
  "johnny_line": "Use today to reset, not to drift."
}
```

## Persistence Model

Phase 2 should support one meaningful tavern action per day.

### Suggested Persisted Fields

- `user_id`
- `date`
- `location_slug`
- `action_id`
- `resolved_effects_json`
- `follow_up_state_json`

### Why

This keeps Tavern Day idempotent and prevents duplicate rewards from repeated refreshes.

## Endpoint Recommendation

### 1. Get Tavern State

`GET /fit/v1/ironquest/tavern`

Purpose:

- return current tavern payload for today

Response should include:

- location tavern flavor
- profile values needed for tavern display
- available actions
- whether an action has already been taken today
- current follow-up cues

### 2. Resolve Tavern Action

`POST /fit/v1/ironquest/tavern/action`

Request:

```json
{
  "date": "2026-04-29",
  "action_id": "rest"
}
```

Response:

```json
{
  "resolved": true,
  "action_id": "rest",
  "effects": {
    "hp_delta": 8,
    "gold_delta": 0,
    "xp_delta": 0,
    "mission_preview": null
  },
  "profile": {
    "hp_current": 90,
    "hp_max": 100,
    "gold": 54,
    "xp": 920
  },
  "johnny_line": "A quiet room and one good night will do more than another forced fight.",
  "follow_up": {
    "screen": "body",
    "focus_tab": "sleep",
    "label": "Log sleep"
  }
}
```

### Optional Later Endpoint

`POST /fit/v1/ironquest/tavern/follow-up`

Only add this if Tavern Day grows into multi-step social or prep flows.

It is not needed for the first pass.

## Reward Rules

### Hard Rules

- one core tavern action per day
- no duplicate reward farming on refresh
- recovery effects respect `hp_max`
- tavern rewards stay small compared with workout rewards

### Design Intent

- Tavern Day should feel worthwhile
- Tavern Day should not outpay training
- Tavern Day should strengthen tomorrow more than it dominates today

## UI Structure

### Top Section

- tavern name
- location name
- flavor text

### Middle Section

- current HP
- gold
- optional streak or recovery note

### Action Section

- 3 to 4 tavern actions
- one-line descriptions
- clear effect summaries

### Result Section

- resolved reward
- short Johnny line
- optional next-step deep link

## Johnny Voice Rules For Tavern Day

Johnny should sound like:

- a coach helping you reset
- a guide pointing to the smart next move
- a grounded companion in the world

Johnny should not sound like:

- a boss announcer
- a battle narrator during recovery
- a hype machine pretending a rest day is a war scene

## Integrations

### Body / Recovery

- sleep logging deep link
- recovery framing after low-HP mission days

### Nutrition

- meal-log deep link for tavern meal actions

### Workout

- tomorrow prep deep link
- mission preview for the next training day

### Dashboard

- main entry card for scheduled rest days

## Non-Goals For Phase 2

Do not add these yet:

- tavern minigames
- social multiplayer taverns
- full merchant simulation
- romance systems
- multi-room NPC networks
- subclass quest chains inside taverns

## Acceptance Criteria

The feature is complete when:

1. A rest-day user can enter a location-specific tavern in one tap.
2. The tavern offers one small meaningful choice for that day.
3. Rewards resolve once and persist safely.
4. Johnny provides a recovery-appropriate follow-up line.
5. The user can deep-link into sleep, meal logging, walking, or tomorrow planning from the result state.

## Recommended Implementation Order

1. Build a tavern state resolver from current location plus rest-day context.
2. Add a single daily tavern action resolver endpoint.
3. Start with `rest`, `side_job`, and `rumors` only.
4. Add dashboard and workout-screen entry points for rest days.
5. Add behavior-linked follow-up actions for sleep, meals, and light movement.