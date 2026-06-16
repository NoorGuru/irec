---
inclusion: auto
---

# Frontend Design — Activate Power First

When working on any design document, UI component, or implementation task that involves visual/frontend work, **activate the `frontend-design` power FIRST** before writing any design decisions, CSS, component markup, or layout code.

## When to activate:

- Creating or updating a design document (design.md)
- Implementing any task that touches UI (components, styles, layouts, animations)
- Making decisions about color, typography, spacing, or visual hierarchy
- Designing new views (sign-in page, dashboard shell, loading states, access denied)

## Project design direction:

- **Big typography** — large, expressive display type is a defining trait of this project. Ticker symbols, headings, and key numbers should be oversized and confident. Type IS the design.
- **"Terminal Meets Bloomberg, but Human"** — dark, data-dense interface that still breathes. Financial precision without coldness.
- **Signature element: Sentiment Pulse Bar** — horizontal gradient bar per ticker (red→teal) showing consensus position visually. Scannable at a glance.
- **"Aura" glow** — the top-performing ticker (highest sentiment, 3+ mentions) gets a subtle teal glow that pulses once on load. Makes the brand name tangible.
- **Mono for data, sans for prose** — Geist Mono for tickers/numbers/prices, Geist Sans for labels and body. The contrast creates visual hierarchy without extra decoration.
- **Dark-first palette**: `#0A0F1A` (bg), `#141B2D` (surface), `#1E293B` (borders), `#00D4AA` (bullish/teal), `#FF4D6A` (bearish/red), `#8B95A8` (muted), `#F1F5F9` (primary text)
- **Motion: minimal, intentional** — staggered row entrance (50ms), pulse bars animate from 0 to value, glow fades in last. `prefers-reduced-motion` disables all.
- **Restraint** — spend boldness in one place per view. Keep surrounding elements quiet and disciplined. The data IS the hero.
- **Mobile: stacked cards** — each ticker becomes a card with pulse bar as visual anchor, generous touch targets, big ticker symbol at top.

## Typography preferences (user preference):

The user loves big, nice fonts. Always lean toward:
- Oversized display headings (3xl–6xl depending on context)
- Generous letter-spacing on ticker symbols
- Type should feel like a design choice, not just a delivery mechanism
- Let headlines breathe with whitespace above/below
- Numbers and financial data rendered large and monospaced for precision
