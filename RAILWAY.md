# Deploying The Walleye Wire on Railway

This guide walks you through connecting your GitHub repository to Railway for automatic deployments.

---

## Architecture on Railway

Railway runs a **single service** that handles everything:
- The Express API (`/api/*`)
- The React frontend (all other routes, served as static files with SPA fallback)

---

## Step 1 — Push to GitHub

If you haven't already, create a GitHub repository and push this codebase:

```bash
git remote add origin https://github.com/YOUR_USERNAME/walleye-wire.git
git push -u origin main
```

---

## Step 2 — Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `walleye-wire` repository
5. Railway will detect `railway.toml` and configure the build automatically

---

## Step 3 — Add a PostgreSQL Database

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway will provision a Postgres instance and automatically inject `DATABASE_URL` into your service environment

---

## Step 4 — Set Environment Variables

In your Railway service, go to **Variables** and add the following:

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | Your chosen admin password |
| `SESSION_SECRET` | A long random string (e.g. run `openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `NODE_ENV` | `production` |

> **`DATABASE_URL` and `PORT` are injected automatically by Railway — do not set them manually.**

---

## Step 5 — Apply the Database Schema

After your first successful deploy, open the Railway service shell (or run this locally with your Railway `DATABASE_URL`) to push the schema:

```bash
DATABASE_URL="<your-railway-database-url>" pnpm --filter @workspace/db run push
```

You can find your `DATABASE_URL` in the PostgreSQL plugin's **Variables** tab in Railway.

---

## Step 6 — Enable Auto-Deploy

Railway auto-deploys from your default branch by default. Every `git push` to `main` will trigger a new build and deploy.

To verify: go to your Railway service → **Settings** → **Source** and confirm the branch is set to `main`.

---

## Step 7 — First-Run Admin Setup

Once the app is live at your Railway URL:

1. Visit `https://your-app.up.railway.app/admin`
2. Log in with your `ADMIN_PASSWORD`
3. Run **Sync Shores & Islands Events** to populate the community calendar
4. Run **Initial Load (Full Backfill)** under Government Documents to import ordinances/resolutions from the Google Sheet
5. Run **AI Refresh** to fetch the first batch of local news stories

---

## Build Details

The `railway.toml` at the repo root controls the build:

- **Build**: installs pnpm dependencies, builds the React frontend, then compiles the API server
- **Start**: runs `node artifacts/api-server/dist/index.mjs`
- **Health check**: `GET /api/healthz`

---

## Troubleshooting

**Build fails with "Cannot find module"**
Make sure all environment variables in Step 4 are set before triggering a redeploy.

**App starts but API returns 500**
Check that `DATABASE_URL` is present in your service variables (it should be auto-injected by the PostgreSQL plugin).

**Frontend shows blank page**
The React build output is served from `artifacts/walleye-wire/dist/public/`. If the build step fails, this folder won't exist. Check Railway build logs for Vite errors.
