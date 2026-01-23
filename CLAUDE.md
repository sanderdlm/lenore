# Context

- This is a climbing training app
- I am the only user
- I use it on an iPhone 13 mini in the climbing gym
- It's hosted on GitHub Pages and installed as a PWA

## Problem
I commonly fall into the same unproductive pattern when I climb in the gym by myself.
I shy away from really hard problems and rapid-fire in my submax range, where I already have a lot of experience.
I don't review my attempts critically, blaming falls on "tired" or "too weak".
Because of the above, I struggle to correctly identify weaknesses and work on them.

## Possible solutions
Stick to a "5 tries per boulder" rule. Five max, but also minimum.
Forced review of each hard problem.
Record data about attempts and sessions to review and discover real weaknesses.

*The goal for this app is to solve the Problem, by providing tools to aid with the Solutions*

## Development Notes

This application is designed exclusively for an iPhone 13 mini.

All UI/UX decisions should prioritize mobile interaction patterns:
- Touch-friendly tap targets
- Mobile-optimized layouts
- Single-column, vertical scrolling design
- No desktop-specific features needed

### HTML/CSS Guidelines

- Use semantic elements (`header`, `main`, `footer`, `nav`, `section`, `article`) directly for layout—don't wrap them in divs
- Lists of items should use `<ul>/<li>`, not `<div>` soup
- Avoid wrapper divs that only exist for a single CSS property—apply that property to the parent or child instead
- Don't nest elements unnecessarily (e.g., `<header><div class="header">` is redundant)
- Content inside buttons/links doesn't need `<span>` wrappers unless styling requires it
- Question every `<div>`—can its styles go on an existing parent or child?

### CSS Variables
- All colors must use CSS custom properties (no hardcoded hex values in rules)
- All spacing values should use `--spacing-*` variables
- Add new variables to `:root` when needed rather than hardcoding values

### DRY CSS
- Shared styles between selectors should be combined or extracted to utility classes
- Base element styles should be minimal—specific components override as needed
- Remove unused classes and dead CSS rules

## Project-Specific Rules

### Design Philosophy
- **Flat, minimal design** - Prefer simple, clean aesthetics over complex shadows/gradients/3D effects
- **Variable-driven styling** - Everything uses CSS variables to enable easy design experimentation (e.g., changing `--radius` from `10px` to `0px` transforms the entire app from soft to harsh corners)
- **Color restraint** - The app uses colorful hold and grade indicators, so UI chrome should stay neutral/minimal to avoid visual overwhelm
- **Reusable components** - Style decisions should be made at the variable level, not hardcoded per-component

### Alpine.js Patterns
- Use string concatenation for `:class` bindings instead of array + object syntax (e.g., `:class="color + (selected ? ' selected' : '')"` not `:class="[color, { selected }]"`)
- Alpine.js can misinterpret object syntax in class bindings, rendering `[object Object]` as literal text

### State Management
- All data persists to `localStorage` via a single `STORAGE_KEY`
- Sessions loaded/validated on init with type checking for data integrity
- The `save()` method is called after any state mutation

### Touch Interactions
- Haptic feedback via `vibrate()` helper for key interactions (timer complete, etc.)
- No hover states needed (mobile-first), but can use `@media (hover: hover)` for progressive enhancement on desktop
- Consider visual feedback for checked/selected states carefully - avoid bright colors that compete with hold/grade colors

### Data Structure
- Each session has: `id` (timestamp), `createdAt` (timestamp), `problems` (array)
- Each problem has: `id`, `holdColor`, `gradeColor`, `attempts` (array of 5)
- Each attempt has: `checked` (boolean), `review` (string)
- Attempts are chronological - you can only check the next attempt in sequence

### Color System
- Hold colors: green, yellow, orange, blue, red, black, white, purple, teal, pink
- Grade colors: green, yellow, orange, blue, red, black, white, purple
- Both use the same CSS color classes (`.blue`, `.green`, etc.) for consistency

### Timer Feature
- Fixed presets: 2, 3, 4, 5 minutes
- Double-tap to clear active timer
- Vibration pattern on completion: `[200, 100, 200]`
- Display format: `MM:SS` or `--:--` when inactive

