# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-05-27
- Primary product surfaces: `public/index.html`, `public/css/styles.css`, `public/css/bookmarks-enhanced.css`, `public/css/workspace-refresh.css`, `public/js/i18n.js`
- Evidence reviewed:
  - `README.md`
  - `PROJECT_MINDMAP.md`
  - `public/index.html`
  - `public/css/styles.css`
  - `public/css/bookmarks-enhanced.css`
  - `public/css/workspace-refresh.css`

## Brand

- Personality: calm, reliable, utility-first, lightweight
- Trust signals: clear hierarchy, restrained color, readable copy, stable controls, visible empty/error/loading states
- Avoid: over-decorated gradients, noisy cards, heavy borders everywhere, dashboard bloat, visual gimmicks

## Product goals

- Goals:
  - Make the homepage feel like a clean bookmark workspace, not a cluttered admin panel
  - Keep search, browse, and common maintenance paths immediately understandable
  - Default to Chinese-readable copy and simple visual hierarchy
- Non-goals:
  - Do not redesign all subpages in this pass
  - Do not add a new frontend framework or design dependency
- Success signals:
  - Users can scan the page quickly
  - Key actions are obvious within 3 seconds
  - Bookmark list feels lighter and easier to browse

## Personas and jobs

- Primary personas:
  - owner maintaining a shared bookmark workspace
  - personal user using it as a start page / curated link library
- User jobs:
  - quickly search bookmarks
  - browse by category or popularity
  - enter maintenance pages only when needed
- Key contexts of use:
  - desktop-first
  - occasional public/shared viewing
  - local/private maintenance sessions

## Information architecture

- Primary navigation:
  - top header actions
  - hero quick actions
  - bookmark filters and library list
- Core routes/screens:
  - home
  - import
  - link checker
  - deleted bookmarks
  - notifications
  - token management
- Content hierarchy:
  - search and core entry first
  - quick maintenance actions second
  - library and filters third
  - settings/actions secondary

## Design principles

- Principle 1: reduce visual noise before adding new decoration
- Principle 2: make the first screen clearly answer what this page is and what to do next
- Principle 3: cards should group content, not compete with content
- Tradeoffs:
  - prefer simpler visuals over dramatic visual personality
  - keep implementation in CSS overrides instead of structural rewrites when possible

## Visual language

- Color:
  - light neutral canvas with restrained blue accent
  - use accent for one primary action at a time
- Typography:
  - strong readable heading hierarchy, compact supporting text
- Spacing/layout rhythm:
  - fewer oversized blocks, more even vertical rhythm
- Shape/radius/elevation:
  - medium rounded corners, soft elevation, thinner borders
- Motion:
  - subtle hover lift only
- Imagery/iconography:
  - keep text/icon shorthand minimal and functional

## Components

- Existing components to reuse:
  - header action buttons
  - hero panel
  - quick action cards
  - filters bar
  - bookmark cards
- New/changed components:
  - homepage visual polish only through CSS
- Variants and states:
  - primary CTA should be visually singular
  - secondary cards should be flatter and quieter
- Token/component ownership:
  - prefer `workspace-refresh.css` overrides for homepage-specific polish

## Accessibility

- Target standard: practical WCAG AA-minded defaults
- Keyboard/focus behavior: preserve existing controls and focus states
- Contrast/readability: reduce low-contrast decorative surfaces
- Screen-reader semantics: do not remove current semantic structure
- Reduced motion and sensory considerations: keep transitions short and subtle

## Responsive behavior

- Supported breakpoints/devices: desktop first, tablet/mobile adaptive
- Layout adaptations:
  - hero and quick actions should stack cleanly on narrow widths
- Touch/hover differences:
  - hover polish must not hide essential actions on touch screens

## Interaction states

- Loading: visible but compact
- Empty: clear and friendly
- Error: obvious retry path
- Success: subtle confirmation
- Disabled: visually distinct without low contrast
- Offline/slow network, if applicable: avoid relying on motion-heavy feedback

## Content voice

- Tone: direct, helpful, concise
- Terminology: Chinese-first for visible UI copy on this workspace
- Microcopy rules:
  - short labels
  - one action per button
  - avoid marketing tone

## Implementation constraints

- Framework/styling system: static HTML + CSS + vanilla JS
- Design-token constraints: reuse existing CSS variables, extend lightly if needed
- Performance constraints: no new dependencies, no large assets
- Compatibility constraints: keep current Pages/static deployment path unchanged
- Test/screenshot expectations:
  - lint/tests must keep passing
  - deployment must succeed through GitHub Actions

## Open questions

- [ ] Whether the product name itself should switch from `Bookmark Navigator` to a full Chinese title in visible chrome
- [ ] Whether subpages should follow the same simplified visual pass next
