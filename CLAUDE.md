# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SchoolCFO is a SaaS financial management platform that replaces CFO functions for charter school leaders who lack accounting backgrounds. Target users are principals and executive directors who need to manage budgets without finance expertise.

Core features: budget monitoring, compliance tracking, board reporting, and AI-powered financial analysis.

**Design principle:** All UI must be jargon-free and surface the right information proactively. Users should never need accounting knowledge to understand what they're looking at. Prefer plain-language labels, contextual guidance, and clear calls to action over dense data tables or financial terminology.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test runner is configured yet.

## Architecture

**Stack:** Next.js 16 · App Router · TypeScript · Tailwind CSS v4 · Zustand · Recharts · Lucide React

**Routing:** All authenticated pages live in `app/(main)/` (route group). The group layout (`app/(main)/layout.tsx`) wraps every page with the fixed sidebar. `app/page.tsx` redirects to `/dashboard`.

**Routes:**
- `/dashboard` — Morning Briefing with charts and metric cards
- `/upload` — CSV/Excel drag-and-drop with upload history
- `/budget-analysis` — Category table with expandable CFO narrative panels
- `/grant-tracker` — Per-grant cards with progress bars (WA categorical grants)
- `/board-packet` — Generate and track monthly board financial reports
- `/ask-cfo` — Streaming Claude chat with school financial context injected
- `/settings` — School profile, important dates, grant management

**Upload pipeline — `lib/uploadPipeline.ts`:** Pure functions for file parsing and column mapping. `autoMapColumns()` matches header names to the four SchoolCFO fields (`category`, `budget`, `ytdActuals`, `fund`) via regex patterns. `isFullyMapped()` decides whether to skip the manual mapping UI. `applyMappings()` aggregates multi-row files by category and returns `MappedCategory[]`. No store dependencies — safe to unit-test in isolation.

**State — `lib/store.ts`:** Single Zustand store holds all app state: `schoolProfile`, `financialData` (with `categories[]` and `monthlySpend[]`), `grants[]`, `alerts[]`, `uploads[]`, `chatMessages[]`, `boardPackets[]`. Seeded with Cascade Charter Elementary test data so every page renders populated. `importFinancialData()` action accepts `MappedCategory[]`, runs variance analysis (burn rate vs. 7/12 pace), derives `alertStatus` and plain-English narratives for each category, regenerates `alerts[]`, and appends to `uploads[]`.

**AI chat — `app/api/chat/route.ts`:** POST endpoint that streams a Claude response. Builds a system prompt from the Zustand store snapshot (school profile, budget categories, grants, alerts) and returns a `text/plain` streaming response. Requires `ANTHROPIC_API_KEY` env var. Client-side streaming handled in `app/(main)/ask-cfo/page.tsx` via `ReadableStream` reader.

**Sidebar — `components/Sidebar.tsx`:** Client component (needs `usePathname` + `useStore`). Active nav item uses white background on the navy sidebar. Bottom of sidebar shows school name from store.

**Path alias:** `@/*` maps to the repo root.

**Tailwind v4:** Configuration is in CSS (`@theme inline` in `globals.css`), not `tailwind.config.js`. Sidebar color `#1e3a5f` and content background `#f8f9fa` are applied as arbitrary values (`bg-[#1e3a5f]`). PostCSS handled by `@tailwindcss/postcss`.

**ESLint:** Flat config format (`eslint.config.mjs`) using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Environment Variables

```
ANTHROPIC_API_KEY=   # Required for Ask Your CFO chat feature
```
