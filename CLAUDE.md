# Development Notes

## Mobile-Only Application

**Important:** This application is designed exclusively for mobile devices (iPhone/smartphone screens).

All UI/UX decisions should prioritize mobile interaction patterns:
- Touch-friendly tap targets
- Mobile-optimized layouts
- Single-column, vertical scrolling design
- No desktop-specific features needed

Target viewport: iPhone 13 mini (this is a personal app for me)

## HTML/CSS Guidelines

### Semantic HTML First
- Use semantic elements (`header`, `main`, `footer`, `nav`, `section`, `article`) directly for layout—don't wrap them in divs
- Lists of items should use `<ul>/<li>`, not `<div>` soup
- Avoid wrapper divs that only exist for a single CSS property—apply that property to the parent or child instead

### Minimal Markup
- Don't nest elements unnecessarily (e.g., `<header><div class="header">` is redundant)
- Content inside buttons/links doesn't need `<span>` wrappers unless styling requires it
- Question every `<div>`—can its styles go on an existing parent or child?

### CSS Variables
- All colors must use CSS custom properties (no hardcoded hex values in rules)
- All spacing values should use `--spacing-*` variables
- Add new variables to `:root` when needed rather than hardcoding values

### DRY CSS
- Shared styles between selectors should be combined or extracted to utility classes
- Don't create single-property classes (e.g., `.width-full { width: 100% }`)
- Base element styles should be minimal—specific components override as needed
- Remove unused classes and dead CSS rules
