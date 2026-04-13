# Johnny5k: IronQuest - Verdant Expanse

## Location Role

Verdant Expanse opens the ranger-focused group with speed, openness, and distance. It looks calm at first, then quietly asks for far more total output than anything before it.

## Overview

| Attribute   | Detail                                             |
| ----------- | -------------------------------------------------- |
| Name        | Verdant Expanse                                    |
| Theme       | Open fields, movement, stamina                     |
| Tone        | Wind-swept, bright, wide and deceptively demanding |
| Level range | Levels 47-52                                       |

### Short Lore

> The Expanse is where armies marched, caravans traded, and monsters learned how to hide in plain sight.

## Map Position

| Connection Type | Location           |
| --------------- | ------------------ |
| Connected from  | The Astral Library |
| Unlocks toward  | The Thornwood      |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 22 travel points |

## Location Structure

| Content Type                   | Count |
| ------------------------------ | ----- |
| Standard missions              | 10    |
| Boss missions                  | 1     |
| Easy workout missions          | 1     |
| Runner task cardio missions    | 1     |
| Abs-only town defense missions | 1     |

## Mission Breakdown

| Mission                  | Type                | Goal                                      | Threat                  | Workout Feel          |
| ------------------------ | ------------------- | ----------------------------------------- | ----------------------- | --------------------- |
| Field Prep               | Easy workout        | Start with clean movement                 | Minor prowlers          | 3 exercises only      |
| Courier Across the Wheat | Runner task         | Deliver a scouting horn to the east watch | Long open route         | Cardio challenge      |
| Fence-Line Sweep         | Town defense        | Drive off raiders hitting nearby farms    | Horse thieves           | Abs-only challenge    |
| Tall Grass Signals       | Recon combat        | Secure sight lines                        | Hidden stalkers         | Quick pacing          |
| Broken Windmill          | Control encounter   | Hold a landmark ridge                     | Ambush packs            | Mid-intensity         |
| Meadow Run               | Travel push         | Cover more ground than the enemy line     | Field beasts            | Long steady work      |
| Sunpath Patrol           | Endurance route     | Protect a caravan lane                    | Skirmish riders         | Stamina-heavy         |
| Hollow Ridge             | Pressure fight      | Push uphill across exposed ground         | Longbow teams           | Mixed intervals       |
| Banner Hill              | Morale test         | Hold the center field                     | War hounds and chargers | Hard sustained output |
| Last Light Plain         | Pre-boss escalation | Reach the herd-lord's claim               | Elite riders            | Finish-heavy session  |

## Boss Mission

### Mission 11: The Briar Stag

#### Unlock Conditions

- Complete all 10 prior missions
- Have at least 86 HP
- Carry field and recovery supplies

#### Boss Narrative

> Antlers woven with living thorn, hooves that shake the grasslands, and eyes that know every route out except the one you need.

#### Workout Mapping

- Long full workout with repeated pursuit phases
- Final set is a speed-and-stamina finish
- Rewards movement efficiency and refusal to fade late

## Rewards

| Reward Type | Standard Missions                   | Boss Mission     |
| ----------- | ----------------------------------- | ---------------- |
| XP          | 300-360                             | 520              |
| Gold        | 48-56                               | 76               |
| Drops       | Ranger gear, travel charms, potions | Briar Stag Token |

## Tavern Integration

### Tavern Name

- The Long Mile

### Tavern Flavor Text

> The walls are covered in maps, weather notes, and bets on who can make it to the next ridge before sunset.

## Metadata Completion

### Design Goals

- Open the ranger arc with space and motion rather than confinement
- Raise total mission volume without losing readability

### Design Intent

- Reward stamina, navigation, and travel confidence
- Make openness feel demanding instead of restful

### Boss Outcome Variants

| Outcome | Result                                                                    |
| ------- | ------------------------------------------------------------------------- |
| Victory | The fields part cleanly and the caravan roads reopen through the Expanse. |
| Partial | The stag withdraws, but the grasslands remain wild and half-owned.        |
| Failure | The plains outlast you and the route closes again behind the herds.       |

### Example Boss Item

| Item             | Effect                                                     | Flavor                                                            |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Briar Stag Token | Slightly improves travel gains after long outdoor missions | A thorn-wrapped talisman still smelling faintly of rain and grass |

### Full Clear Bonus

| Reward Type | Value                                         |
| ----------- | --------------------------------------------- |
| XP          | +130                                          |
| Gold        | +74                                           |
| Progression | Opens the deep-forest path into the Thornwood |

### Class-Specific Flavor

### Warrior

- Tone: "Distance is just another opponent."
- Emphasis: relentless forward pressure

### Ranger

- Tone: "This is what your class was made to feel like."
- Emphasis: travel mastery and rhythm

### Mage

- Tone: "Wide ground still yields to structure if you keep your head."
- Emphasis: control in open space

### Rogue

- Tone: "A wide field only looks safe to people who don't know where to look."
- Emphasis: route exploitation

### AI Prompt Anchors

```json
{
  "location": "Verdant Expanse",
  "theme": "rolling fields, old roads, tall grass, low watchtowers",
  "tone": "open, restless, high-stamina",
  "enemyTypes": ["field raiders", "briar beasts", "ridge hunters"]
}
```

### Visual And UI Notes

#### Map Node

- Tall-grass field icon
- Wind ripple animation

#### Completion State

- Trade roads brighten across the map
- Banner posts return to the safe route

### Tavern Integration

#### Tavern Tone

- Scouts
- Couriers
- Travelers who never fully unpack

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                   |
| ----------- | ----------------------------------------------------------------------------- |
| Rest        | "You recover by an open window while the wind keeps moving through the hall." |
| Side job    | "Outriders pay for deliveries, map runs, and wagon spotting."                 |
| Rumors      | "They talk about a stag that seems to know every road before it's built."     |

## Why This Location Works

- It makes the ranger arc feel fresh immediately
- It turns movement and distance into the main test
- It uses open space to create pressure instead of relief
