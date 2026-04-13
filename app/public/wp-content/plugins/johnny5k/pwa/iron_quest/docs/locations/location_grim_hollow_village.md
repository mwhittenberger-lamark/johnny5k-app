# Johnny5k: IronQuest - Grim Hollow Village

## Location Role

Grim Hollow Village is the first major "real" location after onboarding.

It is designed to teach:

- Missions
- HP loss and recovery
- Narrative progression

It also establishes the tone of the wider world.

## Overview

| Attribute   | Detail                                         |
| ----------- | ---------------------------------------------- |
| Name        | Grim Hollow Village                            |
| Theme       | Undead, decay, cursed settlement               |
| Tone        | Dark, oppressive, slow dread rather than chaos |
| Level range | Early game, roughly levels 2-4                 |

### Short Lore

"Grim Hollow was once a quiet village... until something beneath it awakened. The dead do not rest here. They wait."

## Map Position

### Connected From

- Training Grounds

### Unlocks Toward

- Ironhold Fortress for the Warrior path
- Whispering Wilds for the Rogue path

## Travel Requirement

| Requirement                 | Value           |
| --------------------------- | --------------- |
| Distance from previous node | 3 travel points |

This is the player's first strong incentive to use:

- Steps
- Cardio
- Optional gold-based travel shortcuts

## Location Structure

| Content Type      | Count |
| ----------------- | ----- |
| Standard missions | 4     |
| Boss missions     | 1     |

The boss mission stays locked until the standard missions are complete.

## Mission Breakdown

Each mission maps to one workout.

### Mission 1: Shadows in the Streets

| Field        | Detail                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| Type         | Intro combat                                                                        |
| Goal         | Establish tone                                                                      |
| Narrative    | "The streets are silent. Too silent. Then... movement. Shapes emerge from the fog." |
| Enemy type   | Shamblers and weak but numerous undead                                              |
| Workout feel | Steady effort and controlled pacing                                                 |

### Mission 2: The Burning Chapel

| Field        | Detail                                                         |
| ------------ | -------------------------------------------------------------- |
| Type         | Pressure and intensity                                         |
| Goal         | Raise urgency                                                  |
| Narrative    | "Flames consume the chapel. Something inside refuses to burn." |
| Enemy type   | Faster undead with aggressive behavior                         |
| Workout feel | Higher intensity with shorter rest                             |

### Mission 3: The Graveyard Watcher

| Field        | Detail                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Type         | Endurance and tension                                                   |
| Goal         | Build fatigue pressure                                                  |
| Narrative    | "Graves have been disturbed. Something watches from beyond the stones." |
| Enemy type   | Lurking entity, slow and persistent                                     |
| Workout feel | Endurance and fatigue management                                        |

### Mission 4: The Hollow Well

| Field        | Detail                                                                        |
| ------------ | ----------------------------------------------------------------------------- |
| Type         | Pre-boss escalation                                                           |
| Goal         | Build toward the boss reveal                                                  |
| Narrative    | "The well at the village center descends into darkness. The source is below." |
| Enemy type   | Corrupted villagers and environmental pressure                                |
| Workout feel | Mixed intensity with clear buildup                                            |

## Boss Mission

### Mission 5: The Necromancer of Hollow

#### Unlock Conditions

- Complete all 4 prior missions
- Have at least 30 HP
- Carry required supplies

#### Boss Narrative

"You descend into the well... and find him waiting. The one who commands the dead. The one who will not yield."

#### Workout Mapping

- Full workout structure with buildup sets leading into a final confrontation
- Final set serves as the boss resolution beat
- Uses stacked modifiers and the highest-stakes roll in the location

#### Outcome Variants

| Outcome | Result                                                                  |
| ------- | ----------------------------------------------------------------------- |
| Victory | "The Necromancer falls. The dead collapse. Silence returns... for now." |
| Partial | "He retreats into shadow. The village is not yet free."                 |
| Failure | "You survive, but barely. The darkness remains."                        |

## Rewards

### Standard Mission Rewards

| Reward Type | Value                      |
| ----------- | -------------------------- |
| XP          | 150-200                    |
| Gold        | 20-25                      |
| Drop chance | Minor gear or small potion |

### Boss Rewards

| Reward Type     | Value                  |
| --------------- | ---------------------- |
| XP              | 300                    |
| Gold            | 40                     |
| Guaranteed item | Cursed Blade of Hollow |

#### Example Boss Item

| Item                   | Effect                                     | Flavor          |
| ---------------------- | ------------------------------------------ | --------------- |
| Cursed Blade of Hollow | +1 success modifier on strength-based sets | Faint dark aura |

### Full Clear Bonus

| Reward Type | Value                    |
| ----------- | ------------------------ |
| XP          | +50                      |
| Gold        | +30                      |
| Progression | Unlock next region paths |

## Class-Specific Flavor

### Warrior

- Tone: "You cut through them. Their numbers mean nothing."
- Emphasis: aggressive pacing and heavy sets

### Ranger

- Tone: "You move through the fog unseen. They cannot keep pace."
- Emphasis: movement and stamina

### Mage

- Tone: "You hold control where others would panic."
- Emphasis: discipline and consistency

### Rogue

- Tone: "You strike quickly... and vanish before they react."
- Emphasis: speed and efficiency

## AI Prompt Anchors

Use these as the shared prompt foundation for mission art or narrative generation:

```json
{
  "location": "Grim Hollow Village",
  "theme": "undead decay, fog, cursed village",
  "tone": "dark, slow dread",
  "enemyTypes": ["undead", "necromancer", "corrupted villagers"]
}
```

## Visual And UI Notes

### Map Node

- Dark village icon
- Faint green glow
- Subtle fog animation

### Completion State

- Lighting shifts from dim to gradually brightened
- Node symbol changes to "cleansed"

## Tavern Integration

### Tavern Name

- The Last Lantern

### Tavern Tone

- Survivors
- Quiet desperation

### Tavern Flavor Text

"A few remain. They watch you with cautious hope."

### Tavern-Themed Actions

| Base Action | Themed Text                              |
| ----------- | ---------------------------------------- |
| Rest        | "You sit by the lantern's fading light." |
| Side job    | "They offer coin for small tasks."       |
| Rumors      | "They speak of the one below the well."  |

## Why This Location Works

It teaches the game's core loop:

- Missions equal workouts
- Story equals progression
- HP loss matters
- Bosses create clear goals

It does that with:

- Strong theme
- Emotional tone
- Clear structure
