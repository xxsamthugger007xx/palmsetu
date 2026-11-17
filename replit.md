# Run the backend on Replit

This repository has separate `server/` and `app/` projects. The configured Replit workflow runs only the Express backend; the Expo app is optional and is not started here.

## Backend

1. Install dependencies from the repository root:

   ```sh
   cd server
   npm install
   ```

2. Add these values in Replit Secrets before the first admin login:
   - `JWT_SECRET`
   - `SUPER_ADMIN_EMAIL`
   - `SUPER_ADMIN_PASSWORD` (at least 12 characters)

   On startup, the server creates the initial Super Admin only if no admin account exists yet. Keep credentials in Replit Secrets rather than committing them.

3. Add `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` in Replit Secrets to enable AI responses. If neither is set, the backend uses its mock AI provider. Turnstile and Razorpay variables are optional.

4. Start the **Start Backend** workflow, which runs:

   ```sh
   cd server && npm run dev
   ```

The API listens on port `4000`. The Replit port mapping exposes it on the app URL. Check `/health` for a health response and open `/admin-panel/` for the admin login.

The SQLite database is created automatically under `server/data/`; it does not require an external database.
