# IronQuest Inventory System

## Purpose

Inventory should make the player feel like they own a growing build.

It should not turn Johnny5k into a bag-management RPG.

## Product Rule

Inventory exists to support training, recovery, and route decisions.

It must stay readable in under one minute.

## Core Thesis

Inventory is the ownership layer between the Character Sheet and the General Store.

It answers three questions:

1. What do I own?
2. What is active right now?
3. What can I use before the next mission?

## V1 Structure

Keep inventory limited to four categories:

1. Relics
2. Consumables
3. Titles
4. Active modifiers

Do not ship a full weapon / armor / accessory equipment grid in Phase 2.

## Why This Scope

IronQuest already has class, HP, gold, route progress, missions, and Tavern Day.

Inventory should deepen those loops, not replace them.

If Phase 2 adds too many item slots, the mode starts competing with the actual fitness product.

## Item Categories

### 1. Relics

Relics are persistent account-bound unlocks.

Rules:

- passive effect only
- small impact
- no duplicates active at the same time
- tied to bosses, regions, or major rewards

Example effects:

- `Road Builder`: small travel point bonus
- `Steady Hand`: slightly reduced HP loss on average sessions
- `Field Notes`: better mission preview clarity

### 2. Consumables

Consumables are one-use items that affect the next mission or the current recovery day.

Rules:

- max carry should stay low, recommended cap `3`
- effect should be immediate or next-session only
- no crafting tree
- no stacking multiple identical buffs in one session

Example effects:

- restore HP
- reduce next mission damage
- improve next mission gold or XP payout slightly
- reveal a stronger mission hint

### 3. Titles

Titles are progression markers with optional minor passive effects.

Rules:

- unlock from arcs, streaks, or bosses
- should display on the Character Sheet
- may provide one small passive bonus, but identity comes first

### 4. Active Modifiers

This is not a true item type.

It is a visible summary of what is currently affecting the player.

Examples:

- Tavern rumor buff active
- store charm active for next mission
- relic passive modifying route gain

## UX Model

Inventory should not be its own complex app section first.

In Phase 2 it should live inside the Character Sheet as a clear owned-items area.

### Primary Layout

Top summary:

- gold
- HP
- active modifiers
- item counts

Sections:

- Relics
- Consumables
- Titles
- Active effects

## Interaction Rules

### Relics

Tap to inspect.

If a relic has an on/off slot rule later, only allow a very small number of active relics.

Recommended Phase 2 cap:

- `2 active relics`

### Consumables

Tap to inspect and use.

Usage should require one confirm step with the exact effect shown.

### Titles

Tap to inspect flavor text and unlock source.

Equipping a displayed title is optional and cosmetic.

## Design Principles

Every item should be:

- easy to understand
- small in impact
- tied to a real game loop
- worth showing on the Character Sheet

Avoid items that only add noise, rarity clutter, or stat math.

## Source Of Items

Phase 2 item sources should be limited to:

1. boss clears
2. region unlocks
3. store purchases
4. Tavern Day rewards
5. weekly or arc summaries

## Data Model

Inventory should be renderable from one profile-adjacent payload.

### Suggested Payload Shape

```json
{
  "inventory": {
    "relics": [
      {
        "id": "road_builder",
        "name": "Road Builder",
        "description": "You know how to take the longest road without wasting motion.",
        "effect_summary": "+10% travel points from steps",
        "active": true,
        "source": "region_clear"
      }
    ],
    "consumables": [
      {
        "id": "field_bandage",
        "name": "Field Bandage",
        "description": "Patch up before the next push.",
        "effect_summary": "Restore 15 HP",
        "quantity": 1,
        "usable": true
      }
    ],
    "titles": [
      {
        "id": "last_one_standing",
        "name": "Last One Standing",
        "description": "Earned by finishing a mission under pressure.",
        "equipped": true,
        "effect_summary": "+small gold bonus on low-HP clears"
      }
    ],
    "active_modifiers": [
      {
        "id": "rumor_bonus",
        "label": "Rumor lead",
        "effect_summary": "Mission preview improved for the next run"
      }
    ]
  }
}
```

## Persistence Rules

Recommended Phase 2 persistence:

- inventory collection stored on the IronQuest profile layer
- consumable quantities updated on use and purchase
- relic unlocks stored permanently
- active modifiers stored with an explicit expiry rule

## Guardrails

Do not add in Phase 2:

- full equipment slot grids
- crafting
- random loot rarity ladders
- junk items for selling only
- inventory capacity management
- compare-every-stat UI

## Character Sheet Relationship

Character Sheet is where inventory is viewed.

Inventory is not the main screen.

The Character Sheet should summarize ownership, while inventory handles detail and action.

## General Store Relationship

The store is where players make spending decisions.

Inventory is where those purchased or earned items live afterward.

### Intended Loop

1. complete mission or Tavern Day
2. gain gold or unlock
3. visit store or earn reward
4. item enters inventory
5. item appears on Character Sheet and can affect the next mission

## Phase 2 Success Criteria

Inventory is successful if:

- players can understand what they own immediately
- items change the next mission or route choice in a visible way
- the system feels like progression, not housekeeping
- the Character Sheet becomes more meaningful because inventory exists
