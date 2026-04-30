# IronQuest Live Mission HUD

## Purpose

The live mission HUD is the smallest possible state layer that makes an IronQuest workout feel readable in motion.

The story already creates pressure and momentum.

The HUD makes that pressure visible without turning live coach mode into a dense RPG dashboard.

## Phase 2 Product Rule

The HUD must support the workout.

It must not compete with:

- set logging
- next-set flow
- rest timer
- Johnny story beats

If the HUD requires extra taps or too much reading during rest, it has failed.

## User Questions The HUD Must Answer

At a glance, the user should know:

1. How far through the mission am I?
2. How dangerous is this moment?
3. How much HP do I have left?
4. What phase is this encounter in?
5. Did the last set help or hurt?

## Recommended HUD Fields

The HUD should render from existing mission progress state and should avoid a separate combat engine.

### Core Fields

- Mission name
- Encounter phase
- Tension
- Mission progress percent
- HP current
- HP max
- HP loss this set

### Optional Fields

- Class slug or class icon
- Momentum direction
- Encounter label

### Example Payload

```json
{
  "mission_name": "Shadows in the Streets",
  "encounter_phase": "clash",
  "tension": "high",
  "progress": {
    "percent": 54,
    "label": "Encounter line broken"
  },
  "hp_current": 82,
  "hp_max": 100,
  "hp_loss_this_set": 1,
  "class_slug": "mage"
}
```

## Visual Structure

### Desktop / Tablet

Use a compact horizontal strip or two-row card above the story panel.

Recommended blocks:

- Mission progress
- HP
- Pressure
- Phase

### Mobile

Use a sticky compact strip with short labels and big values.

Recommended mobile labels:

- Progress
- HP
- Pressure
- Phase

Do not show more than four stat blocks at once on smaller widths.

## Behavior Rules

- Update after every saved set
- Animate only changed values
- Keep the HUD visible during story updates
- Never interrupt set save or next-set actions
- Avoid modal behavior entirely

### Animation Rules

- Progress percent: short fill or count-up animation
- HP drop: brief red flash or shake on the HP value only
- Tension shift: tone or chip color change
- Encounter phase change: text swap, no large transition

## State Mapping

Use the existing mission pipeline as the source of truth.

### Backend Source

Prefer current or near-current values from `story_state`:

- `mission_name`
- `encounter_phase`
- `tension`
- `progress.percent`
- `progress.label`
- `hp_current`
- `hp_max`
- `hp_loss_this_set`

### Frontend Source

The live workout screen should derive HUD view state from the same progress payload already used to refresh the IronQuest overlay after set saves.

Do not build a second client-only HUD state machine if the data already exists in `story_state`.

## Frontend Checklist

### LiveWorkoutMode

- Add a dedicated IronQuest HUD region above or near the story card
- Render only when IronQuest live mode is active
- Read HUD values from the latest `story_state`
- Gracefully hide missing optional fields
- Keep values readable on dark mode and quest surfaces

### Component Shape

Recommended component split:

- `IronQuestMissionHud`
- `IronQuestMissionHudStat`
- optional `IronQuestMissionHudDelta`

### Interaction Rules

- No buttons required in v1
- No tap-to-expand requirement
- No navigation actions in the HUD itself

## Backend Checklist

### Story Progress Response

- Ensure `progress_story` returns all required HUD fields in `story_state`
- Keep HP and progress values normalized server-side
- Keep `hp_loss_this_set` explicit for the most recent event

### Mission Intro / Active Run Responses

- Ensure the active mission payload exposes enough initial HUD state before the first saved set
- Include `hp_current` and `hp_max` at mission start
- Include current `progress.percent` and `encounter_phase`

### Data Ownership

- Backend owns calculation
- Frontend owns rendering and subtle animation only

## Suggested Status Mapping

### Tension

- `controlled` = low pressure
- `rising` = manageable pressure
- `high` = meaningful risk
- `critical` = immediate danger

### Encounter Phase

- `intro` = opening setup
- `clash` = active engagement
- `turning_point` = major mid-fight shift
- `resolution` = closing beat

## Non-Goals For Phase 2

Do not add these to the live HUD yet:

- gold
- XP
- inventory access
- store prompts
- subclass trees
- spell management
- multiple currencies
- deep modifier breakdowns

Those features pull focus away from the workout.

## Acceptance Criteria

The feature is complete when:

1. A user in IronQuest live mode can see mission progress, HP, tension, and encounter phase at a glance.
2. HUD values update after a saved set without extra taps.
3. HP changes and tension changes are visually clear but not disruptive.
4. The HUD stays readable on mobile and dark quest surfaces.
5. The workout logging flow remains primary.

## Recommended Implementation Order

1. Normalize required HUD fields in active mission and story progress payloads.
2. Add a small HUD component to live workout mode.
3. Style it for mobile-first readability.
4. Add change-only animations for HP and progress.
5. Add focused tests for rendering and state updates.