# Johnny5k: IronQuest - The Wandering Caravan

## Location Role

The Wandering Caravan turns an entire moving settlement into a location. Its missions are about protecting momentum while the world keeps trying to stop it.

## Overview

| Attribute   | Detail                                              |
| ----------- | --------------------------------------------------- |
| Name        | The Wandering Caravan                               |
| Theme       | Travel-focused, shifting missions                   |
| Tone        | Mobile, communal, hopeful and under constant threat |
| Level range | Levels 109-116                                      |

### Short Lore

> The Caravan survives because it never stays long enough for disaster to learn its full route.

## Location Structure

| Content Type                   | Count |
| ------------------------------ | ----- |
| Standard missions              | 14    |
| Boss missions                  | 1     |
| Easy workout missions          | 1     |
| Runner task cardio missions    | 1     |
| Abs-only town defense missions | 1     |

## Mission Breakdown

| Mission         | Type                | Goal                                      | Threat               | Workout Feel       |
| --------------- | ------------------- | ----------------------------------------- | -------------------- | ------------------ |
| Wheel Check     | Easy workout        | Establish moving-settlement rhythm        | Minor route hazards  | 3 exercises only   |
| Scout Sprint    | Runner task         | Relay route updates to the lead wagon     | Long moving route    | Cardio challenge   |
| Rearguard Sweep | Town defense        | Drive off raiders hitting the supply ring | Road bandits         | Abs-only challenge |
| Hitchline       | Control mission     | Hold pace while repositioning gear        | Broken harness teams | Technical pacing   |
| Dustscreen      | Ambush event        | Fight through low-visibility attack       | Mounted raiders      | Hard intervals     |
| Cookfire Ring   | Endurance defense   | Protect the camp perimeter                | Night stalkers       | Sustained effort   |
| Wheel Rut       | Labor-combat blend  | Free stuck wagons under pressure          | Mud beasts           | Grinding output    |
| Salt Road       | Travel trial        | Cover punishing ground before dark        | Pursuit riders       | Long stamina       |
| Signal Mast     | Vertical route      | Climb and defend the lookout rig          | Sky harriers         | Mixed intensity    |
| Broken Axle     | Recovery denial     | Keep moving despite setbacks              | Saboteurs            | Harsh fatigue      |
| Night Camp      | Multi-wave defense  | Survive repeated attacks                  | Camp burners         | Long-form pressure |
| Dawn Departure  | Attrition push      | Break camp under threat                   | Elite outriders      | Severe grind       |
| Final Wheel     | Pre-boss lead-in    | Protect the command wagon                 | Vanguard hunters     | Heavy finish       |
| Dust Crown      | Pre-boss escalation | Reach the caravan heart                   | Ringmaster guards    | Max effort         |

## Boss Mission

### Mission 15: The Dustbound Ringmaster

#### Unlock Conditions

- Complete all 14 prior missions
- Have at least 130 HP
- Carry travel and recovery supplies

## Metadata Completion

### Map Position

| Connection Type | Location          |
| --------------- | ----------------- |
| Connected from  | The Goblin Market |
| Unlocks toward  | The Hero's Hall   |

### Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 35 travel points |

### Design Goals

- Turn an entire moving settlement into a progression zone
- Make motion, protection, and logistics inseparable

### Design Intent

- Reward consistency while the "town" itself is always in transit
- Make road pressure feel communal rather than isolated

### Boss Narrative

> The Ringmaster rides the dustline in from the horizon as if the whole road has been rehearsing for his arrival.

### Boss Workout Mapping

- Full workout with repeated defensive surges while momentum must be maintained
- Final set resolves the battle around the command wagon
- Rewards endurance and group-protection mindset

### Boss Outcome Variants

| Outcome | Result                                                                          |
| ------- | ------------------------------------------------------------------------------- |
| Victory | The Caravan rolls on under your banner and no one argues with the route.        |
| Partial | The Ringmaster is forced off, but the road remains dangerous and uneasy.        |
| Failure | The convoy survives by withdrawing and the dust keeps his tracks visible ahead. |

### Rewards

### Standard Mission Rewards

| Reward Type | Value                              |
| ----------- | ---------------------------------- |
| XP          | 485-545                            |
| Gold        | 72-80                              |
| Drop chance | Travel gear, wagon charms, potions |

### Boss Rewards

| Reward Type     | Value                   |
| --------------- | ----------------------- |
| XP              | 810                     |
| Gold            | 122                     |
| Guaranteed item | Ringmaster's Route Seal |

#### Example Boss Item

| Item                    | Effect                                                      | Flavor                                             |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Ringmaster's Route Seal | Slightly improves travel rewards across long mission chains | A stamped brass seal worn smooth by too many roads |

### Full Clear Bonus

| Reward Type | Value                                            |
| ----------- | ------------------------------------------------ |
| XP          | +185                                             |
| Gold        | +108                                             |
| Progression | Unlocks the ceremonial ascent to the Hero's Hall |

### Class-Specific Flavor

### Warrior

- Tone: "Protecting the line is still winning the fight."
- Emphasis: defensive strength

### Ranger

- Tone: "No route stays good unless someone keeps it that way."
- Emphasis: travel mastery

### Mage

- Tone: "Stability is harder when the whole world keeps moving."
- Emphasis: control under motion

### Rogue

- Tone: "Moving towns leave moving opportunities."
- Emphasis: speed and adaptability

### AI Prompt Anchors

```json
{
  "location": "The Wandering Caravan",
  "theme": "rolling wagons, dust roads, signal masts, campfire rings",
  "tone": "mobile, communal, pressured",
  "enemyTypes": ["road bandits", "outriders", "ringmaster guards"]
}
```

### Visual And UI Notes

#### Map Node

- Wagon-circle icon
- Moving track animation

#### Completion State

- The caravan route becomes a lit path across the map
- Supply wagons display player colors

### Tavern Integration

#### Tavern Name

- The Rolling Cup

#### Tavern Tone

- Drivers
- Scouts
- Families who pack fast

#### Tavern Flavor Text

> Everything here looks ready to leave because it usually is.

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                      |
| ----------- | -------------------------------------------------------------------------------- |
| Rest        | "You recover in a wagon-camp that never fully stops creaking."                   |
| Side job    | "Quartermasters pay for lifting crates, checking routes, and guarding the rear." |
| Rumors      | "The Ringmaster is said to know exactly where fear makes a convoy slow down."    |

## Why This Location Works

- It gives the final arc a strong moving-town identity
- It makes logistics and endurance feel heroic
- It sets up the return to the Training Grounds as a meaningful mastery checkpoint
