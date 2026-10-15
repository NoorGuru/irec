# Feature Spec: Top 5–10 Stocks to Buy Now ("The Aura 10")

**Tagline:** *Every stock analyst. One clear signal.*  
**Status:** Implemented & Verified  
**Date:** October 2026  

---

## 1. Overview & Problem Statement

Prior to this feature, Aura processed 1,400+ video recommendations and actively scored 156+ plays across 50+ YouTube channels in the trailing 30-day window. However, the site suffered from the **"Aggregator Trap"**:
- **Homepage (`/`)**: Displayed abstract market mood ratios and 3 spotlight cards (one of which was a Bearish SELL signal).
- **Today's Plays (`/today`)**: Presented a flat feed of 156 plays across 3 complex view modes (Grid, Stream, Terminal) with no distilled executive verdict.
- **Explorer (`/explore`)**: Presented the entire historical all-time database (500+ stocks).

A visitor arriving with capital ready to deploy could not find a quick, focused, direct answer to:
> *"What are the top 5 to 10 stocks to buy right now and why?"*

**The Aura 10** solves this by establishing a curated executive decision layer that extracts, filters, and ranks the highest-conviction buy plays from the trailing 30-day window, presenting them with 1-sentence theses, analyst consensus metrics, and price target upside.

---

## 2. Product Taxonomy & Mental Model

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. HOMEPAGE (/)                                                                        │
│    "The 10-Second Executive Answer"                                                    │
│    • Above-the-fold: Top 5 Highest-Conviction Buys from the 30-day window              │
│    • 1-sentence catalyst punchline, target upside, and consensus score                │
│    • One-click Archetype filters (Core Pillars, Growth Momentum, Target Upside)        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. TODAY (/today) — The 30-Day Active Horizon                                          │
│    "The Daily Action Floor & Full 30-Day Breakdown"                                    │
│    • PINNED AT TOP: "The Aura 10" Executive Brief with Syndicate Morning Memo          │
│    • MODE SWITCHER: [ ⚡ Executive Top 10 ] vs [ 💻 30-Day Market Screener (156 Plays) ]│
│    • Slide-out / Bottom-sheet Quick Peek Drawer for individual analyst quotes          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. EXPLORER (/explore) — The All-Time Database                                         │
│    "The Historical Screener & Search Library"                                          │
│    • Search all 500+ stocks ever tracked in Aura history                               │
│    • Custom multi-timeframe filters (All-Time, 30D, 7D, 24H)                           │
│    • Column sorting by market cap, sector, and target prices                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Quality Gate & Ranking Algorithm

Located in `frontend/src/lib/alpha-ranking.ts`.

### A. The Hard Gate (Tier-1 Quality)
A stock must satisfy all of the following to enter the Primary Top 10 candidate pool:
1. **Direction:** Strictly `BUY` (`consensus_sentiment >= 0.5`).
2. **Channel Diversity:** $\ge 3$ independent tracked channels.
3. **Consensus Agreement %:** $\ge 80\%$.
4. **Recency:** Trailing 30-day video window.
5. **Conviction Floor:** Average analyst conviction $\ge 55.0 / 100$.
6. **Aura Score Minimum:** $\ge 60$.

### B. Alpha Priority Metric (APM)
Used to rank candidates and resolve integer score ties:

$$\text{APM} = \text{Aura Score} + (0.05 \times \text{Agreement \%}) + (0.50 \times \min(10, \text{Analyst Count})) + (0.02 \times \text{Conviction}) + \text{Target Bonus}$$

**Deterministic Tie-Breaker Sequence:**
1. `APM` (descending)
2. `analyst_count` (descending)
3. `agreement_pct` (descending)
4. `recent_mentions` (descending)

### C. 3-Stage Relaxation Waterfall (Graceful Degradation)
Guarantees the list is **never** empty even during market panics or slow news weeks:
- **Stage 0 (Normal):** Full strict criteria ($\ge 3$ channels, $\ge 80\%$ agreement, $\ge 60$ Aura).
- **Stage 1 (Moderate):** If candidates $< 5$, relax to $\ge 2$ channels, $\ge 75\%$ agreement, $\ge 50$ Aura.
- **Stage 2 (Emergency):** If candidates $< 5$, relax to $\ge 1$ channel, $\ge 35$ Aura.

### D. Automatic Archetype Classifier
Classifies each Top 10 pick without manual tagging:
- **`Core Heavyweight`:** `analyst_count >= 5` AND `agreement_pct >= 85` AND `aura_score >= 68` (e.g., TSM, NVDA, GOOGL, AVGO).
- **`Target Upside`:** `avg_target_price > 0` AND `aura_score >= 60` (e.g., NFLX, MU).
- **`Growth Momentum`:** `conviction >= 65` OR `recent_mentions >= 3` (e.g., PLTR, LITE).

---

## 4. Performance & Systems Architecture

- **Static Export Friendly (`output: "export"`):** All computations run client-side in $< 0.2\text{ms}$.
- **Zero CLS & SWR Shared Caching:**
  - `useTodayPlays()` hook reads from `localStorage` (`aura_today_plays_v3`) synchronously upon mount for a **0ms instant first paint**.
  - Background network validation uses `If-None-Match` HTTP ETags. If the data has not changed, the server returns `304 Not Modified` ($< 50$ bytes).
  - Visiting the Homepage immediately warms the cache for `/today`, eliminating loading spinners between page transitions.

---

## 5. UI/UX Ergonomics & Design Standards

Abides by `.kiro/steering/frontend-design.md` and `GEMINI.md`:
- **Typography:** Oversized Geist Mono for rank numbers (`01`, `02`), tickers (`TSM`, `PLTR`), and metrics (`96% Agree`, `AURA 81`). Geist Sans for executive theses and company names.
- **The "Aura Glow":** The #1 ranked stock (`TSM`) features the brand signature pulsing teal aura border (`shadow-[0_0_20px_rgba(0,212,170,0.12)] border-[#00D4AA]/40`).
- **Mobile Ergonomics (390px):** Vertical stacked Action Strips (110px height, $\ge 48\text{px}$ touch targets), defaulting to Top 5 with an instant `[ Expand to Top 10 ]` toggle.
- **Desktop Ergonomics (1440px):** Dense Bloomberg-style terminal leaderboard with aligned tabular columns.
- **Slide-out Quick Peek Drawer:** Clicking any card opens a slide-out drawer displaying individual channel video quotes, transcripts, and target prices without losing scroll position.
- **No JSX Link Nesting:** Container `div` click handlers with `e.stopPropagation()` on inner buttons.

---

## 6. Key Files Changed & Added

- `frontend/src/lib/types.ts`: Extended with `Play`, `CatalystOpinion`, `VideoSummaryInfo`, `TodayPlaysData`, `TopAlphaPlay`, and `InvestorArchetype`.
- `frontend/src/lib/alpha-ranking.ts`: Pure quantitative filtering, APM ranking, archetype classification, and thesis synthesis engine.
- `frontend/src/lib/hooks/useTodayPlays.ts`: Shared SWR hook with `localStorage` instant hydrate and ETag 304 validation.
- `frontend/src/components/home/HomeTopAlpha.tsx`: Homepage executive module replacing legacy SpotlightCards.
- `frontend/src/components/today/TodayTopAlphaDossier.tsx`: Pinned executive dossier on `/today` with view switcher and Syndicate Morning Memo.
- `frontend/src/app/page.tsx`: Integrated `HomeTopAlpha` and `🔥 Top 10 Buys Now` hero pill.
- `frontend/src/app/today/page.tsx`: Integrated `TodayTopAlphaDossier` and session-persisted mode switching.
