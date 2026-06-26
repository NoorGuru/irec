# Goal Description

The goal is to design and plan a highly premium, data-dense "Stock Radars" feature. This feature will aggregate specific radars (e.g., Mag 7, MANGOS, AI Infrastructure) and track their collective sentiment from YouTube analysts. It will follow the "Terminal Meets Bloomberg, but Human" aesthetic, leveraging modern web features like View Transitions, true glassmorphism, and distinctive typography.

## Open Questions Resolved
- **Terminology:** We are officially using **Radars** instead of "Groups." 
- **Data Aggregation:** We will use a **Simple Average** for the Radar's sentiment pulse. This treats all entities in the Radar equally, preventing massive companies from overshadowing smaller, highly discussed companies.
- **Navigation (Bento Grid):** A "Bento Grid" is a modern, asymmetrical grid layout (like a Japanese bento box) where some cards might be wider or taller than others to create visual interest. For desktop, this looks like a beautiful mosaic of glass cards on the homepage. On mobile, these will gracefully stack vertically into standard, easy-to-tap cards.

## Proposed Feature & Radars

### 1. Curated Premium Radars
- **The Mag 7:** AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA. *(Aura: Golden/Purple)*
- **MANGOS (The AI Frontier):** META, Anthropic, NVDA, GOOGL, OpenAI, SpaceX. *(Aura: Crimson/Void)*  
  *(Note: Even though Anthropic and OpenAI are private, our platform can still track when YouTubers mention them alongside public counterparts. SpaceX is recently public.)*
- **AI Infrastructure & Hardware:** AMD, SMCI, TSM, ASML, ARM, PLTR, MU. *(Aura: Electric Blue)*
- **GLP-1 & Bio (The Weight Loss Boom):** LLY, NVO, AMGN, VKTX. *(Aura: Bio-Green)*
- **Bitcoin Proxies:** MSTR, COIN, MARA, RIOT, IBIT. *(Aura: Crypto Orange)*
- **Defense & Aero:** LMT, RTX, NOC, GD. *(Aura: Tactical Amber)*

### 2. UI / UX Placement

- **Homepage Dashboard Feature:** 
  - **Desktop:** A sleek "Bento Grid" (mosaic of glass cards) located prominently on the homepage, acting as a portal to these Radars.
  - **Mobile:** A vertically stacked list of beautifully padded, high-touch-target cards.
- **The Radars Index Page (`/radars`):** A dedicated page listing all available curated Radars.
- **The Radar Detail Page (`/radars/[slug]`):** A dedicated page that shows:
  1. The aggregated "Sentiment Pulse" of the entire Radar.
  2. The top videos discussing this specific Radar.
  3. A breakdown of the constituent stocks/companies (similar to the main table, but filtered).
- **Connecting Current Stocks to Radars:** On an individual ticker's detail page (e.g., `/ticker/AAPL`), we will add an elegant, pill-shaped glassmorphic tag: `[ ✦ Part of the Mag 7 Radar ]`. Clicking this pill navigates to the Radar page.

### 3. Making Them Unique (Modern Web & Frontend Design)

- **View Transitions (`same-document-transitions`):** We will use the View Transitions API so that when a user clicks a Radar card on the homepage, the card smoothly morphs and expands into the hero section of the Radar detail page. This provides a deeply native, app-like feel.
- **Ambient Auras:** Each Radar gets its own subtle, custom color variable (e.g., `--aura-mag7: #FFD700`). We will use a soft radial gradient (`radial-gradient`) in the background of their cards and headers, fading cleanly into the `#0A0F1A` base background.
- **True Glassmorphism:** Radar cards won't be solid blocks. They will use deep backdrop blurs (`backdrop-blur-xl`), translucent borders (`border-white/5`), and a subtle hover uplift (`hover:-translate-y-1 hover:border-white/10`) to feel like panes of glass floating in the terminal.
- **Big Typography:** The Radar names will use oversized **Geist Sans** (e.g., `text-5xl tracking-tight`), while the constituent tickers will be listed in **Geist Mono** for that high-end data feel. 

## Proposed Changes

---

### Frontend / UI Architecture

#### [NEW] `src/app/radars/page.tsx`
The main index of all Radars, featuring the grid layout of Radar cards.

#### [NEW] `src/app/radars/[slug]/page.tsx`
The dynamic detail page for a specific Radar. Will reuse the main table component but filter data to only show the Radar's stocks.

#### [NEW] `src/components/ui/radar-card.tsx`
A highly polished, glassmorphic card component for displaying a Radar. Includes the custom radial aura and the Radar's aggregated sentiment pulse bar.

#### [MODIFY] `src/app/page.tsx`
Inject the "Trending Radars" section (Bento grid on desktop, stacked on mobile) at the top of the main dashboard to drive discovery.

#### [MODIFY] `src/app/ticker/[symbol]/page.tsx`
Add the `[ ✦ Part of the <Radar Name> Radar ]` relational tags to the ticker header.

---

### Backend / Data Model

#### [MODIFY] `backend/app/schemas.py` & `backend/app/database.py`
Introduce a `StockRadar` schema and a configuration mapping in the backend to calculate aggregated Radar sentiment (using simple average) and return it to the frontend.

## Verification Plan

### Manual Verification
- Review the aesthetic impact of the Radar cards in the dark-first palette on both mobile and desktop viewports.
- Test the View Transitions morphing effect across different browsers.
- Ensure the `prefers-reduced-motion` media query correctly disables the view transitions and hover uplifts.
- Confirm the typography scale feels appropriately "oversized and confident" as per the frontend-design guidelines.
