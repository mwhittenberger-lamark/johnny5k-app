# Johnny5k Style Guide

## Design Direction

Johnny5k should feel like **mid-century optimism translated into a modern mobile product**.

The intended tone is:

- warm
- energetic
- friendly
- clean
- confident
- slightly playful
- never kitschy
- never cluttered
- never overly clinical

The shorthand for the visual direction is:

**50s retro / modern**

A more precise interpretation is:

**optimistic mid-century energy + disciplined modern mobile UX**

---

## Core Design Principles

### 1. Fast before flashy
The UI should always feel quick, direct, and easy to use.

### 2. Personality without gimmicks
The app should have charm, but not become a themed novelty product.

### 3. Rounded, warm, approachable
Hard edges and sterile layouts should be avoided where possible.

### 4. Readability wins
Numbers, inputs, and progress indicators must always be easy to scan.

### 5. Touch-first
All primary interactions should feel comfortable on mobile, including one-hand use.

### 6. Encouraging, not aggressive
The brand should feel supportive and upbeat, not punishing or militaristic.

---

## Visual North Star

The design should feel like:

- a friendly high-performance fitness tool
- a modern app with warmth
- slightly retro in palette and shape language
- clean enough to scale across many screens

The design should not feel like:

- a 1950s diner
- a novelty atomic-age poster
- a bodybuilding spreadsheet
- a generic SaaS dashboard
- a dark, hyper-aggressive fitness app

---

## Color Palette

### Core Backgrounds

- **Cream / App Background:** `#F7F3EC`
- **White / Primary Card Surface:** `#FFFFFF`
- **Warm Surface Tint:** `#F9F6F0`
- **Muted Neutral Surface:** `#F0ECE4`

### Text Colors

- **Primary Text / Charcoal:** `#1F2A2E`
- **Secondary Text / Muted Gray:** `#5C6B70`

### Accent Colors

- **Primary Accent / Teal:** `#2FA4A9`
- **Highlight / Coral:** `#F25F5C`
- **Secondary Highlight / Mustard:** `#F2C14E`

### Utility Colors

- **Soft Yellow Prompt Background:** `#FFF4D6`
- **Light Border:** `#E7E0D6`

---

## Color Usage Rules

### Teal
Use teal for:
- primary non-destructive actions
- active highlights
- positive UI emphasis
- selected or currently active states

Do not overuse teal on every element.

### Coral
Use coral for:
- completion states
- strong emphasis
- key call-to-action buttons
- celebratory or “done” feedback

Coral should feel energetic, not alarming.

### Mustard
Use mustard for:
- secondary highlights
- subtle emphasis
- supportive accent moments

Do not use mustard as the main action color.

### Cream
Cream should be the dominant background across the app. It gives the app warmth and prevents the design from feeling too sterile.

---

## Typography

### Heading Font
Recommended:
- **Poppins**

Use for:
- screen titles
- card titles
- section headings
- high-level emphasis

### Body Font
Recommended:
- **Inter**

Use for:
- body text
- helper text
- form labels
- inputs
- buttons
- tab labels

### Typography Philosophy
Use personality in headings and clarity in functional UI.

---

## Type Scale Recommendations

### Headings
- Screen title: `28–32px`
- Card title: `16–20px`
- Section heading: `14–18px`

### Body
- Standard body: `14–16px`
- Supporting copy: `12–14px`

### Numbers
- Weight, reps, calories, macros, timers should be slightly larger and visually prominent
- Use **tabular numbers** if possible for consistency

---

## Shape Language

Johnny5k should use **rounded geometry** heavily.

### Recommended Border Radius
- Large cards: `16–24px`
- Buttons: pill or `999px`
- Inputs: `10–14px`
- Chips / tags: pill-shaped

### Shape Intent
Rounded shapes reinforce:
- friendliness
- optimism
- retro-modern identity
- touch comfort

Avoid overly sharp corners throughout the interface.

---

## Shadows and Depth

Depth should be subtle and soft.

### Recommended Card Shadow
```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
```

### Recommended Footer Shadow
```css
box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
```

### Principles
- Use shadows to separate surfaces
- Avoid heavy elevation stacks
- Avoid glossy or faux-3D styling

---

## Spacing System

Use a **4px base unit**.

### Common Spacing Values
- `4px`
- `8px`
- `12px`
- `16px`
- `20px`
- `24px`
- `32px`

### Typical Usage
- Card padding: `16px`
- Space between cards: `12–16px`
- Space between internal content groups: `8–12px`
- Footer/action spacing: `8–12px`

Spacing should feel open, not cramped.

---

## Component Style Rules

## Cards

Cards are one of the main design signatures of the app.

### Card Treatment
- white or lightly tinted background
- rounded corners
- soft shadow
- clean internal spacing
- no heavy outlines unless needed for clarity

### Card Types
- dashboard cards
- exercise cards
- meal cards
- progress summary cards
- AI response cards

---

## Buttons

### Primary Buttons
- teal or coral depending on context
- white text
- pill-shaped or heavily rounded
- bold label text

### Secondary Buttons
- muted neutral background
- charcoal text
- rounded pill shape

### Micro-action Buttons
Examples:
- `+5`
- `-5`
- `+2.5`

These should:
- be small but easy to tap
- use subtle neutral backgrounds
- remain visually distinct from primary CTAs

---

## Inputs

Inputs should feel:
- clean
- large
- touch-friendly
- easy to scan quickly

### Input Styling
- rounded corners
- white background
- light border
- centered numeric text when appropriate

### Workout Logging Inputs
Weight and rep inputs should be:
- larger than normal form inputs
- easy to tap one-handed
- optimized for fast repeated entry

---

## Pills / Tags / Chips

Use pill-shaped labels for:
- muscle groups
- reason tags
- small status labels
- smart prompts

### Typical Styling
- muted neutral background
- charcoal or muted text
- compact padding
- very rounded corners

---

## Prompts and Suggestions

Smart suggestions should be visually supportive and non-intrusive.

### Prompt Styling
- soft yellow background
- rounded pill or rounded card
- short copy
- subtle icon optional

### Examples
- “Try 80 lbs next set”
- “Want to shorten and finish strong?”
- “You may be fatiguing—drop 5 lbs?”

Prompts should help the user, not interrupt them.

---

## Motion and Interaction

Motion should feel:
- quick
- soft
- encouraging
- responsive

### Good Motion Uses
- set completion feedback
- row insertion
- subtle button bounce
- state changes
- bottom sheet motion

### Avoid
- flashy transitions
- long animations
- constant movement
- over-animated gradients

---

## Icons

Recommended style:
- simple
- rounded
- readable
- medium stroke weight

Potential icon systems:
- Phosphor
- Lucide

Avoid:
- ultra-thin icons
- overly futuristic icon sets
- ornamental retro icons inside core workflow screens

---

## Brand Voice in UI Copy

The interface text should feel:
- supportive
- concise
- calm
- slightly upbeat

### Good examples
- “Nice—let’s keep it going.”
- “Try 80 lbs next set.”
- “Strong session.”
- “You’re ready for push day.”

### Avoid
- overly technical jargon
- shame-based phrasing
- drill-sergeant language
- robotic health language

---

## Workout Screen Visual Rules

The Active Workout Screen is the most important visual benchmark for the app.

It should feel:
- warm and clean
- focused
- efficient
- lightly playful
- easy to scan while moving

### Key visual ingredients
- cream background
- white exercise cards
- teal accent strip or active state
- coral completion state
- rounded set rows
- sticky footer with large buttons

---

## Dashboard Visual Rules

The dashboard should feel:
- uplifting
- organized
- digestible

Use:
- stacked cards
- clear status modules
- visual breathing room
- light celebratory emphasis for streaks and awards

---

## Nutrition Screen Visual Rules

Nutrition should feel:
- easy
- practical
- not overly clinical

Meal cards and saved meals should feel friendly and reusable, not like spreadsheet entries.

---

## Progress Screen Visual Rules

Progress should feel:
- positive
- calm
- motivating

Charts and comparisons should support progress awareness without feeling harsh or judgmental.

---

## Do Not Do These Things

- do not use heavy textures
- do not use chrome, diner styling, or fake vintage materials
- do not rely on dark aggressive palettes
- do not overuse gradients
- do not make buttons tiny
- do not make the UI feel like enterprise software
- do not make the app visually noisy
- do not let the retro concept reduce usability

---

## Design Summary

Johnny5k should look like a **friendly retro-futurist fitness app built with modern mobile standards**.

The best shorthand is:

**rounded, warm, optimistic, fast**

And the best practical reference phrase is:

**mid-century optimism with modern product discipline**
