# Johnny5k: IronQuest - Blackfang Den

## Location Role

Blackfang Den transforms the second group into primal combat. It is faster than the marsh, but far more violent.

### Design Goals

- Escalate pressure through direct physical threat
- Keep the 6-mission structure while increasing aggression
- Make the region feel feral rather than military

## Overview

| Attribute   | Detail                                  |
| ----------- | --------------------------------------- |
| Name        | Blackfang Den                           |
| Theme       | Beasts, primal combat                   |
| Tone        | Savage, loud, blood-warm and relentless |
| Level range | Levels 15-18                            |

### Short Lore

> Blackfang Den was once a hunter camp. Then the alpha came, and now the people who remain live by firelight and fear.

## Map Position

| Connection Type | Location              |
| --------------- | --------------------- |
| Connected from  | The Rotting Marsh     |
| Unlocks toward  | The Drowned Catacombs |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 11 travel points |

## Location Structure

| Content Type                | Count |
| --------------------------- | ----- |
| Standard missions           | 6     |
| Boss missions               | 1     |
| Easy workout missions       | 1     |
| Runner task cardio missions | 1     |

## Mission Breakdown

| Mission                | Type                | Goal                                 | Threat                             | Workout Feel              |
| ---------------------- | ------------------- | ------------------------------------ | ---------------------------------- | ------------------------- |
| Firepit Warmup         | Easy workout        | Learn the camp's combat rhythm       | Scattered scavengers               | 3 exercises only          |
| Venison Run            | Runner task         | Bring supplies back before dusk      | Predator-marked trail              | Cardio challenge          |
| Clawmarks on the Trees | Tracking fight      | Read signs and survive first contact | Pack wolves and ambushers          | Burst-and-hold pacing     |
| Red Creek Crossing     | Pressure battle     | Fight through a feeding zone         | Dire hounds and blood current      | High-intensity intervals  |
| The Bone Heap          | Attrition brawl     | Break a nest of carrion beasts       | Hyenas, boar brutes, pack pressure | Sustained brute work      |
| Moon Howl Ridge        | Pre-boss escalation | Reach the alpha's claim              | Night hunters and exposed terrain  | Hard finish-heavy session |

## Boss Mission

### Mission 7: Blackfang Alpha

#### Unlock Conditions

- Complete all 6 prior missions
- Have at least 50 HP
- Carry field rations and recovery supplies

#### Boss Narrative

> The alpha does not roar to impress you. It roars to tell everything else in the valley to stand back and watch.

#### Workout Mapping

- Full workout centered on repeated high-output rounds
- Final set is a one-on-one power test
- Rewards force, confidence, and clean form under strain

#### Outcome Variants

| Outcome | Result                                                               |
| ------- | -------------------------------------------------------------------- |
| Victory | The valley quiets, and the camp burns brighter than it has in years. |
| Partial | The alpha flees wounded, leaving the den fractured but not safe.     |
| Failure | The pack drives you out and the night belongs to them.               |

## Rewards

| Reward Type | Standard Missions               | Boss Mission            |
| ----------- | ------------------------------- | ----------------------- |
| XP          | 255-305                         | 430                     |
| Gold        | 40-48                           | 64                      |
| Drops       | Beast-hide gear, claws, potions | Blackfang Trophy Collar |

## AI Prompt Anchors

```json
{
  "location": "Blackfang Den",
  "theme": "pine dark, campfires, claw marks, blood trails",
  "tone": "feral, immediate, high-stakes",
  "enemyTypes": ["wolves", "boar brutes", "pack hunters", "alpha beast"]
}
```

## Tavern Integration

### Tavern Name

- The Hunter's Ember

### Tavern Flavor Text

> Every trophy on the wall is both a warning and a promise.

## Metadata Completion

### Design Intent

- Escalate from slow danger into immediate physical violence
- Make players prove they can stay aggressive under real pressure

### Standard Mission Rewards

| Reward Type | Value                           |
| ----------- | ------------------------------- |
| XP          | 255-305                         |
| Gold        | 40-48                           |
| Drop chance | Beast-hide gear, claws, potions |

### Boss Rewards

| Reward Type     | Value                   |
| --------------- | ----------------------- |
| XP              | 430                     |
| Gold            | 64                      |
| Guaranteed item | Blackfang Trophy Collar |

### Example Boss Item

| Item                    | Effect                                              | Flavor                                           |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Blackfang Trophy Collar | Slightly improves rewards from brute-force missions | A heavy leather collar lined with predator teeth |

### Full Clear Bonus

| Reward Type | Value                                       |
| ----------- | ------------------------------------------- |
| XP          | +85                                         |
| Gold        | +50                                         |
| Progression | Unlocks the drowned routes below the valley |

### Class-Specific Flavor

### Warrior

- Tone: "At last, something honest enough to meet you head-on."
- Emphasis: force and dominance

### Ranger

- Tone: "Track fast. Strike faster."
- Emphasis: pursuit and field awareness

### Mage

- Tone: "The wild does not care about elegance, only control."
- Emphasis: calm under primal pressure

### Rogue

- Tone: "Everything hunts here. Be the thing that hunts better."
- Emphasis: burst kills and evasion

### Visual And UI Notes

#### Map Node

- Fang-mark icon
- Campfire orange glow

#### Completion State

- Trophy fires burn brighter
- Predator routes fade from the map

### Tavern Integration

#### Tavern Tone

- Hunters
- Trophy keepers
- People who respect scars more than stories

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                |
| ----------- | -------------------------------------------------------------------------- |
| Rest        | "You recover beneath hanging hides and watch the fire like the others do." |
| Side job    | "Hunters pay for hauling carcasses, traps, and cut meat."                  |
| Rumors      | "Whispers point to an alpha that wants witnesses, not prey."               |

## Why This Location Works

- It turns difficulty into direct confrontation
- It rewards confidence without removing consequences
- It gives the second group a feral centerpiece
