# 🌌 GEMINI & AI AGENT DIRECTIVES
*This file serves as the master "brain" and entry point for any AI agent working on the Aura (Noor/irec) project. Agents MUST read this file and abide by its principles.*

## 1. Project Mission: Aura
**Tagline:** *Every stock analyst. One clear signal.*
**Goal:** Build a highly premium, data-dense platform that aggregates stock conviction signals from top YouTube finance channels. The platform must feel futuristic, high-end, and deeply analytical without being overwhelming.

## 2. The Golden Rule of AI Contributions
**Before writing ANY code or making structural changes, you MUST read the specific steering documents located in `.kiro/steering/`.**
- For Frontend UI/UX tasks: Read `.kiro/steering/frontend-design.md`
- For Architecture/Backend tasks: Read `.kiro/steering/tech.md`
- For General Structure: Read `.kiro/steering/structure.md`

## 3. Core Frontend & Aesthetic Mandates
*(Read `frontend-design.md` for full details)*
- **Terminal Meets Bloomberg:** The design is dark, data-dense, but beautifully human. 
- **True Glassmorphism:** Never use basic blocky cards. Use deep backdrop blurs (`backdrop-blur-md`), translucent borders (`border-[#ffffff]/5`), and soft radial glows.
- **Typography is the UI:** Use **Geist Mono** for all tickers, numbers, and data points. Use **Geist Sans** for labels and paragraphs. 
- **Custom Palette Only:** Never use generic Tailwind colors (e.g. `bg-red-500`). Use the custom palette:
  - Background: `#0A0F1A`
  - Surfaces: `#141B2D`
  - Bullish (Teal): `#00D4AA` / `#00FFD0`
  - Bearish (Crimson): `#FF4D6A`
  - Text: `#F1F5F9` (Primary), `#8B95A8` (Muted)
- **Micro-Animations:** Use subtle hover uplifts (`hover:-translate-y-1`) and ambient glows. Make the UI feel *alive*.

## 4. Tech Stack Rules
*(Read `tech.md` for full details)*
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4.
  - *Critical Constraint:* The frontend compiles to a **Static Export** (`output: "export"`). Do not use Next.js dynamic edge functions, server actions, or Next.js Image Optimization (`next/image`).
  - *OpenGraph Constraint:* Because of `trailingSlash: true`, OG tags will break. Use the hidden API route `src/app/api/generate-og/route.tsx` to design the OG banner, then export it manually to `public/og.png`.
- **Backend:** FastAPI (Python 3.12+), Uvicorn, Supabase (PostgreSQL).

## 5. Agent Instructions for Updating This File
As the project evolves, the AI agent (Gemini) is responsible for automatically coming back to this `GEMINI.md` file and updating it with new core directives, architectural shifts, and newly discovered constraints. This file must always represent the single source of truth for AI context.
