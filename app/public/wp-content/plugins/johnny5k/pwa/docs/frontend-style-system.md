# Frontend Style System

## Purpose

This PWA uses layered CSS instead of CSS-in-JS. The goal is to keep tokens, base rules, shared components, and screen-specific styling separate so the design system can evolve without another monolithic stylesheet.

## Current Layer Order

`src/index.css` is the stylesheet manifest. It defines cascade order like this:

1. `tokens`
2. `base`
3. `components`
4. `screens`
5. `legacy`

`legacy` is temporary. New work should not expand that layer.

## File Structure

Current structure:

- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/components/actions.css`
- `src/styles/components/buttons.css`
- `src/styles/components/cards.css`
- `src/styles/components/feedback.css`
- `src/styles/components/forms.css`
- `src/styles/components/primitives.css`
- `src/styles/components/shell.css`
- `src/styles/components/theme-picker.css`
- `src/styles/screens/dashboard.css`
- `src/styles/screens/workout.css`
- `src/styles/screens/nutrition.css`
- `src/styles/screens/settings.css`
- `src/styles/legacy.css`

Additional files may be added under `components` or `screens` by domain, but new work should fit this layering instead of creating another catch-all stylesheet.

## Layer Ownership

- `tokens`: shared design tokens and app-wide values
- `base`: reset, typography, body/app shell defaults, and global element rules
- `components`: reusable primitives shared across screens
- `screens`: domain-scoped styling for dashboard, workout, nutrition, settings, and future screen domains
- `legacy`: migration residue only

`legacy.css` is not a shared utilities file. If a rule is reusable or owned by a named domain, it should move out of `legacy` into the correct layer.

## Shared Primitive Ownership

Shared primitives should have a clear home:

- `components/buttons.css`: button variants, icon buttons, and shared interactive button states
- `components/cards.css`: card surfaces, card hierarchy, and reusable card-like containers
- `components/forms.css`: labels, field rows, form grids, subtitles, success messaging, timezone picker, and onboarding schedule utilities
- `components/actions.css`: shared action rows and `header-action-button`
- `components/feedback.css`: transient feedback like `app-toast`
- `components/primitives.css`: dialogs, drawers, shared state cards, and reusable field wrappers
- `components/shell.css`: application shell, top-level layout, and shared structural wrappers
- `components/theme-picker.css`: theme picker presentation and controls

If a selector is reused across two or more domains, it should usually belong in `components`.

## Screen Ownership

- `screens/dashboard.css` owns `dashboard-*` selectors and dashboard-specific layout behavior
- `screens/workout.css` owns `workout-*` selectors and workout-specific layout behavior
- `screens/nutrition.css` owns `nutrition-*` selectors and nutrition-specific layout behavior
- `screens/settings.css` owns `settings-*` selectors and settings-specific layout behavior

Screen files may compose tokens and shared primitives, but they should not become local design systems.

## Token Rules

Use semantic or shared tokens before hardcoded values.

- Color tokens: `--bg`, `--bg2`, `--bg3`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent2`, `--accent3`, `--danger`, `--success`, `--yellow`
- Spacing scale: `--space-0-5`, `--space-0-75`, `--space-1`, `--space-1-5`, `--space-2`, `--space-2-5`, `--space-3`, `--space-3-5`, `--space-4`, `--space-4-5`, `--space-5`, `--space-6`, `--space-7`, `--space-8`, `--space-9`
- Radius scale: `--radius-sm`, `--radius-md`, `--radius`, `--radius-lg`, `--radius-xl`
- Elevation: `--shadow-xs`, `--shadow-sm`, `--shadow`, `--shadow-lg`
- Control sizing: `--nav-h`, `--button-h`, `--button-h-compact`
- Shared layout spacing: `--screen-gutter-x`, `--screen-gutter-y`, `--screen-section-gap`, `--card-pad-sm`, `--card-pad-md`, `--card-pad-lg`

## Spacing Rules

Spacing should come from the shared scale unless a one-off value is justified by a specific layout constraint. The app now has a tokenized rhythm for both primary spacing steps and the common half-steps that were previously repeated as raw literals.

- Page gutters should use `--screen-gutter-x`
- Top-level screen section spacing should use `--screen-section-gap`
- Card padding should use `--card-pad-sm`, `--card-pad-md`, or `--card-pad-lg`
- Inline gaps between controls should usually use `--space-1-5`, `--space-2`, or `--space-3`
- Small compact padding and chip spacing should usually use `--space-0-5`, `--space-0-75`, `--space-1`, or `--space-1-5`
- Medium rhythm values should usually use `--space-2-5`, `--space-3-5`, or `--space-4-5` instead of ad hoc `10px`, `14px`, or `18px`
- Large separations between sections should usually use `--space-5` through `--space-7`

Raw spacing literals should now be rare. They are acceptable when they are clearly one of these:

- a fixed dimension rather than layout rhythm
- a `clamp()` or responsive expression
- an optical offset that would not make sense as a reusable token
- a highly specific control interior that would become less clear if forced into the generic scale

Avoid adding raw values like `13px`, `18px`, or `22px` in new screen CSS unless there is a clear reason.

## Component Hierarchy

Component styling belongs in `src/styles/components`.

- Shared buttons belong in component CSS, not per-screen files
- Shared cards belong in component CSS, not per-screen files
- Shared dialogs, drawers, empty and error states, and field wrappers belong in component CSS
- Shared form grids, labels, subtitles, toasts, badges, pills, chips, drawers, and form controls should be promoted into component CSS once reused in two or more domains

Before adding a new variant, check whether an existing primitive can be extended.

## Screen Rules

Screen CSS belongs in `src/styles/screens`.

- Screen files may compose tokens and shared components
- Screen files should not redefine global typography, button primitives, or card primitives
- Screen selectors should stay domain-scoped, for example `dashboard-*`, `workout-*`, `nutrition-*`, `settings-*`
- Prefer tokenized spacing in screen files instead of introducing local rhythm rules
- If a screen needs a shared utility, move that utility into `components` instead of duplicating it across screens

## Density Rules

Use a small number of density tiers instead of arbitrary local padding choices.

- Dense: compact lists, chips, secondary toolbars
- Default: standard forms, cards, primary workflows
- Spacious: hero cards, modals, onboarding, empty states

If a screen needs a different density, define that as an explicit rule instead of drifting one selector at a time.

## Authoring Rules

- Do not add new styles to `src/styles/legacy.css` unless required for a migration-safe move
- Prefer tokens over raw hex, raw shadow values, and ad hoc spacing
- Prefer shared component classes over screen-specific copies
- Prefer spacing tokens over raw padding and margin values, including for compact UI
- If a selector stops being domain-specific, move it into `components`
- When moving CSS out of `legacy`, preserve selector names first and refactor second
- Keep visual changes separate from structural stylesheet moves when possible

## Migration Process

When touching an area that still lives in `legacy`:

1. Move the relevant selectors into the correct file under `components` or `screens`
2. Keep behavior and appearance unchanged in that pass
3. Replace raw spacing values with scale tokens where safe
4. Remove the moved selectors from `legacy.css`
5. Only then do visual cleanup or variant consolidation

When touching an area that already lives in `components` or `screens`:

1. Reuse the existing token scale before introducing any new local spacing
2. Keep shared primitives in the component layer and keep domain behavior in the screen layer
3. Only add new tokens when the value is truly reusable and recurring
4. Treat `legacy.css` as a shrinking compatibility layer, not a fallback destination
