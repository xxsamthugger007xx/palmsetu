import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { buildCorsOptions, rateLimit } from './middleware/security';
import { reportError } from './ops/alerts';
import { startBackupScheduler } from './ops/backup';
import { startGuestCleanup } from './ops/guestCleanup';
import { enforceAiBudget, runWithAiUser, setBudgetProvider } from './ai/budget';
import { AnthropicProvider } from './ai/anthropicProvider';
import { GeminiProvider } from './ai/geminiProvider';
import { MockProvider } from './ai/mockProvider';
import { SanitizingProvider } from './ai/sanitizingProvider';
import { UsageTrackingProvider } from './ai/usageTracking';
import { buildPalmRouter } from './routes/palm';
import { buildCompanionRouter } from './routes/companion';
import { buildWellnessRouter } from './routes/wellness';
import { buildTarotRouter } from './routes/tarot';
import { tarotCatalogue } from './tarot/catalogue';
import { validateDeck } from './tarot/validateDeck';
import { buildAstrologyRouter } from './routes/astrology';
import { buildGemstoneRouter } from './routes/gemstone';
import { buildVastuRouter } from './routes/vastu';
import { buildAdminRouter, handleAdminLogin } from './routes/admin';
import { buildAssistantRouter } from './routes/assistant';
import { buildAuthRouter } from './routes/auth';
import { buildSoulmateRouter } from './routes/soulmate';
import { buildAppSessionRouter } from './routes/appSession';
import { buildStreakRouter } from './routes/streak';
import { buildBillingRouter } from './routes/billing';
import { buildConfigRouter } from './routes/config';
import { recordApiTiming } from './ops/apiMonitoring';
import { migrateVastuPropertiesIfNeeded } from './vastu/migratePropertyProfiles';
import { attachAuthContext } from './auth/middleware';
import { accountsById, vastuPropertiesById, revokedTokens, passwordResetsByHash } from './data/store';
import { bootstrapSuperAdminIfNeeded } from './auth/adminAuth';
import { backfillPsuIds } from './auth/psuId';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
// CSP is left off because the static admin panel uses inline scripts/styles.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(buildCorsOptions()));
app.use(rateLimit({ name: 'global', windowMs: 60_000, max: 300 }));

// Raw body is stashed alongside the parsed JSON - routes/soulmate.ts's Razorpay
// webhook must verify an HMAC against the exact bytes Razorpay sent.
const keepRawBody = (req: express.Request, _res: express.Response, buf: Buffer) => { req.rawBody = buf; };
// Only routes that accept images (palm photos / soulmate photos / admin uploads)
// get the large body limit; every other route is capped at 1 MB. The first
// matching parser consumes the body, so the global one below skips those paths.
app.use(['/palm', '/soulmate', '/admin'], express.json({ limit: '15mb', verify: keepRawBody }));
app.use(express.json({ limit: '1mb', verify: keepRawBody }));
// Resolves req.auth (real account / guest session / legacy demo-user) on
// every request - see auth/context.ts for the exact precedence. Mounted
// globally and before every route below, since it never rejects a request
// on its own (only requireAccount, used selectively per-route, does).
app.use(attachAuthContext);
// Carries the caller's id into the AI provider layer so spend can be attributed per user.
app.use(runWithAiUser);
// Real request-level timing/error-rate log, backing the admin panel's API Monitoring tab.
app.use(recordApiTiming);
app.use('/auth', buildAuthRouter());
app.use('/config', buildConfigRouter());

// Per-user cap on write/AI requests to the routes that call the (paid) AI provider.
const aiLimiter = rateLimit({ name: 'ai', windowMs: 60_000, max: 30 });
for (const prefix of ['/palm', '/companion', '/wellness', '/tarot', '/astrology', '/gemstone', '/vastu', '/soulmate', '/assistant']) {
  // Reads (GET) are cheap and the app fires many in parallel on screen load, so only
  // writes/AI generations (POST/PUT/PATCH/DELETE) count toward this cap.
  app.use(prefix, (req, res, next) => (req.method === 'GET' || req.method === 'HEAD' ? next() : aiLimiter(req, res, (e?: any) => (e ? next(e) : enforceAiBudget(req, res, next)))));
}

// Provider selection. AI_TEXT_PROVIDER=anthropic|gemini forces a choice (falls back to the mock provider
// if that provider's key is missing). Unset: Gemini if configured, then Anthropic, then the mock fallback.
// The palm PHOTO analysis (palmistry/visionDetector.ts) always uses Gemini regardless of this setting.
// Every real provider is wrapped in SanitizingProvider, which is the actual enforcement point for the
// app-wide no-em-dash rule on AI-generated content (prompt instructions alone are not reliably followed).
const requestedProvider = (process.env.AI_TEXT_PROVIDER ?? '').toLowerCase();
const providerName: 'gemini' | 'anthropic' | 'mock' =
  requestedProvider === 'anthropic' ? (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock')
  : requestedProvider === 'gemini' ? (process.env.GEMINI_API_KEY ? 'gemini' : 'mock')
  : process.env.GEMINI_API_KEY ? 'gemini'
  : process.env.ANTHROPIC_API_KEY ? 'anthropic'
  : 'mock';
const selectedProvider = providerName === 'gemini' ? new GeminiProvider()
  : providerName === 'anthropic' ? new AnthropicProvider()
  : new MockProvider();
setBudgetProvider(providerName);
// UsageTrackingProvider wraps the sanitized provider so every feature using
// this single shared `aiProvider` instance is instrumented automatically -
// see ai/usageTracking.ts for why this lives at the provider layer instead
// of inside any one feature.
const aiProvider = new UsageTrackingProvider(new SanitizingProvider(selectedProvider));

if (requestedProvider && providerName === 'mock') {
  console.warn(`[solune] AI_TEXT_PROVIDER=${requestedProvider} but its API key is not set - using MockProvider for AI responses.`);
} else if (providerName === 'mock') {
  console.warn('[solune] No GEMINI_API_KEY or ANTHROPIC_API_KEY set - using MockProvider for AI responses.');
} else {
  console.log(`[solune] Using ${providerName === 'gemini' ? 'GeminiProvider' : 'AnthropicProvider (Claude)'} for AI responses.`);
}

const deckCheck = validateDeck(tarotCatalogue);
if (!deckCheck.valid) {
  console.error('[solune] Tarot deck validation failed:', deckCheck.errors);
  throw new Error('Tarot deck failed validation at startup - refusing to serve an invalid deck.');
}
console.log(`[solune] Tarot deck validated: ${tarotCatalogue.length} cards.`);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.redirect('/admin-panel/'));

// The /dev/set-tier backdoor that used to live here has been removed now
// that real billing exists (routes/billing.ts's POST /billing/confirm-purchase,
// backed by RevenueCat server-side verification) - it was gated only by
// `NODE_ENV !== 'production'`, which turned out to still be true on the
// live Replit deployment, making it reachable by anyone who knew the URL
// and letting them grant themselves free Premium. Removed outright rather
// than re-gated, since there is no longer a legitimate reason for it to
// exist: premium-gated flows can be tested for real via a RevenueCat
// sandbox purchase instead.
app.use('/palm', buildPalmRouter(aiProvider));
app.use('/companion', buildCompanionRouter(aiProvider));
app.use('/wellness', buildWellnessRouter(aiProvider));
app.use('/tarot', buildTarotRouter(aiProvider));
app.use('/astrology', buildAstrologyRouter(aiProvider));
app.use('/gemstone', buildGemstoneRouter(aiProvider));
app.use('/vastu', buildVastuRouter(aiProvider));
app.use('/soulmate', buildSoulmateRouter());
app.use('/app-session', buildAppSessionRouter());
app.use('/streak', buildStreakRouter());
app.use('/billing', buildBillingRouter());
app.use('/assistant', buildAssistantRouter(aiProvider));
app.post('/admin/login', handleAdminLogin);
app.use('/admin', buildAdminRouter(aiProvider));

// Browser admin panel, now backed by real admin_users/admin_sessions auth
// (see auth/adminAuth.ts). Served at /admin-panel.
app.use('/admin-panel', express.static(path.join(__dirname, '../public/admin-panel')));

// Public privacy policy page, served at /privacy - this is the URL to give
// Google Play Console / App Store Connect once palmsetu.com's DNS points
// at this deployment. Plain static file, no auth.
app.use('/privacy', express.static(path.join(__dirname, '../public/privacy')));

// Account deletion instructions, served at /delete-account - the URL Play
// Console's Data Safety form asks for, for users who want to delete their
// account without using the in-app flow (e.g. already uninstalled).
app.use('/delete-account', express.static(path.join(__dirname, '../public/delete-account')));

// Terms of Service, served at /terms - the URL Play Console's "App-level
// trader status and Terms of Service" page asks for.
app.use('/terms', express.static(path.join(__dirname, '../public/terms')));
// Password reset page opened from the emailed link (posts to /auth/reset-password).
app.use('/reset-password', express.static(path.join(__dirname, '../public/reset-password')));

// Public support page, served at /support - the Support URL App Store
// Connect / Play Console requires for the store listing. Plain static
// file, no auth.
app.use('/support', express.static(path.join(__dirname, '../public/support')));

// Provisions the first Super Admin from SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD
// if admin_users is empty (no-op otherwise), and assigns a permanent
// PSU-000001-style ID to every account that doesn't have one yet (no-op for
// accounts that already do). Both are safe to run on every boot.
bootstrapSuperAdminIfNeeded().catch((err) => console.error('[solune] admin bootstrap failed:', err));
const psuAssigned = backfillPsuIds([...accountsById.values()].map((a) => ({ id: a.id, createdAt: a.createdAt })));
if (psuAssigned > 0) console.log(`[solune] assigned Palm Setu User IDs to ${psuAssigned} account(s)`);

// Converts any Vastu property saved under the old fixed-room shape into
// the new per-instance rooms array (see vastu/migratePropertyProfiles.ts) -
// lossless, idempotent, safe to run on every boot.
const vastuMigrated = migrateVastuPropertiesIfNeeded(vastuPropertiesById);
if (vastuMigrated > 0) console.log(`[solune] migrated ${vastuMigrated} Vastu propert${vastuMigrated === 1 ? 'y' : 'ies'} to the new room-array format`);

// Last-resort error handling: a thrown/rejected route error becomes a clean JSON 500 (no stack leaked to clients)
// and is reported through ops/alerts. Express 5 forwards async handler rejections here automatically.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  reportError('route', err, { method: req.method, path: req.path, user: req.auth?.userId?.slice(0, 12) });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});
process.on('unhandledRejection', (reason) => reportError('unhandledRejection', reason));
process.on('uncaughtException', (err) => reportError('uncaughtException', err));

startBackupScheduler();
startGuestCleanup();

// Housekeeping: forget revoked tokens / used or expired reset links that can no longer matter.
for (const [k, v] of revokedTokens.entries()) if (v.exp && v.exp * 1000 < Date.now()) revokedTokens.delete(k);
for (const [k, v] of passwordResetsByHash.entries()) if (new Date(v.expiresAt).getTime() < Date.now() - 86_400_000) passwordResetsByHash.delete(k);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`[solune] server listening on http://localhost:${port}`);
});
