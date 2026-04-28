# TruckSight

AI-powered junk removal volume estimation for teams that need accurate cubic yard estimates from photos.

## Features

- **Guided estimation workflow** — job type selection, reference object picker, photo markup
- **4 job modes** — Standard removal, Dumpster Cleanout, Dumpster Overflow, Vendor Truck Verification
- **Photo markup** — Green/red scribble to include/exclude items
- **Full reasoning output** — Items identified, scale reference, step-by-step math, confidence level
- **Truck translation** — Every estimate includes "approximately X/Y of a 15-yard truck"
- **Vendor verification** — Compare vendor claims against independent AI estimates
- **Calibration tracking** — Log actual volumes after jobs to measure accuracy over time
- **PIN authentication** — Simple team access control
- **PostgreSQL history** — All estimates saved with full detail

## Quick Start (Local)

1. Copy `.env.example` to `.env` and fill in your Anthropic API key:
   ```
   cp .env.example .env
   # Edit .env with your ANTHROPIC_API_KEY
   ```

2. Install and run:
   ```
   npm install
   npm run dev
   ```

3. Open http://localhost:10000 and enter PIN (default: `1234`)

Without a `DATABASE_URL`, the app uses in-memory storage (estimates won't persist across restarts).

## Deploy to Render

### Option A: Blueprint (recommended)

1. Push this repo to GitHub
2. Go to https://dashboard.render.com/
3. Click **New** → **Blueprint** → connect your repo
4. Render reads `render.yaml` and creates the web service + database
5. Set these environment variables in the Render dashboard:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `APP_PIN` — PIN for your team (change from default!)

### Option B: Manual

1. Create a **PostgreSQL** database on Render (free tier works)
2. Create a **Web Service** with Docker runtime
3. Set environment variables:
   - `ANTHROPIC_API_KEY` — required
   - `APP_PIN` — required (team login PIN)
   - `SESSION_SECRET` — generate a random string
   - `DATABASE_URL` — copy from your Render PostgreSQL instance

## API Cost

Each estimate uses Claude Sonnet 4 with vision. Typical cost per estimate:
- 1 photo, no markup: ~$0.03-0.05
- 3 photos with markup: ~$0.08-0.15
- 12 photos with markup: ~$0.25-0.40

## Architecture

```
public/           Frontend (vanilla HTML/CSS/JS)
  index.html      Single page app
  styles.css      All styles
  app.js          Client-side logic, photo markup, API calls
server/           Backend (Node.js + Express)
  index.js        Express routes, auth, file upload
  claude.js       Claude API integration + system prompt
  db.js           PostgreSQL (or in-memory fallback)
Dockerfile        Production container
render.yaml       Render deployment blueprint
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key |
| `APP_PIN` | Yes | `1234` | PIN for team login |
| `SESSION_SECRET` | Prod | — | Session encryption secret |
| `DATABASE_URL` | No | — | PostgreSQL connection string |
| `DATABASE_SSL` | No | `true` | Set to `false` for local Postgres |
| `PORT` | No | `10000` | Server port |
