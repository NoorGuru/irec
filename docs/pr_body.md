## ⚡ The Aura 10: Executive "Top 5-10 Stocks to Buy Now" Decision Engine

> **"Every stock analyst. One clear signal."**
> Solves the core user dilemma: *"With everything on this site, what are the top 5–10 stocks I should buy right now?"*

---

### 📸 Visual Demonstration & Real UI Screenshots

#### 1. Desktop Executive Radar (`HomeTopAlpha`) — Isolated Widget & In-Context
| The Aura 10 Focus | Full Homepage In-Context |
|:---:|:---:|
| ![The Aura 10 Desktop](https://raw.githubusercontent.com/bynoorbot/irec/feature/aura-10-top-buys/docs/screenshots/the_aura_10_desktop.png) | ![Homepage In Context](https://raw.githubusercontent.com/bynoorbot/irec/feature/aura-10-top-buys/docs/screenshots/homepage_in_context.png) |

#### 2. Today Executive Dossier (`/today`) & Syndicate Morning Memo
![Today Executive Brief](https://raw.githubusercontent.com/bynoorbot/irec/feature/aura-10-top-buys/docs/screenshots/today_executive_brief.png)

#### 3. Mobile Viewport (390px iPhone Responsive Layouts)
| Homepage — The Aura 10 Mobile | `/today` — Executive Dossier Mobile |
|:---:|:---:|
| ![The Aura 10 Mobile](https://raw.githubusercontent.com/bynoorbot/irec/feature/aura-10-top-buys/docs/screenshots/the_aura_10_mobile.png) | ![Today Dossier Mobile](https://raw.githubusercontent.com/bynoorbot/irec/feature/aura-10-top-buys/docs/screenshots/today_executive_brief_mobile.png) |

---

## 🎯 Architecture & Product Taxonomy

| Surface | Target Question | Primary Component | Lookback / Scope |
|---|---|---|---|
| **Homepage (`/`)** | *"What 5–10 stocks should I buy right now?"* | `<HomeTopAlpha />` | Curated Top 5/10 high-conviction buys with 1-sentence theses |
| **Today (`/today`)** | *"What are the top YouTube channels saying over the last 30 days?"* | `<TodayTopAlphaDossier />` | Pinned Syndicate Morning Memo + Toggle between Executive Brief and 30-Day Market Screener |
| **Explorer (`/explore`)** | *"I want to search, filter, and screen all 500+ stocks across all-time history."* | Full Market Screener | All-time historical universe with peek drawer |

---

## 🔬 Live Top 10 Ranking (Derived from Active 30-Day Data)

| Rank | Ticker | Name | Aura Score | Consensus Footprint | Agreement | 1-Sentence Executive Thesis |
|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **#01** | `TSM` | Taiwan Semiconductor | **81** | 5 Top Channels | **96%** | World's #1 foundry with uncontested packaging moat benefiting from AI chip demand across NVDA, AMD, Apple. |
| **#02** | `PLTR` | Palantir Technologies | **77** | 5 Top Channels | **80%** | Enterprise AIP scaling converting pipelines into multi-million ACV deals. |
| **#03** | `GOOGL` | Alphabet Inc. | **75** | 6 Top Channels | **81%** | Gemini enterprise benchmarks showing multi-modal frontier model lead with $400 avg target upside. |
| **#04** | `LLY` | Eli Lilly | **63** | 3 Top Channels | **95%** | $65B revenue (+45%) with blockbuster pipeline expansion. |
| **#05** | `UBER` | Uber Technologies | **56** | 4 Top Channels | **89%** | High cash flow generation and autonomous platform integration. |
| **#06** | `ALAB` | Astera Labs | **55** | 2 Top Channels | **88%** | AI connectivity chip demand accelerating with tier-1 hyperscalers. |
| **#07** | `NU` | Nu Holdings | **50** | 3 Top Channels | **85%** | Strong execution, US expansion, and fintech operating leverage. |

---

## ⚡ Technical Highlights

1. **Deterministic Alpha Ranking Engine (`src/lib/alpha-ranking.ts`)**:
   - Curated Alpha Gate ($\ge 3$ channels, $\ge 80\%$ agreement, high conviction, 14-day recency).
   - Alpha Priority Metric (APM) sorting with 3-stage relaxation waterfall to prevent empty states.
   - Dynamic investor archetype tagging (*Core Heavyweight*, *Growth Momentum*, *Target Upside*).

2. **Shared SWR Hook (`src/lib/hooks/useTodayPlays.ts`)**:
   - Synchronous `localStorage` hydration (`aura_today_plays_v3`) for **0ms instant first paints**.
   - HTTP ETag `304 Not Modified` network revalidation eliminates redundant bandwidth.
   - Shared between `/` and `/today` to ensure zero duplicate network calls.
   - Stabilized callback dependencies to eliminate unnecessary revalidation loops.

3. **Design System & Aesthetics**:
   - Brand signature: Pick **#01 TSM** receives the pulsing teal aura glow (`border-[#00D4AA]/40 shadow-[0_0_20px_rgba(0,212,170,0.12)]`).
   - Oversized Geist Mono for rank numbers, tickers, and percentages; Geist Sans for thesis prose.
   - Slide-out quick peek drawer allows inspecting individual creator quotes without losing scroll position.
   - No nested `<Link>` tags per project guidelines.

---

## 🧪 Verification & Build

- **Static Export**: Next.js 16.2.7 Turbopack static export completed cleanly. All 36 static pages and SSG paths generated with zero errors.
- **Type Check**: `npx tsc --noEmit` passed with 0 errors.
- **Specifications**: Architectural blueprint documented in `.kiro/specs/top-buys-executive-alpha.md`.
