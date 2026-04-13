# Johnny5k: IronQuest - System Rules & Design (v1)

## Core Systems

| System  | Purpose         |
| ------- | --------------- |
| XP      | Progression     |
| Gold    | Economy         |
| HP      | Readiness       |
| Potions | Recovery buffer |

## XP Formulas

| Activity      | Reward                               |
| ------------- | ------------------------------------ |
| Steps         | 100 steps = 1 XP                     |
| Cardio        | 1 min = 4 XP                         |
| Full workout  | 150 XP base, with bonuses up to ~225 |
| Short workout | 90 XP base, with bonuses up to ~120  |

## Class Bonuses

### Warrior

| Bonus Type            | Reward                        |
| --------------------- | ----------------------------- |
| Exceeded set          | +8 XP per set                 |
| Heavier completed set | +10 XP per set, capped at +40 |

### Ranger

| Bonus Type | Reward |
| ---------- | ------ |
| Step XP    | +20%   |
| Cardio XP  | +15%   |

### Mage

| Bonus Type         | Reward                              |
| ------------------ | ----------------------------------- |
| Full workout bonus | +20 XP                              |
| Sleep logged bonus | +10 XP                              |
| Streak bonus       | +5 XP per streak day, capped at +25 |

### Rogue

| Bonus Type           | Reward |
| -------------------- | ------ |
| Short workout bonus  | +20 XP |
| Quick session streak | +10 XP |

## Leveling

| Level Range | XP Required                        |
| ----------- | ---------------------------------- |
| Level 1-2   | 300 XP                             |
| Level 2-3   | 450 XP                             |
| Level 3-4   | 650 XP                             |
| Level 4-5   | 900 XP                             |
| Level 5-6   | 1200 XP                            |
| Level 6+    | Previous requirement x1.25 scaling |

## Gold

### Meals

| Completion      | Reward        |
| --------------- | ------------- |
| 1 meal          | 10 gold       |
| 2 meals         | 20 gold total |
| 3 or more meals | 30 gold max   |

### Workouts

| Workout Type | Reward  |
| ------------ | ------- |
| Full         | 25 gold |
| Short        | 15 gold |
| Boss         | 40 gold |

### Cardio And Travel

| Activity    | Reward  |
| ----------- | ------- |
| Travel      | 10 gold |
| Long cardio | 15 gold |

### Rogue Gold Bonus

- +20% gold earned
- Does not apply to item sales

## HP

### Max HP By Class

| Class   | Max HP |
| ------- | ------ |
| Warrior | 120    |
| Ranger  | 100    |
| Mage    | 100    |
| Rogue   | 90     |

### HP Costs

| Activity         | HP Change                             |
| ---------------- | ------------------------------------- |
| Workout          | 8-20 HP lost depending on performance |
| Cardio or travel | 4-8 HP lost                           |

## Sleep Recovery

| Sleep Logged | HP Recovered |
| ------------ | ------------ |
| Less than 5h | +4 HP        |
| 5-6h         | +8 HP        |
| 6-7h         | +12 HP       |
| 7-8h         | +18 HP       |
| 8-9h         | +22 HP       |
| 9h+          | +24 HP       |

### Mage Recovery Bonus

- +25% recovery

## Potions

### Potion Values

| Potion Type | Effect        |
| ----------- | ------------- |
| Standard    | Restore 20 HP |
| Greater     | Restore 35 HP |

### How Potions Are Earned

- 7-day workout streak
- 7-day sleep streak
- Boss drops

### Carry Limit

- Max carry: 3

## Travel System

### Travel Point Generation

| Activity      | Travel Points  |
| ------------- | -------------- |
| 1000 steps    | 1 travel point |
| 10 min cardio | 1 travel point |

### Mission Requirements

| Mission Size | Travel Points Required |
| ------------ | ---------------------- |
| Small        | 3                      |
| Medium       | 5                      |
| Large        | 8                      |

### Ranger Travel Bonus

- +1 travel point per travel day

## Fast Travel

| Rule          | Value                                                |
| ------------- | ---------------------------------------------------- |
| Gold exchange | 1 travel point = 10 gold                             |
| Skip cap      | Up to 50% of travel distance can be skipped via gold |

## Map System

- Each node represents a location
- Locations contain a limited mission pool, usually 3-5 standard missions plus a boss
- Players must travel to access new missions
- Cleared locations stay visible as progress markers
- The world map reflects player journey and progression

## Location System

Each location should include:

- Name
- Theme
- Lore
- Finite mission pool
- Boss encounter

Example themes:

- Undead village
- Mountain stronghold
- Desert ruins
- Arcane tower
- Forest realm

## Missions

- Each mission maps to a workout
- Mission pools are finite per location
- Boss missions unlock after standard missions are cleared

## Supplies

| Supply Tier | Cost    |
| ----------- | ------- |
| Basic       | 15 gold |
| Standard    | 25 gold |
| Elite       | 40 gold |

## Classes

### Warrior

- Focus: strength and intensity
- Subclasses: Berserker, Knight, Gladiator

### Ranger

- Focus: cardio and movement
- Subclasses: Scout, Hunter, Beastmaster

### Mage

- Focus: consistency and recovery
- Subclasses: Sorcerer, Cleric, Warlock

### Rogue

- Focus: accessibility and short sessions
- Subclasses: Assassin, Thief, Shadow

## Tavern Day

| Option            | Effect                      |
| ----------------- | --------------------------- |
| Rest              | +8 HP                       |
| Side job          | +10 gold                    |
| Rumors            | +10 XP and unlock a mission |
| Supplies purchase | Spend gold on supplies      |

## Daily Quests

### Example Quests

| Quest         | Reward             |
| ------------- | ------------------ |
| Meal log      | 10 gold            |
| 3000 steps    | 30 XP              |
| Short workout | 90 XP and 15 gold  |
| Sleep log     | Recovery plus 5 XP |

### Completion Bonus

- +20 gold
- +25 XP
- Chance for an item or potion

## Safety Rules

| Rule                 | Effect        |
| -------------------- | ------------- |
| Minimum HP floor     | 10 HP         |
| Beginner 7-day bonus | -30% HP loss  |
| Beginner 7-day bonus | +20% gold     |
| Beginner 7-day bonus | 1 free potion |

## Travel Momentum Bonus

| Combo                                     | Bonus  |
| ----------------------------------------- | ------ |
| Travel + workout on the same day          | +10 XP |
| Travel + workout + cardio on the same day | +15 XP |
