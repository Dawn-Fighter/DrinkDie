<div align="center">

# 🥤 Can Damage

### *log cans. farm aura.*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://monster-nine-eta.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

<br/>

**Track every can you crack. Watch your caffeine stack in real time. Climb the leaderboard. Flex completely unnecessary stats on your friends.**

[**→ Live Demo**](https://monster-nine-eta.vercel.app)

</div>

-----

## 🎯 Inspiration

Inspired by **[mandi.theeta.in](https://mandi.theeta.in)** — the idea that tracking something mundane with obsessive precision is its own kind of art. Can Damage takes that same philosophy and applies it to caffeine consumption. If you’re going to drink an irresponsible amount of Monster, you might as well have a leaderboard for it.

-----

## ✨ Features

- 🥫 **One-tap can logging** — register every Monster or Diet Coke you crack in seconds
- ⚡ **Live caffeine counter** — watch your total mg intake climb in real time via Supabase Realtime
- 🏆 **Global leaderboard** — compete against friends, see who’s topping the fridge
- 📊 **Personal stats** — deeply unnecessary but deeply satisfying consumption metrics
- 📱 **Responsive UI** — works on mobile, because you’re logging cans on the go

-----

## 🛠️ Tech Stack

|Layer       |Technology                           |Version|
|------------|-------------------------------------|-------|
|UI Framework|React                                |19     |
|Language    |TypeScript                           |~6.0   |
|Build Tool  |Vite                                 |8      |
|Styling     |Tailwind CSS                         |v4     |
|Backend & DB|Supabase (Postgres + Realtime)       |^2.106 |
|Testing     |Vitest + Playwright + Testing Library|latest |
|Deployment  |Vercel                               |—      |

-----

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- A **[Supabase](https://supabase.com)** project (free tier works fine)

### 1. Clone the repo

```bash
git clone https://github.com/Dawn-Fighter/DrinkDie.git
cd DrinkDie
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Get these from your Supabase project dashboard under **Settings → API**.

### 4. Run locally

```bash
npm run dev
```

Open <http://localhost:5173>.

-----

## 📁 Project Structure

```
DrinkDie/
├── public/                 # Static assets & OG images
├── src/
│   ├── components/         # Reusable UI components
│   ├── lib/                # Supabase client & helpers
│   └── main.tsx            # App entry point
├── .env.local              # Environment variables (not committed)
├── index.html
├── vite.config.ts          # Vite + Tailwind plugin config
├── vercel.json             # Vercel deployment config
└── package.json
```

-----

## 🧪 Testing

```bash
# Unit tests
npm test

# Lint
npm run lint

# Preview production build locally
npm run build && npm run preview
```

-----

## ☁️ Deployment

The project ships with a `vercel.json` for zero-config Vercel deployment.

**Steps:**

1. Fork / clone this repo
1. Import into [Vercel](https://vercel.com)
1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
1. Deploy

Or via CLI:

```bash
npx vercel --prod
```

-----

## 🤝 Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you’d like to change.

```bash
# 1. Fork the repo and create your branch
git checkout -b feat/your-feature

# 2. Commit your changes
git commit -m "feat: add your feature"

# 3. Push and open a PR
git push origin feat/your-feature
```

-----

## 📄 License

[MIT](./LICENSE) © [Dawn-Fighter](https://github.com/Dawn-Fighter)

-----

<div align="center">

*Drink responsibly. Track irresponsibly.*

</div>