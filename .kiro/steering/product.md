# Product Overview

**YTPortfolio (Aura)** is a monorepo application that extracts stock recommendations from YouTube video transcripts using AI (Claude) and presents aggregated sentiment data on a public dashboard.

## Core Workflow

1. Admin authenticates via Google OAuth (Supabase Auth, owner-only)
2. Admin submits a YouTube URL through the ingestion interface
3. Backend pipeline: URL parse → duplicate check → metadata fetch → transcript fetch → LLM extraction → database persistence
4. Public dashboard displays aggregated consensus sentiment per ticker, weighted by channel trust

## Key Concepts

- **Consensus Sentiment**: Weighted average of analyst sentiment (-2 to +2), dampened by confidence factor based on mention count
- **Trust Weight**: Per-channel multiplier applied to sentiment scores during aggregation
- **Conviction Level**: 1–10 scale indicating how strongly an analyst recommends a stock
- **Extraction Pipeline**: Sequential stages with structured error handling and rollback on failure

## Users

- **Owner/Admin**: Single authorized user who ingests videos
- **Public visitors**: View the aggregated recommendations dashboard (read-only via Supabase RLS)
