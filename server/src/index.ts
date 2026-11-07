import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { AnthropicProvider } from './ai/anthropicProvider';
import { GeminiProvider } from './ai/geminiProvider';
import { MockProvider } from './ai/mockProvider';
import { SanitizingProvider } from './ai/sanitizingProvider';
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
import { userPlans, getUserTier, recordTransaction } from './data/store';

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // palm photos as base64

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
const aiProvider = new SanitizingProvider(selectedProvider);

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

// DEV-ONLY: there is no real payment/subscription integration yet (see README).
// This lets premium-gated flows be exercised and tested honestly instead of
// being permanently unverifiable. Must be removed once real entitlement
// verification (App Store/Play Billing receipt validation) is wired up.
if (process.env.NODE_ENV !== 'production') {
  app.post('/dev/set-tier', (req, res) => {
    const userId = (req.headers['x-demo-user'] as string) || 'demo-user';
    const tier = req.body?.tier === 'premium' ? 'premium' : 'free';
    const wasPremium = getUserTier(userId) === 'premium';
    userPlans.set(userId, { userId, tier });
    // Only record a transaction the first time a user is newly set to
    // premium, not on every call if they are already premium, so flipping
    // tier back and forth or re-calling this dev endpoint does not
    // double-count a subscription purchase.
    if (tier === 'premium' && !wasPremium) {
      recordTransaction(userId, 'premium_subscription');
    }
    res.json({ userId, tier });
  });
}
app.use('/palm', buildPalmRouter(aiProvider));
app.use('/companion', buildCompanionRouter(aiProvider));
app.use('/wellness', buildWellnessRouter(aiProvider));
app.use('/tarot', buildTarotRouter(aiProvider));
app.use('/astrology', buildAstrologyRouter(aiProvider));
app.use('/gemstone', buildGemstoneRouter(aiProvider));
app.use('/vastu', buildVastuRouter(aiProvider));
app.use('/assistant', buildAssistantRouter(aiProvider));
app.post('/admin/login', handleAdminLogin);
app.use('/admin', buildAdminRouter(aiProvider));

// Browser admin panel, password-gated (see admin.ts for the login/session
// mechanism and its prototype-grade caveats). Served at /admin-panel.
app.use('/admin-panel', express.static(path.join(__dirname, '../public/admin-panel')));

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`[solune] server listening on http://localhost:${port}`);
});
