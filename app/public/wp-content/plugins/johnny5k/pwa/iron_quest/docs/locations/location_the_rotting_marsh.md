# Johnny5k: IronQuest - The Rotting Marsh

## Location Role

The Rotting Marsh begins the second location group and marks a major difficulty jump. Everything here is slower, heavier, and more punishing over time.

### Design Goals

- Increase standard mission count by two
- Introduce sustained attrition as the main source of difficulty
- Make every decision feel sticky and costly

## Overview

| Attribute   | Detail                                        |
| ----------- | --------------------------------------------- |
| Name        | The Rotting Marsh                             |
| Theme       | Poison, slow movement, attrition              |
| Tone        | Fetid, oppressive, swamp-heavy and exhausting |
| Level range | Levels 12-15                                  |

### Short Lore

> The marsh does not kill quickly. It poisons boots, breath, water, and hope until survivors no longer remember what moving freely felt like.

## Map Position

| Connection Type | Location         |
| --------------- | ---------------- |
| Connected from  | Whispering Wilds |
| Unlocks toward  | Blackfang Den    |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 10 travel points |

## Location Structure

| Content Type                | Count |
| --------------------------- | ----- |
| Standard missions           | 6     |
| Boss missions               | 1     |
| Easy workout missions       | 1     |
| Runner task cardio missions | 1     |

## Mission Breakdown

| Mission               | Type                | Goal                            | Threat                                  | Workout Feel             |
| --------------------- | ------------------- | ------------------------------- | --------------------------------------- | ------------------------ |
| Mudstep Patrol        | Easy workout        | Learn swamp footing             | Sinking ground and leech pools          | 3 exercises only         |
| Reedline Supply Run   | Runner task         | Deliver medicine across the bog | Timed route through unstable boardwalks | Cardio challenge         |
| Sickness in the Water | Attrition control   | Purge a poisoned inlet          | Bog dead and rot spores                 | Moderate steady work     |
| Lanterns in the Mire  | Survival tension    | Navigate false lights           | Marsh hags and lure-beasts              | Long pacing challenge    |
| Crooked Ferry         | Pressure encounter  | Hold a crossing point           | Swamp raiders and sinking planks        | Mixed intervals          |
| The Bone Silo         | Pre-boss escalation | Reach the marsh heart           | Rot priests and toxic totems            | Heavy fatigue management |

## Boss Mission

### Mission 7: The Mire King

#### Unlock Conditions

- Complete all 6 prior missions
- Have at least 46 HP
- Carry antitoxin supplies

#### Boss Narrative

> He rises from the black water wearing reeds like a crown and grave-bones like armor. The swamp moves when he does.

#### Workout Mapping

- Longer full workout with suffocating pacing windows
- Final set is a survival push rather than a sprint
- Designed to drain impatient players

#### Outcome Variants

| Outcome | Result                                                                         |
| ------- | ------------------------------------------------------------------------------ |
| Victory | The water clears and the marsh paths finally hold firm underfoot.              |
| Partial | The king sinks beneath the surface and the bog remains dangerous but passable. |
| Failure | The swamp swallows your advance and the poison keeps spreading.                |

## Rewards

| Reward Type | Standard Missions                  | Boss Mission      |
| ----------- | ---------------------------------- | ----------------- |
| XP          | 240-290                            | 410               |
| Gold        | 38-44                              | 60                |
| Drops       | Marsh gear, toxins, recovery items | Mire King's Sigil |

## AI Prompt Anchors

```json
{
  "location": "The Rotting Marsh",
  "theme": "black water, reeds, rot fog, crooked boardwalks",
  "tone": "slow, poisonous, suffocating",
  "enemyTypes": ["bog dead", "rot priests", "swamp raiders"]
}
```

## Tavern Integration

### Tavern Name

- The Reed Lantern

### Tavern Flavor Text

> The regulars sit with their boots on the table to keep the floor from claiming them.

## Metadata Completion

### Design Intent

- Teach players to respect slow damage and cumulative fatigue
- Make the environment feel like an enemy as much as the monsters

### Standard Mission Rewards

| Reward Type | Value                              |
| ----------- | ---------------------------------- |
| XP          | 240-290                            |
| Gold        | 38-44                              |
| Drop chance | Marsh gear, toxins, recovery items |

### Boss Rewards

| Reward Type     | Value             |
| --------------- | ----------------- |
| XP              | 410               |
| Gold            | 60                |
| Guaranteed item | Mire King's Sigil |

### Example Boss Item

| Item              | Effect                                                | Flavor                                          |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Mire King's Sigil | Slightly reduces HP loss from long endurance missions | A tarnished charm slick with swamp-black enamel |

### Full Clear Bonus

| Reward Type | Value                                          |
| ----------- | ---------------------------------------------- |
| XP          | +80                                            |
| Gold        | +46                                            |
| Progression | Opens the beast-haunted valleys beyond the bog |

### Class-Specific Flavor

### Warrior

- Tone: "Every step feels heavier. Keep moving anyway."
- Emphasis: force through attrition

### Ranger

- Tone: "The marsh punishes anyone who wastes motion."
- Emphasis: pathing and efficiency

### Mage

- Tone: "This is a place for controlled endurance, not panic."
- Emphasis: composure and recovery timing

### Rogue

- Tone: "Speed matters most where the ground wants to keep you."
- Emphasis: burst movement and clean exits

### Visual And UI Notes

#### Map Node

- Reed-crowned skull icon
- Sickly green mist

#### Completion State

- Water darkens less and lantern paths stabilize
- Safe crossings appear on the map

### Tavern Integration

#### Tavern Tone

- Survivors
- Herbalists
- People too tired to dramatize danger

#### Tavern-Themed Actions

| Base Action | Themed Text                                                          |
| ----------- | -------------------------------------------------------------------- |
| Rest        | "You dry your gear over a reed fire and try not to smell the water." |
| Side job    | "Locals pay for hauling herbs and medicine across the planks."       |
| Rumors      | "They speak of a king beneath the waterline."                        |

## Why This Location Works

- It marks the first big attrition spike
- It makes recovery planning feel essential
- It gives the dark-and-gritty arc a strong opening identity
