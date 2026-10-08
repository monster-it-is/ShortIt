# ShortIt

ShortIt is a full-stack URL shortener with simple analytics.

## Monorepo Structure

```text
shortit/
  backend/   # Express Backend
  frontend/  # React app
```

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Axios
- Tailwind CSS
- React Router

### Backend

- Express
- TypeScript
- MongoDB + Mongoose
- JWT Bearer authentication

## Prerequisites

- Node.js 18+
- pnpm 10+
- A MongoDB connection string

This workspace may not be a Git repository yet. Create a local repo when you want a recoverable baseline:

```bash
git init
```

Do not commit `.env` files. Example env files (including `.env.production.example`) are safe to commit.

## Zero-cost deployment

ShortIt is prepared to run at **$0/month** on:

- **Frontend:** Render Static Site (free `*.onrender.com` HTTPS)
- **Backend:** Render Web Service, **Free** instance (uses `PORT` from Render)
- **Database:** MongoDB Atlas **Free (M0)**
- **Git / CI:** GitHub Free public repo + standard `ubuntu-latest` Actions runners

Exact runbook: [docs/deployment.md](docs/deployment.md). Pricing, quotas, sleep/cold-start behaviour, and Atlas IP allowlisting: [docs/zero-cost-hosting.md](docs/zero-cost-hosting.md).

Do not add a credit card, custom domain, paid Render plan, paid Atlas tier, Redis, or GitHub larger runners. The live demo is **not** always-on: the Free API sleeps after 15 minutes idle and the next request can take about a minute. Exhausted free quotas suspend the service rather than billing, as long as no payment method is on file.

Accounts, GitHub publishing, and Render/Atlas deploys are **not** performed from this repository until you authorize them.

## Environment Variables

Copy the examples, then fill in real values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend (`backend/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/shortit
JWT_SECRET=replace_with_a_strong_secret
PORT=8080
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

`CORS_ORIGIN` is a comma-separated allowlist of origins (no paths, no trailing slashes, never `*`). Production requires it to be set. Development defaults to `http://localhost:5173` if it is omitted. `JWT_SECRET` must be at least 16 characters (32 in production). The process binds `HOST` (default `0.0.0.0`) so Render can route to `PORT`.

Production templates: `backend/.env.production.example`, `frontend/.env.production.example`.

Optional:

- `TRUST_PROXY` — reverse-proxy hop count (for example `1` behind a single load balancer). Leave unset locally. Do not set `true`.
- `RATE_LIMIT_LOGIN_MAX` — login attempts per 15 minutes per IP (default 10 in production, 20 in development).
- `RATE_LIMIT_SIGNUP_MAX` — signups per 15 minutes per IP (default 5 in production, 10 in development).
- `RATE_LIMIT_RESOLVE_MAX` — public resolve requests per minute per IP (default 120 in production, 300 in development).

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

This direct API origin is the supported local setup and requires backend CORS. If `VITE_API_BASE_URL` is omitted, the frontend falls back to `/api`, which Vite proxies to `http://localhost:8080` during `pnpm run dev` only.

## Installation

```bash
cd backend
pnpm install

cd ../frontend
pnpm install
```

## Run Locally

```bash
cd backend
pnpm run dev
```

```bash
cd frontend
pnpm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173` (Vite uses `strictPort`, so it will fail instead of silently moving to 5174)
- Backend: `http://localhost:8080`
- Health: `http://localhost:8080/api/health`

Backend `dev` uses `tsx watch` so TypeScript changes reload without a separate compile step. Production:

```bash
cd backend
pnpm run build
pnpm start
```

## Tests

Backend and Playwright tests use an isolated in-memory MongoDB. They do not use your configured remote database.

```bash
cd backend
pnpm test
```

```bash
cd frontend
pnpm test
```

End-to-end (Chromium, real API, isolated Mongo, Vite on port 4173):

```bash
cd e2e
pnpm install
pnpm exec playwright install chromium
pnpm test
```

The E2E harness starts `mongodb-memory-server` (database `shortit-e2e`, not port 27017), Express on `127.0.0.1:18080`, a local destination server on `18081`, and Vite with `VITE_API_BASE_URL=http://127.0.0.1:18080/api`. `SHORTIT_E2E=true` refuses Atlas URIs and does not load `backend/.env`. First `mongodb-memory-server` run may download a MongoDB binary.

After the repo is public on GitHub, `.github/workflows/ci.yml` runs the same backend, frontend, and E2E checks on standard `ubuntu-latest` runners (free for public repositories).

## API Overview

Base API path: `/api`

### Meta

- `GET /api/health` - liveness check

### User routes

- `POST /api/user/signup` - create account
- `POST /api/user/login` - login and receive JWT
- `GET /api/user` - get current user + links (requires `Authorization: Bearer <token>`)

### Link routes

- `GET /api/link/resolve/:slug` - resolve short link and increment clicks
- `GET /api/link` - list current user's links (auth required)
- `POST /api/link/create` - create a short link (auth required)
- `POST /api/link/update` - update a link by slug (auth required)
- `DELETE /api/link` - delete a link by slug (auth required)

## Frontend Routes

- `/` - landing and auth flow
- `/home` - authenticated dashboard
- `/:slug` - resolves short URL and redirects

## Security notes

Authentication uses JWTs stored in `localStorage` (`shortit_token`) and sent as `Authorization: Bearer <token>`.

This matches the current SPA architecture and is convenient for a portfolio demo. Tokens in `localStorage` are readable by any JavaScript that runs on the page, so an XSS bug could steal a session. HttpOnly cookies would reduce that risk and would be a separate architectural change.

Passwords are hashed with bcrypt before storage. Emails are normalized. Signup and login require a valid email and a password of at least 6 characters.

The API applies Helmet headers, login/signup rate limits, and a generous public-resolve rate limit. Helmet on Express does **not** set a Content-Security-Policy for the Vite frontend. `render.yaml` sets CSP, HSTS, and related headers on the static site.

Short links may point at any http(s) URL. Scheme checks block `javascript:` and similar values; they do not prevent phishing on otherwise valid https sites.

## Notes

- Slugs allow lowercase letters, numbers, and hyphens.
- When no custom slug is provided, the backend generates one automatically.
- `pnpm` ignores dependency build scripts by default. This repo allowlists `bcrypt` via `pnpm.onlyBuiltDependencies`.
- Public short URLs are `{frontendOrigin}/{slug}`. Render rewrites unknown paths to `index.html` so those routes work on the static host.
- Behind Render, set `TRUST_PROXY=1`. Do not set `TRUST_PROXY=true`.
