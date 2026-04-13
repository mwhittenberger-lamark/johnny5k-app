# Johnny5k: IronQuest - The Drowned Catacombs

## Location Role

The Drowned Catacombs shifts difficulty into pressure and claustrophobia. It is less about open combat and more about surviving enclosed panic.

### Design Goals

- Sustain the 6-mission escalation
- Use water pressure and confinement as emotional difficulty
- Keep the runner mission but make it feel risky and submerged

## Overview

| Attribute   | Detail                                   |
| ----------- | ---------------------------------------- |
| Name        | The Drowned Catacombs                    |
| Theme       | Water, pressure, suffocation tension     |
| Tone        | Cold, submerged, echoing and panic-heavy |
| Level range | Levels 18-21                             |

### Short Lore

> Bells still toll beneath the water when no one pulls them. The dead here were buried below the tide, and the tide never left.

## Map Position

| Connection Type | Location      |
| --------------- | ------------- |
| Connected from  | Blackfang Den |
| Unlocks toward  | Ashen Wastes  |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 12 travel points |

## Location Structure

| Content Type                | Count |
| --------------------------- | ----- |
| Standard missions           | 6     |
| Boss missions               | 1     |
| Easy workout missions       | 1     |
| Runner task cardio missions | 1     |

## Mission Breakdown

| Mission             | Type                | Goal                                   | Threat                                | Workout Feel                  |
| ------------------- | ------------------- | -------------------------------------- | ------------------------------------- | ----------------------------- |
| Low Tide Drill      | Easy workout        | Learn movement in cramped spaces       | Slippery stone and shallow dead       | 3 exercises only              |
| Bell Relay          | Runner task         | Carry a relic through flooding tunnels | Timed route between rising chambers   | Cardio challenge              |
| Chapel Below        | Pressure control    | Secure the first crypt ring            | Drowned knights and collapsing arches | Mid-length steady pressure    |
| The Salt Ossuary    | Tension endurance   | Push through choking air               | Bone stacks and salt spirits          | Controlled long effort        |
| Floodgate Reliquary | Mixed encounter     | Stabilize a failing chamber            | Tide bursts and revenants             | Intervals under stress        |
| The Sunken Choir    | Pre-boss escalation | Reach the deepest sanctum              | Chanting dead and water surge traps   | Heavy fatigue with no comfort |

## Boss Mission

### Mission 7: The Bell-Tide Revenant

#### Unlock Conditions

- Complete all 6 prior missions
- Have at least 54 HP
- Carry drowned-crypt supplies

#### Boss Narrative

> When the final bell rings, the water rises around a figure in priestly armor. Its face is hidden by a helm filled with the sea.

#### Workout Mapping

- Full workout with wave-based pacing
- Every phase compresses rest windows further
- Final set resolves the drowned bell sequence

#### Outcome Variants

| Outcome | Result                                                             |
| ------- | ------------------------------------------------------------------ |
| Victory | The bells fall silent and the chambers begin to drain.             |
| Partial | The revenant sinks back below, but the lower crypts remain cursed. |
| Failure | The tide claims the route and the catacombs close behind you.      |

## Rewards

| Reward Type | Standard Missions                 | Boss Mission   |
| ----------- | --------------------------------- | -------------- |
| XP          | 270-320                           | 455            |
| Gold        | 42-50                             | 68             |
| Drops       | Tide charms, relic steel, potions | Bell-Tide Seal |

## Metadata Completion

### Design Intent

- Use claustrophobia and rising pressure as the main difficulty levers
- Make breathless pacing feel as threatening as combat

### Example Boss Item

| Item           | Effect                                                  | Flavor                                                        |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| Bell-Tide Seal | Slightly improves recovery after long pressure missions | A salt-stained relic that vibrates faintly with distant bells |

### Full Clear Bonus

| Reward Type | Value                              |
| ----------- | ---------------------------------- |
| XP          | +90                                |
| Gold        | +54                                |
| Progression | Opens the ash-choked routes inland |

### Class-Specific Flavor

### Warrior

- Tone: "Push through the pressure before it pushes through you."
- Emphasis: resolve in confined spaces

### Ranger

- Tone: "Read the tide, the stone, and the exit before panic does."
- Emphasis: movement timing

### Mage

- Tone: "Hold your center. The water can only take what you give it."
- Emphasis: control and pacing

### Rogue

- Tone: "Tight spaces favor whoever wastes the least motion."
- Emphasis: efficient bursts

### AI Prompt Anchors

```json
{
  "location": "The Drowned Catacombs",
  "theme": "flooded crypts, tolling bells, cracked arches, moonlit water",
  "tone": "claustrophobic, cold, sacred and drowning",
  "enemyTypes": ["drowned knights", "tide revenants", "salt spirits"]
}
```

### Visual And UI Notes

#### Map Node

- Flooded crypt icon
- Blue-green tide shimmer

#### Completion State

- Water levels recede on the map
- Bell icons fade into stillness

### Tavern Integration

#### Tavern Name

- The Dry Step

#### Tavern Tone

- Divers
- Gravekeepers
- People grateful for air

#### Tavern Flavor Text

> Every bench in the Dry Step sits a little higher than it needs to.

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| Rest        | "You sit near a brazier and listen to water drip somewhere far below."       |
| Side job    | "Keepers pay for carrying relics and dry supplies through the upper crypts." |
| Rumors      | "They say the bells ring loudest right before the revenant rises."           |

## Why This Location Works

- It broadens the game's difficulty beyond simple damage and output
- It makes enclosed environments feel mechanically distinct
- It gives the second group a strong horror-survival midpoint
