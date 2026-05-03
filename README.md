# TruckSight

AI-powered junk removal volume estimation for teams that need accurate cubic yard estimates from photos.

## Features

- **Guided estimation workflow** - job type selection, truck size, agent notes, and photo markup
- **Client estimate mode** - junk removal, dumpster overflow, and dumpster cleanout jobs
- **Vendor verification mode** - compare vendor claims against independent AI estimates
- **Photo markup** - green/red scribbles, circles, and pins to include or exclude items
- **Full reasoning output** - items identified, scale reference, step-by-step math, confidence level, hidden volume, and photo quality
- **Truck translation** - every estimate includes an approximate fraction of the selected truck size
- **Calibration tracking** - log actual volumes after jobs to measure accuracy over time
- **PIN authentication** - simple team access control
- **PostgreSQL history** - all estimates saved with full detail when `DATABASE_URL` is configured

## Quick Start (Local)

1. Copy `.env.example` to `.env` and fill in your Gemini API key:

   ```bash
   cp .env.example .env
   # Edit .env with your GEMINI_API_KEY
   ```

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:10000 and enter your configured PIN.

Without a `DATABASE_URL`, the app uses in-memory storage. Estimates will not persist across restarts.

## Deploy to Render

### Option A: Blueprint

1. Push this repo to GitHub.
2. Go to https://dashboard.render.com/.
3. Click **New** -> **Blueprint** -> connect your repo.
4. Render reads `render.yaml` and creates the web service plus database.
5. Set these environment variables in the Render dashboard:
   - `GEMINI_API_KEY` - your Google Gemini API key
   - `APP_PIN` - PIN for your team

### Option B: Manual

1. Create a PostgreSQL database on Render.
2. Create a Web Service with Docker runtime.
3. Set environment variables:
   - `GEMINI_API_KEY` - required
   - `APP_PIN` - required
   - `SESSION_SECRET` - required in production; generate a strong random string
   - `DATABASE_URL` - copy from your Render PostgreSQL instance
   - `DATABASE_SSL` - use `no-verify` for Render managed Postgres if strict certificate validation fails

## API Cost

Each estimate uses Gemini with vision. Cost depends on the selected `GEMINI_MODEL`, number of images, image sizes, and whether markup overlays are included.

## Architecture

```text
public/           Frontend (vanilla HTML/CSS/JS)
  index.html      Single page app
  styles.css      All styles
  app.js          Client-side logic, photo markup, API calls
  verify.js       Vendor verification UI
server/           Backend (Node.js + Express)
  index.js        Express routes, auth, file upload
  gemini.js       Gemini estimate integration + system prompt
  verification.js Gemini vendor verification integration + prompt
  db.js           PostgreSQL (or in-memory fallback)
Dockerfile        Production container
render.yaml       Render deployment blueprint
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | - | Your Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model used for estimates and verification |
| `APP_PIN` | Yes | `1234` | PIN for team login |
| `SESSION_SECRET` | Production | - | Session encryption secret |
| `DATABASE_URL` | No | - | PostgreSQL connection string |
| `DATABASE_SSL` | No | strict TLS | Use `false` for local Postgres or `no-verify` for managed DBs that need it |
| `PORT` | No | `10000` | Server port |
