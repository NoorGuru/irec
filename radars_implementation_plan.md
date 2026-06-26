# Goal Description

The goal is to design and plan a highly premium, data-dense "Stock Radars" feature. This feature aggregates specific themes (e.g., Mag 7, MANGOS, AI Infrastructure) and tracks their collective sentiment from YouTube analysts. It follows the "Terminal Meets Bloomberg, but Human" aesthetic, leveraging modern web features like View Transitions, true glassmorphism, and distinctive typography. We are evolving this to be highly interactive, visually distinct per radar, and rich in aggregated data.

## User Review Required

- **Mobile Layout Shift:** We are shifting the mobile homepage Radars from a vertical stack to a horizontal scrollable carousel to save vertical space and allow users to reach the stock tables faster. Is this acceptable?
- **Data Aggregation Formulas:** We are using a **Simple Average** for the Radar's sentiment pulse. Do we want to weigh by market cap later, or stick to simple average so all stocks have equal voice?

## Proposed Feature & Radars

### 1. Curated Premium Radars (Unique Themes)
Each radar will have distinct visual identifiers (auras, icons, and background blur effects).

- **The Mag 7:** AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA. 
  - *Theme:* Golden/Purple Aura, Crown Icon. 
- **MANGOS (The AI Frontier):** META, ANTH (Anthropic), NVDA, GOOGL, OAI (OpenAI), SPCX (SpaceX).
  - *Theme:* Crimson/Void Aura, Spark Icon.
  - *Note:* We will use `OAI` and `ANTH` as pseudo-tickers for OpenAI and Anthropic to track their mentions and sentiment, alongside the existing `SPCX`.
- **AI Infrastructure & Hardware:** AMD, SMCI, TSM, ASML, ARM, PLTR, MU. 
  - *Theme:* Electric Blue Aura, Microchip/Circuit Icon.
- **GLP-1 & Bio (The Weight Loss Boom):** LLY, NVO, AMGN, VKTX. 
  - *Theme:* Bio-Green Aura, DNA/Leaf Icon.
- **Bitcoin Proxies:** MSTR, COIN, MARA, RIOT, IBIT. 
  - *Theme:* Crypto Orange Aura, Bitcoin/Lightning Icon.
- **Defense & Aero:** LMT, RTX, NOC, GD. 
  - *Theme:* Tactical Amber Aura, Shield/Target Icon.

### 2. UI / UX Placement

- **Homepage Dashboard Feature:** 
  - **Desktop:** A sleek "Bento Grid" (mosaic of glass cards) located prominently on the homepage, acting as a portal to these Radars.
  - **Mobile:** A horizontal scrollable snap-carousel (`overflow-x-auto snap-x`) of cards to save vertical space.
- **The Radars Index Page (`/radars`):** A dedicated, beautiful page listing all available curated Radars with larger visualizations.
- **The Radar Detail Page (`/radars/[slug]`):** A dedicated page that shows:
  1. The aggregated **"Sentiment Pulse"** of the entire Radar (Simple Average Conviction).
  2. **Aura Score Trend:** A mini line chart showing the 30-day trajectory of the radar's Composite Aura Score.
  3. **Volume:** Total number of recent mentions across all constituent stocks.
  4. The top videos discussing this specific Radar.
  5. A breakdown of the constituent stocks/companies (similar to the main table, but filtered).
- **Connecting Current Stocks to Radars:** On an individual ticker's detail page (e.g., `/ticker/SPCX`), we will add an elegant, pill-shaped glassmorphic tag: `[ ✦ Part of the MANGOS Radar ]`. Clicking this pill navigates to the Radar page.

### 3. Making Them Unique (Modern Web & Frontend Design)

- **View Transitions (`same-document-transitions`):** We will use the View Transitions API so that when a user clicks a Radar card, it smoothly morphs into the hero section of the Radar detail page.
- **Ambient Auras:** Each Radar gets its own subtle, custom color variable (e.g., `--aura-mag7: #FFD700`). We will use a soft radial gradient (`radial-gradient`) in the background of their cards and headers, fading cleanly into the `#0A0F1A` base background.
- **True Glassmorphism:** Radar cards won't be solid blocks. They will use deep backdrop blurs (`backdrop-blur-xl`), translucent borders (`border-white/5`), and a subtle hover uplift (`hover:-translate-y-1 hover:border-white/10`) to feel like panes of glass floating in the terminal.
- **Big Typography:** The Radar names will use oversized **Geist Sans** (e.g., `text-5xl tracking-tight`), while the constituent tickers will be listed in **Geist Mono** for that high-end data feel.

## Proposed Changes

---

### Frontend / UI Architecture

#### [NEW] `src/app/radars/page.tsx`
The main index of all Radars, featuring the grid layout of Radar cards.

#### [NEW] `src/app/radars/[slug]/page.tsx`
The dynamic detail page for a specific Radar. Will reuse the main table component but filter data to only show the Radar's stocks. Adds Aggregate Stats.

#### [NEW] `src/components/ui/radar-card.tsx`
A highly polished, glassmorphic card component for displaying a Radar. Includes the custom radial aura, the Radar's aggregated sentiment pulse bar, and the mini Aura Score trend line.

#### [MODIFY] `src/app/page.tsx`
Inject the "Trending Radars" section. Implements a Bento grid on desktop, and a horizontal scroll snap container on mobile.

#### [MODIFY] `src/app/ticker/[symbol]/page.tsx`
Add the `[ ✦ Part of the <Radar Name> Radar ]` relational tags to the ticker header. Ensure `SPCX`, `OAI`, and `ANTH` link correctly.

---

### Backend / Data Model

#### [MODIFY] `backend/app/schemas.py` & `backend/app/database.py`
Introduce a `StockRadar` schema and a configuration mapping in the backend to calculate aggregated Radar sentiment (using simple average), total mentions, and historical trend points to return to the frontend.

## Verification Plan

### Manual Verification
- Review the aesthetic impact of the Radar cards in the dark-first palette on both mobile and desktop viewports. Ensure horizontal scroll feels native on mobile.
- Test the View Transitions morphing effect across different browsers.
- Ensure the `prefers-reduced-motion` media query correctly disables the view transitions and hover uplifts.
- Confirm the typography scale feels appropriately "oversized and confident" as per the frontend-design guidelines.
- Verify `OAI`, `ANTH`, and `SPCX` pseudo-tickers load without breaking standard ticker views.
