# IronQuest Character Sheet

## Purpose

The Character Sheet is the permanent home for the player identity inside IronQuest.

It should make the mode feel like a real campaign without forcing the workout screen to hold every system.

## Product Rule

The Character Sheet should explain the player at a glance.

It must not become a stat wall.

## Core Thesis

If IronQuest has missions, HP, gold, Tavern Day, route progress, titles, relics, and store purchases, the player needs one place that says:

- who they are
- where they are
- what is affecting them
- what they own
- what is next

That place is the Character Sheet.

## Primary Jobs

The Character Sheet should do five things:

1. show persistent identity
2. summarize progression
3. display inventory and active modifiers
4. show current campaign context
5. provide links to store, tavern, and mission board

## V1 Layout

### 1. Hero Summary

Show:

- starter portrait
- displayed title
- class
- motivation
- level
- XP progress
- HP
- gold

### 2. Campaign Status

Show:

- current region
- current mission or selected mission
- route progress
- most recent unlock
- current Tavern or store availability

### 3. Active Effects

Show currently active bonuses and temporary modifiers.

Examples:

- rumor lead active
- store charm active for next mission
- relic passive affecting travel

### 4. Inventory Summary

Show:

- relic count
- consumable count
- equipped title
- active relics or passives

### 5. History Snapshot

Show a short recent log, not a full journal.

Recommended items:

- last mission cleared
- last region unlocked
- last boss reward
- recent title earned

## Entry Points

The Character Sheet should be reachable from:

1. IronQuest hub
2. General Store
3. Tavern Day result state
4. post-mission reward flows

## Why It Matters

Without a Character Sheet, every new system has to find space on the hub or the workout screen.

That creates clutter.

The Character Sheet solves that by absorbing persistent progression and inventory detail.

## Data Model

The sheet should be renderable from an expanded profile payload.

### Suggested Payload Shape

```json
{
  "character_sheet": {
    "identity": {
      "portrait_attachment_id": 88,
      "display_title": "Last One Standing",
      "class_slug": "mage",
      "motivation_slug": "discipline"
    },
    "progression": {
      "level": 7,
      "xp": 920,
      "xp_to_next": 180,
      "hp_current": 82,
      "hp_max": 100,
      "gold": 54
    },
    "campaign": {
      "current_location_slug": "the_training_grounds",
      "current_location_name": "The Training Grounds",
      "selected_mission_slug": "captain_of_the_yard",
      "selected_mission_name": "Captain of the Yard",
      "route_progress_label": "2 route points to the next region"
    },
    "active_effects": [
      {
        "id": "rumor_bonus",
        "label": "Rumor lead",
        "effect_summary": "Mission preview improved for the next run"
      }
    ],
    "inventory_summary": {
      "active_relics": 2,
      "relic_count": 4,
      "consumable_count": 2,
      "equipped_title": "Last One Standing"
    },
    "recent_history": [
      {
        "id": "unlock_441",
        "label": "Unlocked The First Rest",
        "subtitle": "Region tavern opened",
        "created_at": "2026-04-29 14:30:00"
      }
    ]
  }
}
```

## UI Tone

The Character Sheet should feel like a calm summary screen.

It should not feel like a spreadsheet.

Recommended tone:

- portrait-led
- strong labels
- short helper copy
- small number of actions

## Recommended Actions

Keep the action area small.

Recommended buttons:

- `Mission Board`
- `Enter Tavern`
- `General Store`
- `View Inventory`

## Johnny Layer

Johnny should have one short contextual line at the top of the sheet.

Examples:

- low HP: point toward recovery or store support
- high gold: point toward smart spending
- no active mission: point toward the board
- recent boss clear: point toward the new reward

## Guardrails

Do not add in Phase 2:

- deep attribute trees
- strength, dexterity, intelligence stat pages
- skill trees
- talent branches
- multiple sub-pages before the first useful information appears

## Relationship To Other Systems

### Inventory

Inventory detail lives here.

The sheet is the place where owned items become understandable.

### General Store

The store should link back to the sheet after purchase so players can see the impact.

### Tavern Day

Tavern actions that grant buffs or rumors should surface in active effects and recent history.

## Phase 2 Success Criteria

The Character Sheet is successful if:

- the player can understand their current state in one glance
- IronQuest progression has a clear permanent home
- inventory and store systems have somewhere natural to connect
- the hub becomes less cluttered because long-term detail moved here