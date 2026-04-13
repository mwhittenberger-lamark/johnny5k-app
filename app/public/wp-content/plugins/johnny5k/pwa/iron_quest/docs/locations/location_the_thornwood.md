# Johnny5k: IronQuest - The Thornwood

## Location Role

The Thornwood is the closed-in answer to Verdant Expanse. The land narrows, sight lines disappear, and movement becomes a fight all by itself.

## Overview

| Attribute   | Detail                                      |
| ----------- | ------------------------------------------- |
| Name        | The Thornwood                               |
| Theme       | Dense forest, ambushes                      |
| Tone        | Green-dark, predatory, close and breathless |
| Level range | Levels 52-57                                |

### Short Lore

> The Thornwood grows around roads only long enough to learn them, then closes again when the screaming starts.

## Map Position

| Connection Type | Location         |
| --------------- | ---------------- |
| Connected from  | Verdant Expanse  |
| Unlocks toward  | Frostfang Tundra |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 23 travel points |

## Location Structure

| Content Type                   | Count |
| ------------------------------ | ----- |
| Standard missions              | 10    |
| Boss missions                  | 1     |
| Easy workout missions          | 1     |
| Runner task cardio missions    | 1     |
| Abs-only town defense missions | 1     |

## Mission Breakdown

| Mission              | Type                | Goal                                         | Threat           | Workout Feel       |
| -------------------- | ------------------- | -------------------------------------------- | ---------------- | ------------------ |
| Root Check           | Easy workout        | Establish footing in tight terrain           | Minor root traps | 3 exercises only   |
| Thicket Sprint       | Runner task         | Carry a cure through the underbrush          | Twisting trail   | Cardio challenge   |
| Barkwall Clear       | Town defense        | Push out cutters preying on the village edge | Thorn bandits    | Abs-only challenge |
| Whisper Trail        | Recon mission       | Track what hunts the scouts                  | Silent stalkers  | Technical pacing   |
| Needle Rain          | Ambush survival     | Keep moving under pressure                   | Poison archers   | Sharp intervals    |
| Bramble Tunnel       | Endurance route     | Force a way through growth-choked ground     | Vines and nests  | Long grind         |
| Hollow Canopy        | Elevated fight      | Take the battle upward                       | Tree-clingers    | Mid-high output    |
| Rotroot Circle       | Pressure event      | Destroy corrupted growths                    | Briar shamans    | Sustained control  |
| The Old Hunting Path | Attrition push      | Reach the cursed grove                       | Predator packs   | Heavy fatigue      |
| Heartwood Gate       | Pre-boss escalation | Enter the oldest part of the forest          | Thorn guards     | Hard close         |

## Boss Mission

### Mission 11: The Thorn King

#### Unlock Conditions

- Complete all 10 prior missions
- Have at least 90 HP
- Carry antidote and field supplies

#### Boss Narrative

> Crowned in bark, wearing antlers larger than a doorway, the Thorn King speaks only once: "Root."

## Rewards

| Reward Type | Standard Missions                  | Boss Mission     |
| ----------- | ---------------------------------- | ---------------- |
| XP          | 315-375                            | 545              |
| Gold        | 50-58                              | 80               |
| Drops       | Forest gear, poison cures, potions | Heartwood Signet |

## Metadata Completion

### Design Goals

- Turn the ranger arc inward from open movement to constrained survival
- Make dense terrain itself feel aggressive

### Design Intent

- Reward players who can stay efficient in hostile close quarters
- Replace open-road planning with ambush discipline

### Boss Workout Mapping

- Full workout built around repeated ambush phases and recovery denial
- Final set resolves the confrontation in the oldest grove
- Rewards patience and precise bursts

### Boss Outcome Variants

| Outcome | Result                                                                    |
| ------- | ------------------------------------------------------------------------- |
| Victory | The forest loosens its grip and the old paths stay visible after dusk.    |
| Partial | The king recedes into the roots and only the outer trails are truly safe. |
| Failure | The Thornwood closes around you and the marked route vanishes.            |

### Example Boss Item

| Item             | Effect                                               | Flavor                                                 |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Heartwood Signet | Slightly improves rewards from ambush-heavy missions | A rough ring cut from living wood that pulses like sap |

### Full Clear Bonus

| Reward Type | Value                                     |
| ----------- | ----------------------------------------- |
| XP          | +135                                      |
| Gold        | +78                                       |
| Progression | Unlocks the frozen route toward Frostfang |

### Class-Specific Flavor

### Warrior

- Tone: "Break through the choke point and make the forest answer you."
- Emphasis: force and refusal to be boxed in

### Ranger

- Tone: "Every root, bend, and branch is information."
- Emphasis: tracking and movement economy

### Mage

- Tone: "Control the line of the fight before the thorns do."
- Emphasis: composure in confined space

### Rogue

- Tone: "At last, a place where short routes matter more than straight ones."
- Emphasis: stealth and burst precision

### AI Prompt Anchors

```json
{
  "location": "The Thornwood",
  "theme": "dense roots, thorn walls, old hunting paths, green-dark canopies",
  "tone": "close, predatory, suffocating",
  "enemyTypes": ["thorn bandits", "forest stalkers", "root shamans"]
}
```

### Visual And UI Notes

#### Map Node

- Thorn ring icon
- Slow branch-growth animation

#### Completion State

- Paths remain visible on the world map
- Corrupted root zones recede

### Tavern Integration

#### Tavern Name

- The Split Bark

#### Tavern Tone

- Trappers
- Scouts
- People who keep knives within reach

#### Tavern Flavor Text

> Nobody here trusts a quiet window.

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                   |
| ----------- | ----------------------------------------------------------------------------- |
| Rest        | "You recover in a timber hall built to keep roots outside and arrows inside." |
| Side job    | "Foresters pay for clearing paths and hauling sap cures."                     |
| Rumors      | "They say the Thorn King knows who enters the wood before the gates do."      |

## Why This Location Works

- It sharpens the ranger arc from freedom into danger
- It makes terrain compression a real mechanical threat
- It gives the group a memorable mid-arc ambush zone
