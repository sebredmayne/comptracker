# 🌟 Little Joys — Competitor Tracker

Tracks what competitors are doing across **Meta ads, YouTube, and Instagram** — all in one dashboard.

| Tracker | What it does |
|---|---|
| 📣 **Meta Ads** | Polls Meta Ad Library for competitor FB+IG ads. Ranks by estimated impressions. Extracts top hooks. Flags new creatives. |
| ▶️ **YouTube** | Fetches all videos from competitor channels. Flags 3x+ viral videos. Detects paid boosts. Detects influencer collabs. |
| 📸 **Instagram** | Scrapes competitor reels via Apify. Flags viral reels. Detects coauthor collabs, #ad tags, @mentions. |

---

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/sebredmayne/competitor-tracker.git
cd competitor-tracker
```

### 2. Install dependencies
```bash
npm run install:all
```
This installs both the server and client packages in one command.

### 3. Set up your API keys
```bash
cp .env.example .env
```
Open `.env` and fill in your keys (see [Getting API Keys](#getting-api-keys) below).

### 4. Run in development
```bash
npm run dev
```
- **Dashboard:** http://localhost:5173
- **API:** http://localhost:3001
- **Health check:** http://localhost:3001/api/health

### 5. Run the trackers manually (first time)
Once the server is running, hit these endpoints to populate data immediately without waiting for the daily cron:

```bash
curl -X POST http://localhost:3001/api/meta/run
curl -X POST http://localhost:3001/api/youtube/run
curl -X POST http://localhost:3001/api/instagram/run
```

Or just click the **▶ Run Now** button in each tracker's dashboard tab.

---

## Getting API Keys

### Meta Ad Library API
Free but requires an application.
1. Go to https://www.facebook.com/ads/library/api/
2. Apply for access (usually approved in 1–2 days)
3. Once approved, go to https://developers.facebook.com → Graph API Explorer
4. Generate a User Token with `ads_read` permission
5. Paste into `META_ACCESS_TOKEN` in your `.env`

> **Note:** Without this key, the Meta tracker won't run. The YouTube and Instagram trackers work independently.

### YouTube Data API v3
Free — 10,000 units/day, which is more than enough.
1. Go to https://console.cloud.google.com
2. Create or select a project
3. Enable **YouTube Data API v3**
4. Go to **Credentials → Create Credentials → API Key**
5. Paste into `YOUTUBE_API_KEY` in your `.env`

### Apify (Instagram)
Free tier includes $5/month of credits (~20 runs).
1. Go to https://apify.com and create a free account
2. Go to **Settings → Integrations → API token**
3. Paste into `APIFY_TOKEN` in your `.env`

**Estimated cost if you upgrade:** 8 brands × 30 reels/day × $1/1000 reels = ~$7/month

---

## Setting Up Competitor Accounts

Before running, update the competitor lists in each tracker file:

### Meta (`server/trackers/metaAds.js`)
```js
const TRACKED_BRANDS = [
  { name: 'Gritzo',       search_terms: ['Gritzo'] },
  { name: 'Slurrp Farm',  search_terms: ['Slurrp Farm'] },
  { name: 'Little Joys',  search_terms: ['Little Joys'] }, // your own brand
  // add/remove as needed
];
```

### YouTube (`server/trackers/youtubeTracker.js`)
```js
const TRACKED_CHANNELS = [
  { brand: 'Gritzo', channelId: 'UCxxxxxx', handle: '@gritzo' },
  // ...
];
```
Find channel IDs at https://commentpicker.com/youtube-channel-id.php

### Instagram (`server/trackers/instagramTracker.js`)
```js
const TRACKED_ACCOUNTS = [
  { brand: 'Gritzo', username: 'gritzo_sports' },
  // ...
];
```
Only public accounts can be scraped.

---

## Cron Schedule

Trackers run automatically once a day:

| Tracker | Time (IST) |
|---|---|
| Meta | 8:00 AM |
| YouTube | 9:00 AM |
| Instagram | 10:00 AM |

---

## Project Structure

```
little-joys-tracker/
├── .env.example              ← copy to .env and fill in keys
├── package.json              ← root scripts (npm run dev, install:all)
│
├── server/
│   ├── index.js              ← Express server + cron setup
│   ├── trackers/
│   │   ├── metaAds.js        ← Meta Ad Library poller
│   │   ├── youtubeTracker.js ← YouTube viral detector
│   │   └── instagramTracker.js ← Apify Instagram scraper
│   ├── db/
│   │   ├── metaDb.js         ← SQLite for Meta ads
│   │   ├── youtubeDb.js      ← SQLite for YouTube videos
│   │   └── instagramDb.js    ← SQLite for Instagram reels
│   ├── routes/
│   │   ├── metaRoutes.js
│   │   ├── youtubeRoutes.js
│   │   └── instagramRoutes.js
│   └── schedule/
│       ├── metaCron.js
│       ├── youtubeCron.js
│       └── instagramCron.js
│
├── client/                   ← Vite + React dashboard
│   ├── src/
│   │   ├── App.jsx           ← Main nav shell
│   │   └── components/
│   │       ├── meta/         ← Meta dashboard components
│   │       ├── youtube/      ← YouTube dashboard components
│   │       └── instagram/    ← Instagram dashboard components
│   └── package.json
│
└── data/                     ← SQLite databases (auto-created, gitignored)
    ├── meta_tracker.db
    ├── youtube_tracker.db
    └── instagram_tracker.db
```

---

## Deploying to Production

When you're ready to deploy (e.g. on a $5/month DigitalOcean droplet or Railway):

```bash
# Build the React app
npm run build

# Start the server (serves built React + API)
NODE_ENV=production npm start
```

The server will serve the built React app at `/` and the API at `/api/*`.

---

## API Reference

All endpoints return JSON.

| Endpoint | Description |
|---|---|
| `GET /api/health` | Check server status + which keys are set |
| `POST /api/meta/run` | Trigger Meta tracker run |
| `GET /api/meta/hooks?limit=10` | Top ad hooks by impressions |
| `GET /api/meta/ads?brand=Gritzo` | All ads, filterable |
| `GET /api/meta/ads/new` | New ads from latest run |
| `GET /api/meta/brands` | Per-brand ad summary |
| `POST /api/youtube/run` | Trigger YouTube tracker run |
| `GET /api/youtube/viral?brand=X` | Viral videos (3x+ avg views) |
| `GET /api/youtube/collabs` | Videos with collab signals |
| `GET /api/youtube/videos?sort=view_count` | All videos |
| `POST /api/instagram/run` | Trigger Instagram tracker run |
| `GET /api/instagram/viral` | Viral reels (3x+ avg views) |
| `GET /api/instagram/collabs` | Collab-flagged reels |
| `GET /api/instagram/collab-accounts` | Top external accounts in collabs |
| `GET /api/instagram/reels` | All reels |
