# Johnny5k: IronQuest - The Emberforge

## Location Role

The Emberforge is where IronQuest begins blending combat fantasy with labor fantasy. The town runs on heat, rhythm, and output, and its missions feel like surviving inside a living furnace.

### Design Goals

- Introduce the first easy 3-exercise mission
- Introduce the first runner task cardio mission
- Make heat management feel like mechanical pressure

## Overview

| Attribute   | Detail                                               |
| ----------- | ---------------------------------------------------- |
| Name        | The Emberforge                                       |
| Theme       | Fire, blacksmiths, molten environments               |
| Tone        | Industrious, brutal, glowing with contained violence |
| Level range | Levels 8-10                                          |

### Short Lore

> The Emberforge never truly sleeps. Hammers ring through the night, lava channels light the streets, and every weapon made here seems to remember the fire that birthed it.

## Map Position

| Connection Type | Location            |
| --------------- | ------------------- |
| Connected from  | Stormpeak Mountains |
| Unlocks toward  | Whispering Wilds    |

## Travel Requirement

| Requirement                 | Value           |
| --------------------------- | --------------- |
| Distance from previous node | 7 travel points |

### Design Intent

- Reward players who can alternate intensity and recovery
- Make environmental theme directly shape mission pacing
- Introduce varied mission formats beyond standard combat

## Location Structure

| Content Type                | Count |
| --------------------------- | ----- |
| Standard missions           | 4     |
| Boss missions               | 1     |
| Easy workout missions       | 1     |
| Runner task cardio missions | 1     |

## Mission Breakdown

| Mission                    | Type                | Goal                                | Threat                                 | Workout Feel                       |
| -------------------------- | ------------------- | ----------------------------------- | -------------------------------------- | ---------------------------------- |
| Bellows Duty               | Easy workout        | Learn the forge rhythm              | Overheated machinery and worker strain | 3 exercises only, low complexity   |
| Coal Run to the Lower Kiln | Runner task         | Deliver fuel before the flame fades | Timed route through heat vents         | Cardio challenge                   |
| Sparks on the Anvil Line   | Pressure combat     | Hold output under heat              | Molten husks and forge-wraiths         | Mid-intensity intervals            |
| The Cracked Crucible       | Pre-boss escalation | Stop a forge core rupture           | Living slag and collapsing platforms   | Mixed intensity with rising stakes |

## Boss Mission

### Mission 5: The Forgemaster Unbound

#### Unlock Conditions

- Complete all 4 prior missions
- Have at least 40 HP
- Carry heat-resistant supplies

#### Boss Narrative

> Deep in the master forge, the smith who once ruled the city has fused with iron and flame. He strikes the anvil once, and the whole chamber answers.

#### Workout Mapping

- Full workout with rhythm-based intensity waves
- Heavy middle section followed by a decisive finishing sequence
- Rewards consistency more than explosive starts

#### Outcome Variants

| Outcome | Result                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| Victory | The forge stabilizes and the city glows with disciplined fire once more.            |
| Partial | The master withdraws into the furnace heart and the city survives on borrowed time. |
| Failure | The chamber forces you back and the forge remains dangerously unstable.             |

## Rewards

### Standard Mission Rewards

| Reward Type | Value                                   |
| ----------- | --------------------------------------- |
| XP          | 210-250                                 |
| Gold        | 32-38                                   |
| Drop chance | Smithing gear, ember oils, minor potion |

### Boss Rewards

| Reward Type     | Value            |
| --------------- | ---------------- |
| XP              | 360              |
| Gold            | 52               |
| Guaranteed item | Forgeheart Bands |

### Full Clear Bonus

| Reward Type | Value                                                    |
| ----------- | -------------------------------------------------------- |
| XP          | +70                                                      |
| Gold        | +42                                                      |
| Progression | Unlocks the Wilds route and advanced gear crafting hooks |

## Class-Specific Flavor

### Warrior

- Tone: "This town respects output, not excuses."

### Ranger

- Tone: "Even fire has lanes if you read the floor right."

### Mage

- Tone: "Heat is chaos until you command its pattern."

### Rogue

- Tone: "Move where the sparks are not looking."

## AI Prompt Anchors

```json
{
  "location": "The Emberforge",
  "theme": "lava channels, anvils, molten steel, smoke and sparks",
  "tone": "intense, industrial, volcanic",
  "enemyTypes": ["slag constructs", "forge-wraiths", "flamebound smiths"]
}
```

## Tavern Integration

### Tavern Name

- The Cinder Cup

### Tavern Flavor Text

> The drinks are hot, the benches are scarred, and nobody here trusts hands without burn marks.

## Why This Location Works

- It introduces new mission formats without slowing progression
- It gives the world a strong craft-and-combat identity
- It teaches players to manage heat, rhythm, and output

## Metadata Completion

### Example Boss Item

| Item             | Effect                                                   | Flavor                                            |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Forgeheart Bands | Slightly improves recovery after high-intensity missions | Warm iron cuffs with a pulse like a hammer strike |

### Visual And UI Notes

#### Map Node

- Anvil icon over a lava glow
- Ember particles drifting upward

#### Completion State

- Furnaces shift from unstable red to clean gold
- The city's forge lines brighten across the map

### Tavern Integration

#### Tavern Tone

- Smiths
- Laborers
- Proud exhaustion

#### Tavern-Themed Actions

| Base Action | Themed Text                                                              |
| ----------- | ------------------------------------------------------------------------ |
| Rest        | "You sit near the cooling stones and let the heat leave your shoulders." |
| Side job    | "A foreman pays for sorting ore, coal, and broken steel."                |
| Rumors      | "The old smiths whisper that the master forge is breathing again."       |
