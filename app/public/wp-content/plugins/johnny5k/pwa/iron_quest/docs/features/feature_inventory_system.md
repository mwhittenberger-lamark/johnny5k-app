# Inventory System Feature

## Core Goal Of Inventory + Gear

Users should feel:

> "This is my build"

Not:

> "I have some random items"

## 1. Inventory System (V1 Structure)

Keep it tight.

### Inventory Categories

- Equipped Gear
- Backpack, for items
- Consumables, including potions and supplies
- Capacity, an important decision

### V1 Recommendation

- Unlimited inventory for now

### Why

- Avoids early friction
- Easier technically
- No inventory anxiety

You can add limits later if needed.

## 2. Equipment Slots (Lock This)

Keep it simple and meaningful.

### Slots

- Weapon
- Armor
- Accessory

### Why Only 3?

- Forces decisions
- Easy to understand
- Prevents stat stacking chaos

## 3. Gear Design Principles

Every item should be:

- Easy to understand
- Small impact
- Clearly useful

### Example Gear (Refined)

- Weapon: Iron Sword
  +1 modifier on strength-based sets
- Weapon: Cursed Blade of Hollow, boss item
  +1 strength modifier
  +1 final boss roll, once per boss
- Armor: Reinforced Vest
  Reduce HP loss by 1 on failed set, once per workout
- Accessory: Traveler's Boots
  +10% travel point gain
- Accessory: Band of Focus
  +1 final boss roll, once per fight

## 4. Equip Logic (Important)

When the user taps an item, show:

- Current equipped item in the same slot
- New item stats
- Simple comparison

### Example UI

```text
Equip Cursed Blade?

Current: Iron Sword (+1 strength)
New: Cursed Blade (+1 strength + boss bonus)

[Equip] [Cancel]
```

### Rules

- Equipping is instant
- No cost to equip
- No cooldown

## 5. Item Types

### 1. Gear (Persistent)

- Stays until sold or replaced

### 2. Consumables

- Potions
- Supplies

### 3. Artifacts (Special Gear)

- Unique
- Boss drops
- Cannot stack duplicates

## 6. Artifact Rules (Important)

### Unique Rule

- Only one of each artifact

If the user gets a duplicate:

- Auto-convert to gold
- Or allow sell

### Artifact Identity

Artifacts should:

- Feel tied to location
- Have flavor text
- Have 1-2 meaningful effects

## 7. Inventory UX Flow

### Main Screen

#### Top

- Character image, from Gemini
- Equipped gear, visual icons

#### Sections

##### Equipped

- Weapon
- Armor
- Accessory

##### Backpack

- All gear items

##### Consumables

- Potions
- Supplies

### Tap Behavior

#### Tap Gear

- Show stats
- Show equip option

#### Tap Consumable

- Show use option

## 8. Quick Actions (Very Important)

Make it fast to use.

### From Main Screen

- Use Potion
- Equip Best Gear, optional later
- Sell Junk, later

## 9. Auto-Equip (Optional But Strong)

For beginners:

### Button

- Optimize Gear

Automatically:

- Equips best item per slot

### Why

- Removes friction
- Helps non-gamers

## 10. Sell Flow (Refined)

When selling, show:

- Item value
- Equipped warning

### Example

```text
Sell Cursed Blade of Hollow?

Value: 65 gold
This item is currently equipped

[Sell] [Cancel]
```

## 11. Visual Progression (Big Win)

Tie gear to the character image:

- New weapon -> visible
- Armor change -> visible
- Accessory -> subtle visual

Result:

> "I'm getting stronger"

## 12. Class Synergy (Important)

Gear should feel better for certain classes without locking others.

### Example

Warrior using Warhammer:

> "This feels powerful"

Rogue using the same:

> "Useful, but not optimal"

### Implementation

- No restrictions
- Just subtle synergy bonuses

## 13. Stat Stacking Rule (Very Important)

Hard cap total bonuses.

### Example

- Max total modifier bonus: +5
- Max percent bonus: 15%

### Why

Prevents:

- Broken builds
- Trivial gameplay

## 14. Inventory + Store Connection

### Flow Loop

1. Do mission
2. Earn item
3. Equip or sell
4. Buy upgrades
5. Repeat

This is your engagement engine.

## 15. One High-Impact Feature

### New Item Highlight

When user gets item:

- Glow effect
- New badge
- Auto-open inventory option

### Why

- Reinforces reward
- Drives interaction

## 16. Future Expansion (Don't Build Yet)

Keep in mind:

- Set bonuses
- Gear rarity tiers
- Crafting
- Loadouts

## Final V1 System (Locked)

### Inventory

- Unlimited
- 3 sections

### Gear

- Weapon
- Armor
- Accessory
- Simple stats

### Equip

- Instant
- Clear comparison

### Artifacts

- Unique
- Boss-tied

### UX

- Fast
- Minimal friction

## Why This Works

It gives:

- Ownership
- Progression
- Decision-making

Without:

- Overwhelming the user
