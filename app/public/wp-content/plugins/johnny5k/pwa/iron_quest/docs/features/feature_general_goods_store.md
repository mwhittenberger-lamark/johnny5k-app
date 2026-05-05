# IronQuest General Store

## Purpose

The General Store is where gold turns into preparation.

Tavern Day handles low-pressure story and recovery choices.

The store handles practical next-mission decisions.

## Product Rule

The store must make gold matter without making the player feel blocked from basic play.

## Core Thesis

The General Store should let the player answer one simple question:

What should I buy before the next push?

The answer should be understandable in seconds.

In the shipped Phase 2 product, the store also needs to answer:

- what is already active right now
- where that effect applies
- when it expires

## V1 Structure

Keep the store limited to four sections:

1. Recovery goods
2. Mission prep
3. Utility charms
4. Inventory sellback

Do not ship a large gear catalog in Phase 2.

## Why This Scope

Gold already exists.

The store should quickly give that currency meaning.

If the first version becomes a full gear economy, it will add grind pressure and bury the useful decisions.

## Core Item Types

### 1. Recovery Goods

Purpose:

- help the player recover or stabilize without replacing healthy habits

Examples:

- `Field Bandage`: restore a small amount of HP
- `Hot Meal Kit`: small recovery plus next-day readiness flavor

Rules:

- low carry cap
- immediate use or next-mission use only

### 2. Mission Prep

Purpose:

- improve the next mission slightly

Examples:

- `Scouting Map`: better mission preview
- `Packed Rations`: reduce next mission HP loss slightly
- `Travel Papers`: reduce fast-travel cost or add route efficiency

Rules:

- must expire after the next relevant mission or day
- no long chains of stored prep items

### 3. Utility Charms

Purpose:

- create one small strategic choice with gold

Examples:

- `Coin Charm`: small next-mission gold bias
- `Focus Charm`: small next-mission XP bias
- `Ward Thread`: slight protection against HP loss

Rules:

- only one active charm at a time in Phase 2
- effect must be visible on the Character Sheet under active effects

### 4. Inventory Sellback

Purpose:

- convert unused items into meaningful decisions

Rules:

- no accidental sell of active or equipped title / relic states
- always show value and confirmation

## Location Identity

Each region store should feel slightly different without requiring a giant catalog.

### Example Pattern

- one reliable recovery item
- one region-flavored utility item
- one mission-prep item
- one rotating premium item later, optional

This keeps store identity local without excessive complexity.

Current Phase 2 presentation should reinforce that identity with:

- region-specific merchant name
- shared store-owner portrait art
- region-aware recommendation copy

## Pricing Philosophy

Gold should feel:

- earnable in one to two sessions
- worth spending without anxiety
- valuable enough to create a real choice

### Target Feel

- basic recovery item: about one session of gold
- stronger prep item: about two sessions of gold
- premium region item: saved purchase, not grind wall

## Johnny5k Layer

The store should always show one smart recommendation.

Examples:

- low HP: suggest recovery item
- boss ahead: suggest prep item
- high route pressure: suggest travel utility
- high gold: suggest premium region item

Johnny should guide, not force.

## UX Model

### Top Summary

Show:

- gold
- HP
- current region store name
- one recommended purchase line
- merchant portrait or placeholder
- active consequence summary

### Store Sections

Show:

- recovery goods
- mission prep
- utility charms
- sellback

### Purchase Flow

Tap item, then show:

- effect summary
- cost
- expiry rule
- confirm purchase

In the current UI, the critical requirement is still visible expiry and consequence clarity even if the confirm interaction stays lightweight.

### After Purchase

After buying an item, link naturally to:

- Character Sheet
- Mission Board

Current shipped behavior should bias toward the Character Sheet so the player can immediately see:

- the item became active or entered inventory
- whether it changes the next mission
- whether it persists or is one-use

## Data Model

Store rendering should come from a location-aware payload.

### Suggested Payload Shape

```json
{
  "store": {
    "location_slug": "the_training_grounds",
    "location_name": "The Training Grounds",
    "store_name": "Quartermaster Halden",
    "gold": 54,
    "hp_current": 82,
    "hp_max": 100,
    "recommended_purchase": {
      "item_id": "field_bandage",
      "label": "You are running light on HP. Patch up before the next push."
    },
    "merchant": {
      "name": "Quartermaster Halden",
      "description": "A practical merchant who sells preparation, not fantasy.",
      "art": {
        "art_key": "store_owner_the_training_grounds",
        "status": "ready"
      }
    },
    "inventory": {
      "active_charm": {
        "id": "coin_charm",
        "name": "Coin Charm",
        "effect_summary": "Small bonus gold on the next mission"
      },
      "active_prep": null
    },
    "mission_modifiers": {
      "summary": "Coin Charm is queued for the next mission.",
      "entries": [
        {
          "id": "store_charm_coin_charm",
          "label": "Coin Charm",
          "effect_summary": "Small bonus gold on the next mission",
          "applies_to_label": "Next mission payout",
          "consumes_on_label": "Stays active until replaced"
        }
      ]
    },
    "sections": {
      "recovery_goods": [
        {
          "id": "field_bandage",
          "name": "Field Bandage",
          "description": "A quick patch before the next mission.",
          "effect_summary": "Restore 15 HP",
          "cost_gold": 20,
          "available": true
        }
      ],
      "mission_prep": [
        {
          "id": "scouting_map",
          "name": "Scouting Map",
          "description": "Marks the cleaner path into trouble.",
          "effect_summary": "Improves the next mission preview",
          "cost_gold": 25,
          "available": true
        }
      ],
      "utility_charms": [
        {
          "id": "coin_charm",
          "name": "Coin Charm",
          "description": "Luck favors the prepared and the paid.",
          "effect_summary": "Small bonus gold on the next mission",
          "cost_gold": 25,
          "available": true
        }
      ]
    }
  }
}
```

## Relationship To Inventory

Purchased items should enter inventory immediately.

## Guardrails

Do not drift this feature toward:

- a weapon or armor storefront
- rarity ladders and filler loot
- complex compare screens
- a second economy loop that competes with training

The store is successful when it makes gold feel useful and readable, not when it becomes a gear meta.

Temporary purchases should also appear under active effects when relevant.

## Relationship To Character Sheet

The Character Sheet should be the easiest place to confirm what the purchase changed.

## Relationship To Tavern Day

Tavern Day is a once-per-day mood and recovery choice.

The General Store is a spending decision.

They should feel adjacent, not interchangeable.

## Guardrails

Do not add in Phase 2:

- mandatory supplies that block normal missions
- large gear trees
- random daily monetization-style offers
- more than one premium rotating item at a time
- grind-to-play economy pressure

## Phase 2 Success Criteria

The store is successful if:

- gold has a clear use
- purchases affect the next mission or route choice visibly
- the store feels region-specific
- players can make a decision fast without feeling trapped in an economy screen
