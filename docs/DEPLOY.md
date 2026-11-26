# Deploying Palm Setu (backend + Android app)

Two parts: the **backend** (a Node server with a SQLite database and palm photos on disk) and the **Android app** (built with EAS).
Do the backend first, because the app is built pointing at its address.

## Before you start: accounts and keys you need

| You need | For | Where |
|---|---|---|
| A domain (e.g. `palmsetu.com`) | `api.palmsetu.com` for the backend, and the Terms/Privacy links | any registrar |
| Anthropic API key | chat and readings | console.anthropic.com |
| Google (Gemini) API key | palm photo analysis | aistudio.google.com |
| Cloudflare Turnstile keys (site + secret) | bot check on sign-in | dash.cloudflare.com → Turnstile |
| Email provider key (Resend or Brevo) + a verified sending domain | verification and password-reset emails | resend.com / brevo.com |
| RevenueCat project + Google Play subscription products | payments | app.revenuecat.com |
| Sentry project (optional, recommended) | crash reports from phones | sentry.io |
| Google Play Console account ($25) | publishing | play.google.com/console |

## Part 1 - the backend

The backend needs: HTTPS, one **persistent disk** (the database, palm photos and backups live in `DATA_DIR`), and a `.env` with your keys.
`server/.env.production.example` lists every setting with comments.

### Option A - a small Linux server (a VPS) with Docker  *(simplest to reason about)*
Any 1 GB / 1 vCPU server is enough to start (Hetzner, DigitalOcean, AWS Lightsail...).

1. Point a DNS **A record** `api.yourdomain.com` at the server's IP.
2. On the server: install Docker, then `git clone https://github.com/xxsamthugger007xx/palmsetu` and `cd palmsetu/server`.
3. `cp .env.production.example .env` and fill it in (`PUBLIC_BASE_URL=https://api.yourdomain.com`, `JWT_SECRET` from `openssl rand -hex 32`, all keys).
4. Put your domain in `Caddyfile` (replace `api.example.com`).
5. `docker compose up -d --build`. Caddy fetches the HTTPS certificate on its own.
6. Check: `https://api.yourdomain.com/health` shows `{"ok":true}` and `https://api.yourdomain.com/privacy/` loads.

Update later with `git pull && docker compose up -d --build`. Data stays in the `palmsetu-data` volume.

### Option B - a managed host that builds the `Dockerfile` (Fly.io, Railway, Render)
Pick one that offers a **persistent volume**; free tiers without one will lose your database on every restart.
- Build from `server/Dockerfile`, expose port 4000.
- Mount a volume at `/data` (`DATA_DIR=/data` is already the default in the image).
- Set the variables from `.env.production.example` in the host's secrets screen.
- Attach your domain; the host provides HTTPS.
- Run **one instance only**: SQLite is a single-file database and cannot be shared between servers.

### After it is running
- Open `https://api.yourdomain.com/admin-panel/` and sign in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.
  Then change that password and consider restricting `/admin-panel` and `/admin/` to your own IP (see `Caddyfile`).
- Admin panel → **System Health**: confirm "Newest backup" is recent. Set `BACKUP_DIR` to a **different disk** (or sync `/data/backups` to cloud storage) so one failed disk cannot take the backups with it.
- Set `ALERT_WEBHOOK_URL` (a Slack/Discord webhook) so server errors reach you.
- Sign up with a real email and check the verification email arrives.
- Make sure `TAROT_UNLIMITED_DAILY_REVEALS` and `ALLOW_DEMO_USER_HEADER` are **not** set.

### Restoring from a backup
Stop the server, copy a file from `/data/backups/solune-YYYYMMDD-HHMMSS.db` over `/data/solune.db` (delete `solune.db-wal` and `solune.db-shm`), copy `/data/backups/palmImages` back to `/data/palmImages`, start the server.

## Part 2 - the Android app

1. In `app/`, set production values (EAS reads them at build time). Either put them under `build.production.env` in `eas.json`, or add them as EAS environment variables:
   - `EXPO_PUBLIC_API_URL=https://api.yourdomain.com`
   - `EXPO_PUBLIC_LEGAL_BASE_URL=https://api.yourdomain.com` (or your website)
   - `EXPO_PUBLIC_TURNSTILE_SITE_KEY=...`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...`
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=...`
   - `EXPO_PUBLIC_SENTRY_DSN=...` (optional)
2. **Google sign-in for the Play version:** after your first Play upload, open Play Console → *Protected with Play → App signing* and copy the **SHA-1**. In Google Cloud Console (project `palmsetu`) create an **Android OAuth client** with package `com.palmsetuapp.android` and that SHA-1, add its ID to `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and to the backend's `GOOGLE_CLIENT_IDS`, and publish the OAuth consent screen (out of "Testing").
3. Build: `cd app && npx eas-cli build --platform android --profile production` (makes an `.aab`).
4. Upload the `.aab` to Play Console → **Internal testing**, add yourself as a licence tester, and test a real purchase (see `docs/DEVICE_TEST_CHECKLIST.md`).
5. New personal Play accounts must run a **closed test with at least 12 testers for 14 days** before production access. Start this early.

## Release checklist
- [ ] Backend reachable over HTTPS, `/health` ok, backups visible in the admin panel
- [ ] Verification email arrives; password reset works
- [ ] Turnstile keys set (backend secret + app site key)
- [ ] RevenueCat products live; a test purchase unlocks Premium and survives reinstall
- [ ] Google sign-in works from the Play-signed build
- [ ] Privacy URL, Terms URL and account-deletion URL open on your real domain (`/privacy`, `/terms`, `/delete-account`)
- [ ] Play Console: store listing, Data safety form, content rating, target audience (13+), health/entertainment disclaimer
- [ ] Hindi (and other) translations reviewed by a native speaker (`docs/hindi-review.csv`)
- [ ] Sentry DSN set; trigger a test error and see it arrive
