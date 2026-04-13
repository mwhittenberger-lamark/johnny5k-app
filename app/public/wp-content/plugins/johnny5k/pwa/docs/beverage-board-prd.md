# Beverage Board PRD

## Overview

Beverage Board is a lightweight nutrition extension that makes drinks easy to log and easy to coach against.

The feature has two jobs:

- help users quickly log caloric beverages that often get missed,
- help users track daily water intake with near-zero friction.

This should live inside the existing Nutrition experience, not as a separate product area.

## Problem

Users often undercount beverage calories because drinks feel smaller, less memorable, and less "meal-like" than food. Coffee drinks, soda, tea drinks, juice, sports drinks, and packaged beverages can quietly move calorie intake away from target.

The current nutrition flow can support food logging, but it does not provide a purpose-built, low-friction beverage workflow or a simple daily water tracker.

## Product Goal

Create a fast beverage logging flow that:

- captures hidden beverage calories,
- keeps water tracking one tap away,
- gives Johnny enough 7-day beverage context to make one useful recommendation when a real pattern appears.

## User Value

- I can log a drink in seconds without building a full meal.
- I can see beverage calories reflected in my nutrition totals immediately.
- I can track water with one tap.
- Johnny can point out beverage patterns that are hurting or helping progress.

## Core Experience

### Beverage Logging

The user opens Beverage Board from Nutrition.

The user starts typing a drink name. The app suggests likely matches from existing food and branded-product search sources.

The user selects a match, selects a size or serving, and saves it.

The logged beverage should:

- add to daily calorie and macro totals,
- appear in the logged meals area as part of nutrition history,
- be reusable through recent or saved items when appropriate.

### Water Tracking

The board includes 6 tappable water-glass icons.

Each tap fills or clears a glass and updates the user's water count for the day.

Water entries should be visually separate from caloric beverage logs and should not behave like meal calories.

### Johnny Review

When a new caloric beverage is logged, Johnny should review the user's beverage intake over the last 7 days and surface a recommendation only when there is a meaningful pattern.

Examples:

- repeated high-calorie coffee drinks,
- soda or juice frequency driving calorie overages,
- strong hydration consistency,
- low water logging consistency.

Johnny may use web-supported nutrition resolution for branded beverages when the existing local match is weak.

## MVP Scope

### In Scope

- Beverage Board section inside Nutrition.
- Search-first drink logging flow.
- Support for common non-alcoholic beverages including water, coffee, tea, soda, juice, sports drinks, and packaged drinks.
- Size or serving selection before save.
- Logged beverages roll into existing nutrition totals and meal-history views.
- 6-glass daily water tracker.
- Rule-based 7-day beverage review with optional AI wording.

### Out of Scope

- Alcohol logging.
- Barcode scanning specific to beverages.
- Custom hydration goals by ounces, liters, climate, or body weight.
- A standalone beverage screen outside Nutrition.
- Johnny commentary after every log regardless of signal quality.

## Product Rules

- Caloric beverages should use the existing nutrition logging pipeline whenever possible.
- Water should be stored and rendered as hydration data, not as a fake meal item.
- Beverage coaching should be evidence-based and quiet by default.
- One recommendation is better than multiple beverage tips.
- If evidence is weak, Johnny should stay brief or stay silent.

## Data and Logic

### Logging Model

- Reuse existing food search and saved-item infrastructure for beverage matching.
- Treat caloric beverages as nutrition items so totals update automatically.
- Add a beverage marker or category where useful for filtering and coaching.

### Hydration Model

- Store daily water-glass count separately from meals.
- Default target for MVP: 6 glasses per day.

### Review Window

Use a rolling 7-day beverage summary that can include:

- total beverage calories,
- average beverage calories per logged day,
- sugary-drink frequency,
- high-calorie coffee drink frequency,
- water glasses logged,
- days with any hydration log.

## Recommendation Logic

Johnny should prioritize beverage guidance only when beverage behavior is clearly affecting nutrition adherence or hydration consistency.

Priority order:

1. Hidden calorie drift from frequent caloric beverages.
2. Sugary-drink frequency.
3. Low hydration consistency.
4. Positive reinforcement for improved beverage choices or water consistency.

## Success Criteria

- A user can log a drink in under 10 seconds.
- Beverage calories visibly update nutrition totals after save.
- Water can be logged in one tap.
- Beverage recommendations reference a real 7-day pattern.
- The feature increases nutrition logging completeness without adding coaching noise.

## Open Questions

- Should Beverage Board appear as its own card in Nutrition or as a subsection inside the Today view?
- Should drinks be grouped under a dedicated "Beverages" row in meal history or simply appear within the normal logged stream?
- Should zero-calorie flavored drinks be handled as hydration, nutrition items, or both?
