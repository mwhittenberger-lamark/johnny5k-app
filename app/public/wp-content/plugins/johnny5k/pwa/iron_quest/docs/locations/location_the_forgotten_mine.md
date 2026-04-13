# Johnny5k: IronQuest - The Forgotten Mine

## Location Role

The Forgotten Mine compresses the player into darkness and pressure. It is one of the most claustrophobic high-tier zones in the game.

## Overview

| Attribute   | Detail                                          |
| ----------- | ----------------------------------------------- |
| Name        | The Forgotten Mine                              |
| Theme       | Depth, pressure, claustrophobia                 |
| Tone        | Tight, dusty, oppressive and deep-earth hostile |
| Level range | Levels 90-96                                    |

### Short Lore

> The miners did not abandon this place. The place closed over them and kept working.

## Location Structure

| Content Type                   | Count |
| ------------------------------ | ----- |
| Standard missions              | 12    |
| Boss missions                  | 1     |
| Easy workout missions          | 1     |
| Runner task cardio missions    | 1     |
| Abs-only town defense missions | 1     |

## Mission Breakdown

| Mission       | Type                | Goal                                      | Threat              | Workout Feel          |
| ------------- | ------------------- | ----------------------------------------- | ------------------- | --------------------- |
| Lantern Check | Easy workout        | Establish controlled movement underground | Small cave crawlers | 3 exercises only      |
| Cart Run      | Runner task         | Push supplies to the lower shaft          | Rail-and-ramp route | Cardio challenge      |
| Surface Sweep | Town defense        | Clear out extortion crews near the camp   | Tunnel bandits      | Abs-only challenge    |
| Dust Lung     | Survival mission    | Hold pace in poor air                     | Cave spores         | Controlled endurance  |
| Shaft Three   | Pressure push       | Reopen a sealed passage                   | Rockbursts          | Hard intervals        |
| Coal Vein     | Labor-combat blend  | Clear a working face                      | Miner revenants     | Grind set             |
| Broken Lift   | Vertical route      | Reach the middle works                    | Falling debris      | Leg-heavy effort      |
| Echo Seam     | Tension encounter   | Fight what you hear before you see        | Tunnel stalkers     | Stop-start pacing     |
| The Deep Bell | Endurance event     | Reach a distress signal                   | Pit horrors         | Long sustained output |
| Iron Pocket   | Attrition chamber   | Survive tightening space                  | Burrowing elites    | Heavy fatigue         |
| Last Cart     | Pre-boss lead-in    | Send the final warning upward             | Foreman guards      | Severe work           |
| Black Vein    | Pre-boss escalation | Enter the deepest excavation              | Living ore          | Crushing finish       |

## Boss Mission

### Mission 13: The Deep Foreman

#### Unlock Conditions

- Complete all 12 prior missions
- Have at least 118 HP
- Carry underground survival supplies

## Metadata Completion

### Map Position

| Connection Type | Location           |
| --------------- | ------------------ |
| Connected from  | The Obsidian Gate  |
| Unlocks toward  | The Phantom Bazaar |

### Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 31 travel points |

### Design Goals

- Compress the player after the wide-scale threat of the Gate
- Make pressure and claustrophobia feel physically exhausting

### Design Intent

- Reward composure in tight, dirty, low-visibility spaces
- Keep progression feeling dense and oppressive

### Boss Narrative

> Deep enough that the air feels mined too, the foreman waits where the last good vein became the first bad omen.

### Boss Workout Mapping

- Full workout with cumulative fatigue and low-comfort transitions
- Final set resolves the deepest shaft confrontation
- Rewards grit and clean form under compression

### Boss Outcome Variants

| Outcome | Result                                                                        |
| ------- | ----------------------------------------------------------------------------- |
| Victory | The lower tunnels breathe again and the mine stops sounding hungry.           |
| Partial | The Foreman falls back into the black seam and only the upper works are safe. |
| Failure | The pressure of the depths wins and the shaft closes around your route.       |

### Rewards

### Standard Mission Rewards

| Reward Type | Value                                 |
| ----------- | ------------------------------------- |
| XP          | 435-495                               |
| Gold        | 66-74                                 |
| Drop chance | Mining gear, pressure charms, potions |

### Boss Rewards

| Reward Type     | Value                   |
| --------------- | ----------------------- |
| XP              | 735                     |
| Gold            | 110                     |
| Guaranteed item | Deep Foreman's Pickmark |

#### Example Boss Item

| Item                    | Effect                                                    | Flavor                                            |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| Deep Foreman's Pickmark | Slightly improves performance in pressure-heavy locations | A steel token scored by years of impossible labor |

### Full Clear Bonus

| Reward Type | Value                                                  |
| ----------- | ------------------------------------------------------ |
| XP          | +170                                                   |
| Gold        | +98                                                    |
| Progression | Opens the road to the Phantom Bazaar's wandering route |

### Class-Specific Flavor

### Warrior

- Tone: "Push the rock back. Push the fear back. Keep pushing."
- Emphasis: force through compression

### Ranger

- Tone: "Even underground, route choice is survival."
- Emphasis: line-reading and economy

### Mage

- Tone: "Control matters most where panic has nowhere to go."
- Emphasis: calm under pressure

### Rogue

- Tone: "Tight spaces reward the player who wastes the least motion."
- Emphasis: compact efficiency

### AI Prompt Anchors

```json
{
  "location": "The Forgotten Mine",
  "theme": "deep shafts, lantern light, coal dust, iron rails",
  "tone": "claustrophobic, oppressive, subterranean",
  "enemyTypes": ["tunnel bandits", "miner revenants", "pit horrors"]
}
```

### Visual And UI Notes

#### Map Node

- Mine shaft icon
- Dim lantern flicker

#### Completion State

- Tunnel routes stabilize
- Collapsed sections reopen on the map

### Tavern Integration

#### Tavern Name

- The Last Shift

#### Tavern Tone

- Miners
- Haulers
- People who blink hard when they see daylight

#### Tavern Flavor Text

> The louder a person laughs here, the more likely it is they are still a little scared of the dark.

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| Rest        | "You recover in a bunkroom that still smells like stone dust and lamp oil." |
| Side job    | "Crews pay for hauling ore, braces, and spare lanterns to the lower lifts." |
| Rumors      | "They say the Foreman still knows exactly who is working below him."        |

## Why This Location Works

- It makes claustrophobia a late-game mechanical identity
- It contrasts beautifully with the Gate's open-scale dread
- It keeps the unique-flavor arc varied and hard
