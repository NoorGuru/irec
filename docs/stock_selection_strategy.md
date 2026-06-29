# Stock Selection Strategy: Determining the Top 50 Priority Stocks

> **Author:** Aura Platform Architecture  
> **Date:** 2026-06-29  
> **Status:** Proposal — Pending Review  

---

## 1. Problem Statement

Aura's database contains ~400 unique tickers extracted from YouTube finance channels. We are introducing a **hybrid stock ingestion pipeline** that uses:

- **Twelve Data API** (Free Tier: 800 credits/day) for real-time intraday quotes on high-priority stocks.
- **yfinance** (unlimited, free) for daily End-of-Day (EOD) data on all remaining stocks.

We must select **50 stocks** for Tier 1 (Twelve Data) treatment. The remaining ~350 stocks receive Tier 2 (yfinance) coverage. This document evaluates three concrete approaches for making that selection and recommends the optimal long-term architecture.

---

## 2. Quota Math (Constraint)

| Parameter | Value |
|---|---|
| Twelve Data Free Tier | 800 credits/day |
| Tier 1 stocks | 50 |
| Market hours (EST) | 9:30 AM – 4:00 PM (6.5 hours) |
| Fetch interval | 30 minutes |
| Intraday intervals | 13 (9:30, 10:00, ..., 15:30) |
| Post-close final check (4:15 PM) | 1 |
| **Total intervals/day** | **14** |
| **Daily credit consumption** | **14 × 50 = 700** |
| **Headroom remaining** | **100 credits (12.5% safety margin)** |

✅ Comfortably within the 800 ceiling. The 100 leftover credits absorb retries and ad-hoc queries.

---

## 3. Option A: Composite "Priority Score" from Aura Metrics (Data-Driven)

### How It Works

Compute a `priority_score` for each ticker using signals **already in our database** — no external API calls needed:

```
priority_score = (
    0.30 × normalized_mention_count_30d     +   # How often analysts talk about it
    0.25 × normalized_analyst_count         +   # How many independent analysts cover it
    0.20 × normalized_avg_conviction        +   # How strongly analysts feel
    0.15 × recency_factor                   +   # How recently it was mentioned
    0.10 × abs(consensus_sentiment)             # Strength of directional signal
)
```

The top 50 by `priority_score` become Tier 1.

### Pros
- **Fully automatic** — no manual curation needed.
- **Reflects real user/analyst interest** — stocks that YouTube analysts actively discuss get priority.
- **Self-correcting** — a stock that falls out of analyst discourse naturally drops to Tier 2.
- **Leverages existing data** — zero new data sources or API calls required.

### Cons
- **Cold start risk** — a newly extracted ticker with only 1 mention starts at low priority, even if it's AAPL.
- **Bias toward "meme" stocks** — heavily discussed but low-conviction tickers (e.g., GME, AMC) could dominate.
- **Requires periodic re-computation** — the score must be refreshed (daily cron is sufficient).

### Implementation Cost
- **Low** — a single SQL query or Python function over the existing `recommendations` table.

---

## 4. Option B: Static "Must-Have" List + Database Flag (Curated)

### How It Works

Maintain a curated list of priority stocks via an explicit database column:

1. Add a `tier` column to a new `stock_meta` table (or directly to a ticker-level lookup).
2. Admin manually sets `tier = 1` for the 50 most important stocks (e.g., Mag 7, all radar tickers, S&P 500 top caps).
3. An admin UI or API endpoint allows toggling tier membership.

```sql
-- Example: stock_meta table
CREATE TABLE stock_meta (
    ticker       TEXT PRIMARY KEY,
    tier         SMALLINT NOT NULL DEFAULT 2,   -- 1 = Tier 1, 2 = Tier 2
    is_pinned    BOOLEAN DEFAULT FALSE,         -- Admin override
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Pros
- **Predictable** — you always know which 50 stocks are covered.
- **No cold start** — AAPL is always Tier 1 regardless of recent mention count.
- **Simple logic** — the pipeline just queries `WHERE tier = 1`.

### Cons
- **Manual maintenance** — someone must periodically review and update the list.
- **Doesn't adapt** — if a stock suddenly trends (e.g., post-earnings surprise), it won't auto-promote.
- **Admin burden** — requires building an admin UI for tier management.

### Implementation Cost
- **Low-Medium** — new table + admin endpoint, but no algorithmic complexity.

---

## 5. Option C: Hybrid — Pinned Core + Dynamic Ranking (Recommended ✅)

### How It Works

Combine Options A and B for maximum robustness:

1. **Pinned slots (up to 20):** Admin explicitly pins "must-have" stocks (e.g., Mag 7, AAPL, NVDA, TSLA). These are *always* Tier 1 regardless of score. This is also where radar constituents can be auto-pinned.
2. **Dynamic slots (remaining 30-50):** Fill the rest of the 50 slots using the `priority_score` algorithm from Option A, excluding already-pinned tickers.
3. **Nightly re-rank:** A daily cron (e.g., 6:00 AM EST, before market open) recomputes priority scores and refreshes the `stock_meta` table.

```
Tier 1 = pinned_tickers ∪ top_N_by_priority_score(50 - len(pinned_tickers))
Tier 2 = everything else
```

### Schema Design

```sql
CREATE TABLE stock_meta (
    ticker            TEXT PRIMARY KEY,
    tier              SMALLINT NOT NULL DEFAULT 2,   -- 1 or 2
    is_pinned         BOOLEAN NOT NULL DEFAULT FALSE, -- Admin override, immune to re-ranking
    priority_score    FLOAT NOT NULL DEFAULT 0.0,
    mention_count_30d INT NOT NULL DEFAULT 0,
    analyst_count     INT NOT NULL DEFAULT 0,
    last_mentioned_at TIMESTAMPTZ,
    last_price_update TIMESTAMPTZ,                   -- Last successful price ingestion
    last_updated_by   TEXT DEFAULT 'system',          -- 'system' or 'admin'
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_meta_tier ON stock_meta(tier);
CREATE INDEX idx_stock_meta_priority ON stock_meta(priority_score DESC);
```

### Promotion & Demotion Rules

| Event | Action |
|---|---|
| New ticker extracted with ≥3 analyst mentions in 7 days | Auto-promote to Tier 1 if slots available |
| Pinned ticker has 0 mentions in 90 days | Log warning, keep pinned (admin must manually unpin) |
| Dynamic Tier 1 ticker's score drops below threshold | Demote to Tier 2, replaced by next-highest scorer |
| Admin pins a new ticker | Immediately promoted; lowest-scoring dynamic ticker demoted if at capacity |

### Pros
- **Best of both worlds** — stability of a curated core + adaptiveness of algorithmic ranking.
- **Resilient** — critical stocks never get dropped accidentally.
- **Observable** — the `stock_meta` table serves as a transparent audit trail of tier decisions.
- **Scalable** — easily adjustable as the Twelve Data budget changes (e.g., paid tier = 200 Tier 1 stocks).

### Cons
- **Most complex** — requires both admin controls and scoring logic.
- **Slightly higher maintenance** than pure Option A, but dramatically less than pure Option B.

### Implementation Cost
- **Medium** — new table, scoring function, nightly cron, admin API endpoint.

---

## 6. Recommendation

### **Option C: Hybrid (Pinned Core + Dynamic Ranking)** is the recommended approach.

**Rationale:**
1. **Data-driven by default** — the majority of slots are earned by algorithmic merit.
2. **Human override when needed** — the admin pin system ensures flagship stocks are never dropped.
3. **Future-proof** — if you upgrade to a paid Twelve Data tier, just increase the slot count.
4. **Observability** — the `stock_meta` table is queryable, cacheable, and auditable.
5. **Aligns with existing architecture** — the scoring formula reuses the same signals already computed by `today_routes.py` and `radars_routes.py`.

### Initial Pinned Tickers (Recommended Starting Set)

The following 15 tickers should be pinned on day one — they represent the core portfolio of Aura's user base and are constituents of multiple radars:

```
AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA,
AMD, PLTR, COIN, LLY, CRM, NFLX, AVGO, ARM
```

The remaining 35 Tier 1 slots are filled dynamically by `priority_score`.

---

## 7. Data Flow Summary

```
6:00 AM EST (Nightly Cron)
    │
    ├─► Recompute priority_score for all ~400 tickers
    ├─► Preserve is_pinned = TRUE tickers in Tier 1
    ├─► Fill remaining Tier 1 slots with top scorers
    ├─► Update stock_meta table
    └─► Log tier changes (promotions/demotions)

9:30 AM – 4:00 PM EST (Every 30 min)
    │
    └─► Tier 1 Pipeline: Twelve Data API → 50 stocks
            │
            └─► On 429/timeout → fallback to yfinance

4:15 PM EST (Final Check)
    │
    └─► Tier 1 Pipeline: Twelve Data API → 50 stocks (closing price capture)

6:00 PM EST (EOD Batch)
    │
    └─► Tier 2 Pipeline: yfinance → ~350 stocks (End-of-Day data)
```
