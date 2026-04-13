# Johnny5k: IronQuest - Frostfang Tundra

## Location Role

Frostfang Tundra makes endurance brutal again, this time with cold so aggressive it feels alive.

## Overview

| Attribute   | Detail                               |
| ----------- | ------------------------------------ |
| Name        | Frostfang Tundra                     |
| Theme       | Cold, endurance, survival pacing     |
| Tone        | White, vast, predatory and punishing |
| Level range | Levels 57-62                         |

### Short Lore

> The tundra is honest in a way most places are not: it tells you immediately that it would prefer you dead.

## Map Position

| Connection Type | Location           |
| --------------- | ------------------ |
| Connected from  | The Thornwood      |
| Unlocks toward  | The Sunfall Desert |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 24 travel points |

## Location Structure

| Content Type                   | Count |
| ------------------------------ | ----- |
| Standard missions              | 10    |
| Boss missions                  | 1     |
| Easy workout missions          | 1     |
| Runner task cardio missions    | 1     |
| Abs-only town defense missions | 1     |

## Mission Breakdown

| Mission          | Type                | Goal                                    | Threat                   | Workout Feel       |
| ---------------- | ------------------- | --------------------------------------- | ------------------------ | ------------------ |
| Fireline Basics  | Easy workout        | Warm the body before the storm          | Frost wisps              | 3 exercises only   |
| Sled Relay       | Runner task         | Drag medicine to the north camp         | Snowfield route          | Cardio challenge   |
| Icewall Sweep    | Town defense        | Drive off raiders from the outpost ring | Winter marauders         | Abs-only challenge |
| White Breath     | Survival drill      | Hold rhythm in cold exposure            | Ice hounds               | Steady endurance   |
| Frozen Teeth     | Pressure fight      | Clear a ridge of predators              | Tundra beasts            | Hard intervals     |
| Sundered Lake    | Route mission       | Cross unstable ice                      | Cracks and buried shapes | Technical pacing   |
| Long Night March | Endurance push      | Reach a watchfire before it dies        | Blizzard pressure        | Long-form stamina  |
| Snowblind Rise   | Uphill challenge    | Climb through full storm                | Cliff stalkers           | Heavy effort       |
| Mammoth Grave    | Attrition combat    | Secure ancient shelter                  | Bone scavengers          | Sustained grind    |
| Aurora Shelf     | Pre-boss escalation | Reach the white throne                  | Elite frost wardens      | Severe finish      |

## Boss Mission

### Mission 11: The White Maw

#### Unlock Conditions

- Complete all 10 prior missions
- Have at least 94 HP
- Carry cold-weather and recovery supplies

#### Boss Narrative

> The White Maw emerges like a glacier deciding it has been patient long enough.

## Metadata Completion

### Design Goals

- Reintroduce harsh endurance through cold and exposure
- Make long-distance movement feel deadly again

### Design Intent

- Reward stamina, resilience, and careful preparation
- Turn environmental hostility into a constant pacing tax

### Boss Workout Mapping

- Full workout with long survival phases and a crushing close
- Final set resolves the confrontation in whiteout conditions
- Rewards players who save enough for the end

### Boss Outcome Variants

| Outcome | Result                                                                         |
| ------- | ------------------------------------------------------------------------------ |
| Victory | The blizzard breaks and the northern routes stay visible through dawn.         |
| Partial | The Maw retreats into the storm and the tundra remains dangerous but passable. |
| Failure | The cold takes the route back and the storm keeps the summit.                  |

### Rewards

### Standard Mission Rewards

| Reward Type | Value                            |
| ----------- | -------------------------------- |
| XP          | 330-390                          |
| Gold        | 52-60                            |
| Drop chance | Winter gear, cold wards, potions |

### Boss Rewards

| Reward Type     | Value          |
| --------------- | -------------- |
| XP              | 570            |
| Gold            | 84             |
| Guaranteed item | White Maw Fang |

#### Example Boss Item

| Item           | Effect                                                 | Flavor                                           |
| -------------- | ------------------------------------------------------ | ------------------------------------------------ |
| White Maw Fang | Slightly improves endurance in exposure-heavy missions | A pale fang cold enough to fog the air around it |

### Full Clear Bonus

| Reward Type | Value                                   |
| ----------- | --------------------------------------- |
| XP          | +140                                    |
| Gold        | +80                                     |
| Progression | Opens the long road into Sunfall Desert |

### Class-Specific Flavor

### Warrior

- Tone: "Push until the cold has to respect you."
- Emphasis: stubborn power

### Ranger

- Tone: "Read the wind, not your fear."
- Emphasis: survival pacing

### Mage

- Tone: "Cold rewards anyone who can stay exact."
- Emphasis: control and calm

### Rogue

- Tone: "Move cleanly. Frozen mistakes last longer."
- Emphasis: efficient footwork

### AI Prompt Anchors

```json
{
  "location": "Frostfang Tundra",
  "theme": "snow plains, aurora light, broken ice, winter camps",
  "tone": "brutal, exposed, survivalist",
  "enemyTypes": ["winter marauders", "ice hounds", "frost wardens"]
}
```

### Visual And UI Notes

#### Map Node

- Frost fang icon
- Snow drift overlay

#### Completion State

- Whiteout warnings clear
- Northern campfires relight across the map

### Tavern Integration

#### Tavern Name

- The Warm Nail

#### Tavern Tone

- Expedition crews
- Trappers
- People who judge gloves the way others judge swords

#### Tavern Flavor Text

> The first question anyone asks here is whether your hands still work.

#### Tavern-Themed Actions

| Base Action | Themed Text                                                           |
| ----------- | --------------------------------------------------------------------- |
| Rest        | "You recover beside a stove hot enough to make the walls sweat."      |
| Side job    | "Crews pay for hauling furs, medicine, and spare sled parts."         |
| Rumors      | "They say the Maw circles anyone who looks too tired to keep moving." |

## Why This Location Works

- It makes the ranger arc physically punishing again
- It uses climate as a clear mechanical identity
- It bridges forest survival into desert survival cleanly
