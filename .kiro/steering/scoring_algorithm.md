# Aura & Omni Scoring Algorithm

This document outlines the calculation logic for the recommendation scores used in the platform (Aura Score, Omni Score, etc.). These scores determine how stock signals are ranked, filtered, and presented to users.

## 1. Core Score Calculation (`action_score_raw`)
Both the Aura Score and Omni Score are built on top of the same foundational raw score calculation algorithm. The raw score is a weighted sum of five key components, resulting in a value from 0 to 100.

**Component Weights:**
- **Sentiment (25%)**: How bullish or bearish the analysts are.
- **Conviction (20%)**: How confident the analysts are in their call (scale 1-10).
- **Agreement (20%)**: How much consensus there is among different analysts.
- **Recency (20%)**: How recently the recommendations were made.
- **Momentum (15%)**: How the sentiment is trending over time.

### A. Sentiment Score (25 points max)
Calculates a weighted average sentiment across all analysts for a given ticker, weighted by the channel's `trust_weight`.
- **Direction**: "BUY" if `consensus_sentiment >= 0` else "SELL".
- **Score Logic**:
  - `abs(sentiment) <= 1.0`: `50.0 + (abs(sentiment) * 25.0)`
  - `abs(sentiment) > 1.0`: `75.0 + ((abs(sentiment) - 1.0) * 25.0)`
  - Output is capped between 0 and 100.

### B. Conviction Score (20 points max)
Averaged conviction levels from all analysts for the given ticker.
- `conviction_score = avg_conviction * 10.0` (translates a 1-10 scale to 10-100).

### C. Agreement Percentage (20 points max)
Measures the standard deviation of sentiments across analysts to reward consensus.
- `stddev = statistics.pstdev(sentiments)`
- `agreement_pct = int(max(0, min(1, 1.0 - (stddev / 2.0))) * 100)`
- *Note*: If there is only 1 analyst, the standard deviation is 0, so agreement is automatically 100%.

### D. Recency Score (20 points max)
Decays exponentially based on the number of days since the most recent recommendation.
- `days_since_latest = (now - latest_pub_date).total_seconds() / 86400.0`
- `recency_score = exp(-max(0, days_since_latest) / 7.0) * 100.0`

### E. Momentum Score (15 points max)
Compares the average sentiment of the last 7 days vs older sentiments.
- **Both recent and older exist**: 
  - `delta = (avg_recent - avg_older) * direction_sign`
  - `momentum_score = 50.0 + (delta / 4.0) * 50.0`
- **Only recent exists**: `75.0`
- **Only older exists**: `25.0`

---

## 2. Analyst Multiplier Penalty
Once the raw score is calculated, a multiplier is applied to penalize signals backed by fewer independent analysts. This ensures that multi-analyst consensus floats to the top, while single-analyst picks have to be exceptionally strong to score well.

- **For BUY Signals**:
  - 1 Analyst: `0.60`
  - 2 Analysts: `0.72`
  - 3 Analysts: `0.85`
  - 4+ Analysts: `1.00`
- **For SELL Signals** (More forgiving as sell calls are rarer):
  - `min(1.0, 0.8 + 0.1 * analyst_count)`

*Calculation*: `action_score_raw = action_score_raw * analyst_multiplier`

---

## 3. The Two Scores: Aura vs Omni

### Omni Score (The "All-Time" Metric)
- **Timeframe**: Calculates the core score using **all historical data** for the ticker.
- **Purpose**: Represents the overall historical strength and long-term track record of the stock within the platform.
- **Logic**: Uses the core score + analyst multiplier on the all-time dataset.

### Aura Score (The "Actionable" Metric)
- **Timeframe**: Calculates the core score using only data from the **last 30 days**.
- **Historical Blending**: To prevent the 30-day score from being entirely blind to a stock's historical track record, the final Aura Score incorporates 15% of the all-time Omni Score.
- **Logic**:
  - `aura_score_raw = int(30-day action_score_raw)`
  - `Final Aura Score = int(0.85 * aura_score_raw + 0.15 * Omni Score)`

---

## 4. Signal Tiers & Filtering (Today's Picks)
For the "Today's Picks" view, plays are sorted and categorized into tiers based on the final Aura Score.

- **Strong Signal Tier**: `Aura Score >= 50`
- **Emerging Signal Tier**: `Aura Score >= 35`
- **Filtered Out**: `Aura Score < 35`

*Note: The frontend feed is strictly capped to return a maximum of the top 24 highest-scoring plays, ensuring the UI is never overwhelmed even if many tickers cross the threshold.*
