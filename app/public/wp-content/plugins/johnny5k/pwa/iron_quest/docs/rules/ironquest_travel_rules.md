# Johnny5k: IronQuest

## Travel System Rules (v1)

> Current implementation note: this document reflects the live v1 route logic in the app as of April 2026. If code and older lore docs disagree, this file wins for travel math.

---

# Overview

The Travel System connects real-world movement to in-game progression.

Players move between locations on the IronQuest map by earning **Travel
Points** through activity or spending **Gold**.

---

# Core Rule

**1 Travel Point = Movement to the next map node**

---

# Earning Travel Points

## Steps

- Travel points are awarded from step-equivalent movement chunks.
- 2,500 step-equivalent = 1 Travel Point

## Cardio

- Cardio is converted into step-equivalent movement, then rounded down using the same 2,500 step-equivalent rule.

## Notes

- Travel Points can be accumulated across multiple days
- Steps and cardio stack toward total progress
- The current hub shows travel earned from movement separately from travel purchased with gold

---

# Travel Requirements

Each location requires a set number of Travel Points to reach:

- Small distance: 3 Travel Points
- Medium distance: 5 Travel Points
- Large distance: 8 Travel Points

---

# Fast Travel (Gold System)

Players can spend gold to skip travel requirements.

## Rule

- 1 Travel Point = 10 Gold

## Constraint

- Players can only skip up to **50% of the required travel distance**
- Fast travel only applies after the route gate is cleared for that destination

### Example

- Destination requires 4 Travel Points
- Max fast travel = 2 Travel Points (20 gold)
- Remaining 2 points must be earned via steps or cardio

---

# Ranger Class Bonus

Rangers gain enhanced travel efficiency.

## Bonus

- +1 bonus Travel Point per qualifying travel day

### Example

- User earns 3 Travel Points from steps
- Ranger receives 4 total Travel Points

---

# Travel Momentum Bonus

Encourages combining movement with workouts.

## Bonuses

- Travel + workout (same day): +10 XP
- Travel + workout + cardio: +15 XP

---

# Multi-Day Travel System

Travel does not need to be completed in one session.

## Example Flow

Day 1: - Walk → +1 Travel Point

Day 2: - Workout + cardio → +1 Travel Point

Day 3: - Spend gold → +1 Travel Point

Destination reached

---

# Map Integration

- Each Travel Point moves the player to a new location node
- Locations contain a limited number of missions
- Cleared locations remain visible as progress markers

---

# Design Intent

The Travel System is designed to:

- Encourage real-world movement
- Create multi-day goals
- Introduce player choice
- Connect workouts to world progression

---

# UX Principles

- Always allow workouts at the current location
- Travel should expand options, not block gameplay
- Clearly show:
  - Distance remaining
  - Travel options (steps, cardio, gold)

---

# Example Player Decision

"I'm 3 points away from a boss location."

Options: - Walk more today - Add cardio after a workout - Spend gold to
finish travel

---

# Final Notes

Travel should feel:

- Flexible
- Rewarding
- Strategic

Never: - Punishing - Required grinding
