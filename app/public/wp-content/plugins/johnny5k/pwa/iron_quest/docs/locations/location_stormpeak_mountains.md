# Johnny5k: IronQuest - Stormpeak Mountains

## Location Role

Stormpeak Mountains is the first pure endurance wall in IronQuest. It teaches players how to survive long climbs, oxygen-starved pacing, and repeated effort under cold stress.

### Design Goals

- Push stamina over raw power
- Make recovery decisions matter before the boss
- Introduce altitude as a pacing mechanic

## Overview

| Attribute   | Detail                                   |
| ----------- | ---------------------------------------- |
| Name        | Stormpeak Mountains                      |
| Theme       | Harsh climbs, endurance, thin air        |
| Tone        | Severe, lonely, wind-cut and unforgiving |
| Level range | Levels 6-8                               |

### Short Lore

> The people of Stormpeak built their homes into the cliffs because only the stubborn ever belonged here. Now the passes are sealed by ice, thunder, and things that hunt in the whiteout.

## Map Position

| Connection Type | Location          |
| --------------- | ----------------- |
| Connected from  | Ironhold Fortress |
| Unlocks toward  | The Emberforge    |

## Travel Requirement

| Requirement                 | Value           |
| --------------------------- | --------------- |
| Distance from previous node | 6 travel points |

### Design Intent

- Reward steady output over reckless bursts
- Make travel feel like part of the encounter fantasy
- Prepare players for longer boss structures

## Location Structure

| Content Type      | Count |
| ----------------- | ----- |
| Standard missions | 4     |
| Boss missions     | 1     |

## Mission Breakdown

| Mission                 | Type              | Goal                            | Threat                                    | Workout Feel                         |
| ----------------------- | ----------------- | ------------------------------- | ----------------------------------------- | ------------------------------------ |
| The Frozen Pass         | Climb opener      | Establish altitude pressure     | Ice drakes and avalanche debris           | Long steady effort                   |
| Thunder Ladder          | Vertical push     | Teach pacing on repeated climbs | Narrow ledges and storm strikes           | Leg-heavy endurance                  |
| Whiteout Watch          | Tension endurance | Hold output in low visibility   | Snow hunters stalking the ridge           | Controlled fatigue management        |
| Peak of the Broken Bell | Pre-boss ascent   | Build dread and exhaustion      | Ruined summit shrine and gale-force winds | Mixed intensity with long recoveries |

## Boss Mission

### Mission 5: The Storm Tyrant

#### Unlock Conditions

- Complete all 4 prior missions
- Have at least 36 HP
- Carry cold-weather supplies

#### Boss Narrative

> At the summit, the storm takes shape. Wings of sleet, horns of ice, and a roar that shakes snow loose from the cliffs below.

#### Workout Mapping

- Long-form full workout with two climbing phases and one final output test
- Final set resolves the summit duel
- Punishes poor pacing more than low strength

#### Outcome Variants

| Outcome | Result                                                               |
| ------- | -------------------------------------------------------------------- |
| Victory | The storm breaks and the mountain path opens beneath clear sky.      |
| Partial | The tyrant retreats into the clouds and the pass opens only briefly. |
| Failure | You descend alive, but the summit remains under the storm's rule.    |

## Rewards

### Standard Mission Rewards

| Reward Type | Value                                            |
| ----------- | ------------------------------------------------ |
| XP          | 190-230                                          |
| Gold        | 28-34                                            |
| Drop chance | Climbing gear, cold-weather charms, minor potion |

### Boss Rewards

| Reward Type     | Value                      |
| --------------- | -------------------------- |
| XP              | 340                        |
| Gold            | 48                         |
| Guaranteed item | Galebound Climber's Mantle |

### Full Clear Bonus

| Reward Type | Value                                      |
| ----------- | ------------------------------------------ |
| XP          | +65                                        |
| Gold        | +38                                        |
| Progression | Unlocks the forge route below the mountain |

## Class-Specific Flavor

### Warrior

- Tone: "Every step uphill is earned. Every breath is fought for."
- Emphasis: force through fatigue

### Ranger

- Tone: "You read the mountain before it kills you."
- Emphasis: movement economy and travel mastery

### Mage

- Tone: "Control is warmth. Control is breath."
- Emphasis: calm pacing and precision

### Rogue

- Tone: "The safest path is never the obvious one."
- Emphasis: footwork and efficient bursts

## AI Prompt Anchors

```json
{
  "location": "Stormpeak Mountains",
  "theme": "ice cliffs, high winds, prayer bells, storm-lit snow",
  "tone": "lonely, punishing, majestic",
  "enemyTypes": ["ice drakes", "storm spirits", "ridge hunters"]
}
```

## Tavern Integration

### Tavern Name

- The Rope and Hearth

### Tavern Flavor Text

> No one in Stormpeak wastes words. They warm their hands, study the weather, and judge newcomers by whether they come back down.

## Why This Location Works

- It shifts difficulty from brute force to pacing
- It makes travel and recovery feel inseparable from progression
- It gives the world vertical scale and survival drama

## Metadata Completion

### Example Boss Item

| Item                       | Effect                                                | Flavor                                   |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| Galebound Climber's Mantle | Reduces travel fatigue after endurance-heavy missions | Wind-worn cloth that never fully settles |

### Visual And UI Notes

#### Map Node

- Snow-capped peak icon
- Faint lightning flicker

#### Completion State

- Storm clouds thin over the summit
- Climb route glows clear on the map

### Tavern Integration

#### Tavern Tone

- Climbers
- Guides
- Quiet endurance

#### Tavern-Themed Actions

| Base Action | Themed Text                                                     |
| ----------- | --------------------------------------------------------------- |
| Rest        | "You thaw beside a stone hearth and melt snow from your boots." |
| Side job    | "Guides pay for hauling rope, hooks, and winter stores."        |
| Rumors      | "Veterans speak of shapes moving above the storm line."         |
