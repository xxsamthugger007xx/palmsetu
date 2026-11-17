import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
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
import { buildBillingRouter } from './routes/billing';
import { migrateVastuPropertiesIfNeeded } from './vastu/migratePropertyProfiles';
import { attachAuthContext } from './auth/middleware';
import { accountsById, vastuPropertiesById } from './data/store';
import { bootstrapSuperAdminIfNeeded } from './auth/adminAuth';
import { backfillPsuIds } from './auth/psuId';

const app = express();
app.use(cors());
app.use(express.json({
  limit: '15mb', // palm photos as base64
  // Stashes the raw request body alongside Express's parsed JSON - needed
  // by routes/soulmate.ts's Razorpay webhook handler, which must verify an
  // HMAC signature against the exact raw bytes Razorpay sent, not a
  // re-serialized copy of the parsed object (whitespace/key-order
  // differences would break the signature check). Harmless for every
  // other route, which never reads req.rawBody.
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
// Resolves req.auth (real account / guest session / legacy demo-user) on
// every request - see auth/context.ts for the exact precedence. Mounted
// globally and before every route below, since it never rejects a request
// on its own (only requireAccount, used selectively per-route, does).
app.use(attachAuthContext);
app.use('/auth', buildAuthRouter());

// Provider precedence: Gemini first if configured, then Anthropic, then the
// mock fallback. Only one real provider is ever active at a time. Every real
// provider is wrapped in SanitizingProvider, which is the actual enforcement
// point for the app-wide no-em-dash rule on AI-generated content (prompt
// instructions alone are not reliably followed by the model).
const selectedProvider = process.env.GEMINI_API_KEY
  ? new GeminiProvider()
  : process.env.ANTHROPIC_API_KEY
    ? new AnthropicProvider()
    : new MockProvider();
// UsageTrackingProvider wraps the sanitized provider so every feature using
// this single shared `aiProvider` instance is instrumented automatically -
// see ai/usageTracking.ts for why this lives at the provider layer instead
// of inside any one feature.
const aiProvider = new UsageTrackingProvider(new SanitizingProvider(selectedProvider));

if (process.env.GEMINI_API_KEY) {
  console.log('[solune] Using GeminiProvider for AI responses.');
} else if (process.env.ANTHROPIC_API_KEY) {
  console.log('[solune] Using AnthropicProvider for AI responses.');
} else {
  console.warn('[solune] No GEMINI_API_KEY or ANTHROPIC_API_KEY set - using MockProvider for AI responses.');
}

const deckCheck = validateDeck(tarotCatalogue);
if (!deckCheck.valid) {
  console.error('[solune] Tarot deck validation failed:', deckCheck.errors);
  throw new Error('Tarot deck failed validation at startup - refusing to serve an invalid deck.');
}
console.log(`[solune] Tarot deck validated: ${tarotCatalogue.length} cards.`);

app.get('/health', (_req, res) => res.json({ ok: true }));

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

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`[solune] server listening on http://localhost:${port}`);
});
