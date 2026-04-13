# General Goods Store Feature

## Core Purpose Of The General Goods Store

The store should enable 3 things:

### 1. Progression Support

Help users:

- Recover, including HP and potions
- Prepare, including supplies
- Continue playing

### 2. Strategic Choices

Users decide whether to:

- Spend gold to make the next mission easier
- Save for better gear
- Fast travel versus grind steps

### 3. Identity Reinforcement

- Gear reflects class and playstyle
- Items feel thematic to the location

## Store Structure (Keep V1 Simple)

Use 4 sections only:

1. Supplies
2. Potions
3. Gear
4. Sell / Inventory

No more than this for v1.

## 1. Supplies (Mission Entry System)

These are the "permission to play" items for bigger content.

### Items

- Basic Supplies - 15 gold
  Required for standard missions, optional early game
- Standard Supplies - 25 gold
  Required for boss fights
- Elite Supplies - 40 gold
  Required for higher-tier bosses later

### Design Intent

- Creates a gold sink
- Makes bosses feel like preparation matters

## 2. Potions (Recovery Layer)

### Items

- Healing Potion - 20 gold
  Restore 20 HP
- Greater Healing Potion - 35 gold
  Restore 35 HP

### Rules

- Max carry: 3 in v1
- 1 use per day, optional constraint

### Design Intent

- Safety net
- Reduces frustration
- Alternative to sleep recovery

## 3. Gear (Light RPG Layer)

This is where identity and strategy kick in.

### Equip Slots (V1)

- Weapon
- Armor
- Accessory

### Example Store Items (Starter Tier)

- Weapon: Iron Sword - 30 gold
  +1 modifier on strength sets
- Armor: Reinforced Vest - 30 gold
  -1 HP loss on failed sets, once per workout
- Accessory: Traveler's Boots - 25 gold
  +10% travel point gain
- Accessory: Band of Focus - 25 gold
  +1 bonus on final boss roll, once per fight

### Design Rules

- Keep bonuses small
- Cap total bonus impact at around 15%
- Avoid stacking exploits

## 4. Sell / Inventory System

This is critical for making loot matter.

### Selling Items

Suggested values:

- Common: 15-25 gold
- Uncommon: 30-50 gold
- Rare, such as boss items: 60-80 gold

### Rules

- Cannot sell equipped item accidentally
- Confirm before selling
- Show stat comparison before selling

### Design Intent

- Creates economy loop
- Lets users convert rewards into choices

## 5. Location-Based Stores (Very Important)

Each location should feel different.

### Example

#### Grim Hollow Store

- Dark
- Desperate
- Limited gear
- More potions

#### Ironhold Store

- Military
- Strength gear
- Fewer potions

This adds:

- Immersion
- Variety
- Replay value

## 6. Price Balancing (Very Important)

Gold should feel:

- Earnable in 1-2 sessions
- Spendable without anxiety
- Valuable enough to think about

### Target Feel

- 1 workout = about 25 gold
- 1 potion = about 1 workout
- 1 gear item = about 1-2 days

## 7. Fast Travel Integration

The store should also offer:

### Travel Pass

- 10 gold per travel point

### UX Idea

Show:

> "You are 2 points away"

- Walk
- Do Cardio
- Use Gold

## 8. Rotating Items (Optional V2)

Later you can add:

- Daily rotating gear
- Rare items
- Limited-time offers

Skip this for v1.

## 9. UX Flow (Important)

When the user enters the store, show:

### Top

- Gold balance
- HP status

### Sections

- Supplies
- Potions
- Gear
- Sell

### Buying Flow

Tap item, then see:

- Effect
- Comparison
- Confirm

### Selling Flow

Open inventory, tap item, then see:

- Value
- Warning if equipped
- Confirm

## 10. One Feature You Should Add

### Recommended Purchase

Based on:

- Low HP -> suggest potion
- Boss coming -> suggest supplies
- Low travel -> suggest travel

Example:

> "You look unprepared for what's ahead."

This uses Johnny5k to guide without forcing.

## 11. Tavern + Store Relationship

- Tavern = passive benefits
- Store = active decisions

They should feel different.

## 12. One Risk To Avoid

Do not make the store feel like:

> "I need to grind gold to play"

### Solution

- Keep basic play free
- Make the store enhance, not block

## Final Structure (Locked V1)

The store has:

- Supplies: 15 / 25 / 40 gold
- Potions: 20 / 35 gold
- Gear: 25-40 gold
- Sell system
- Fast travel option

## Why This Works

This creates:

- Meaningful decisions
- Repeat engagement
- Light RPG depth
- No overwhelm
