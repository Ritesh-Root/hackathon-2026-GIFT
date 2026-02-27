# Technology Stack & Tools

This document outlines the core technologies, libraries, and architectural decisions used in the **Antigravity AI Finance Copilot** project.

## 🚀 Core Stack
- **Frontend Framework**: [React 19](https://react.dev/) with functional components & hooks
- **Language**: [TypeScript](https://www.typescriptlang.org/) — end-to-end type safety
- **Build Tool**: [Vite 7](https://vite.dev/) — sub-second HMR, ES module-native bundling
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) (Postgres + Auth + Realtime + Edge Functions)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) — lightweight reactive stores

## 📈 Trading & Market Data
- **Live Market API**: [Groww Trading API](https://groww.in/) — real-time LTP, portfolio holdings, order placement, and balance
- **Service Layer**: Custom `growwService.ts` SDK with authenticated headers (`Bearer` + `X-API-SECRET`), proxied via Vite (`/api/groww`) to avoid CORS
- **Market Data Engine**: `marketService.ts` — overlays Groww live quotes onto historical data for real-time accuracy
- **Custom Hooks**: `useGrowwPortfolio.ts` — reactive portfolio state from Groww API

## 🧠 AI & Intelligence
- **AI Engine**: [Groq Cloud API](https://groq.com/) — ultra-low-latency inference
- **Models**: LLaMA-3-70B-8192 (deep analysis) and Mixtral-8x7b-32768 (rapid feedback)
- **AI Service Layer**: Custom `groqService.ts` for financial analysis, advisor responses, and prediction reasoning
- **Drastic Event Alerts**: Simulated real-time push notifications for critical market events via `useLiveEventAlert`

## 📊 Data Visualization
- **Charts**: [Apache ECharts](https://echarts.apache.org/) via `echarts-for-react` — candlestick, donut, bar, and gauge charts
- **Reactive Chart Engine**: All ECharts driven by `useMemo`-derived state — trade execution triggers instant chart re-renders
- **Real-time Ticker**: Custom 1-second `setInterval` engine for simulated NSE stock price updates on dashboard

## 🏗️ Architecture Patterns
- **Reactive Portfolio Engine**: Centralized `holdings` state → 6 `useMemo` hooks → auto-derived analytics (totalValue, PnL, return, allocation, sectors, risk score)
- **Persistent Paper Wallet**: `usePaperWallet` hook with `localStorage` persistence, cross-tab sync via `storage` events, and intra-app sync via custom `wallet_update` events
- **Trade Execution Flow**: `handleTrade()` → weighted avg cost recalculation (BUY) / partial/full liquidation (SELL) → instant chart + stat re-render
- **Service Layer Pattern**: All external APIs abstracted behind typed service modules (`growwService`, `marketService`, `groqService`, `supabaseService`)

## 🎨 UI/UX Design
- **Design Language**: "Linear/Vercel" aesthetic — deep blacks (`#050505`), glassmorphism, neon accents
- **Styling**: Vanilla CSS with modern design patterns:
  - **Glassmorphism**: `backdrop-filter: blur()` translucent panels
  - **Aurora Gradients**: Dynamic background aesthetics
  - **Neon Accents**: `#8B5CF6` (purple), `#00E676` (green), `#FF3B30` (red) glow effects
  - **Micro-animations**: 200ms ease-in-out transitions, hover-reveal action buttons
- **Icons**: [Lucide React](https://lucide.dev/) — 1000+ tree-shakeable SVG icons
- **Typography**: Inter / Outfit (UI) + JetBrains Mono (data/monospace)
- **Trade Execution Modal**: Premium glassmorphic overlay with order type toggle, massive quantity input, live cost estimation, and animated execution states

## 🛡️ Authentication & Persistence
- **Auth**: Supabase Auth (Email/Password) with Zustand store (`authStore.ts`) + demo mode bypass
- **Real-time Chat**: Supabase Realtime (Broadcast/Presence) for the Community page
- **Database Persistence**: Auto-syncing of Predictions, Portfolio Holdings, and Learning Progress via `supabaseService.ts`
- **Wallet Persistence**: `localStorage`-backed paper trading balance surviving page reloads

## 🎓 Gamified Learning
- **Paper Trading Simulator**: Candlestick chart + Copilot AI suggestions + live order execution
- **Skill Assessments**: Quiz engine with progress tracking and Supabase persistence
- **Virtual Balance**: Real-time wallet deduction/addition with order value previews

## 🛠️ Infrastructure
- **Dev Server**: Vite 7 with HMR and API proxying
- **Linting**: ESLint + TypeScript ESLint
- **Edge Functions**: Supabase Edge Functions (Deno) for Yahoo Finance proxy (`get-stock-data`)
- **Environment**: `.env.local` for API keys (Supabase, Groq, Groww)
