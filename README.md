# Solune (placeholder brand name)

AI palmistry, self-discovery & mental wellness app. Monorepo with two packages:

- `app/` — Expo (React Native + TypeScript) mobile client.
- `server/` — Node + TypeScript + Express backend. Holds all AI provider keys;
  the mobile app never talks to AI providers directly.

## Running locally

```bash
# backend
cd server
cp .env.example .env   # add ANTHROPIC_API_KEY to get real AI responses; omitted = mock replies
npm run dev             # http://localhost:4000

# mobile app (separate terminal)
cd app
cp .env.example .env
npm start               # Expo dev server — press i/a/w, or scan the QR with Expo Go
```

## Structure & key decisions

- **Design system**: `app/src/theme/tokens.ts` — all colors/spacing/type as tokens,
  swap-friendly for rebranding away from the `Solune` placeholder name.
- **Palm analysis is a replaceable pipeline**: `server/src/palmAnalysis/` separates
  image analysis (`PalmImageAnalyzer` interface) from LLM interpretation
  (`interpretationService.ts`). The current analyzer (`PrototypePalmAnalyzer`) is
  explicitly **not** real line/landmark detection — see its README for how to
  swap in a real CV implementation without touching routes or the app.
- **AI provider layer**: `server/src/ai/` — `AiProvider` interface, with an
  Anthropic-backed implementation and a key-free `MockProvider` for local dev.
  Wellness and palmistry chat use separate system prompts
  (`server/src/ai/systemPrompts.ts`) with shared crisis-safety rules.
- **No secrets on-device**: the mobile app only calls our own backend
  (`app/src/services/api.ts`); API keys live in server env vars only.
- **Honesty constraint**: the UI and prompts are written to never claim a line was
  detected when it wasn't, and never promise guaranteed outcomes (wealth, lifespan,
  relationships, medical outcomes).

## Not yet implemented (next steps)

- Authentication / persistent user accounts (currently a single `demo-user`).
- Persistent database (currently in-memory `server/src/data/store.ts` — resets on restart).
- Real palm landmark/crease detection (see `server/src/palmAnalysis/README.md`).
- Subscriptions / IAP (RevenueCat or native StoreKit/Play Billing integration).
- Push notifications, localization beyond English, journal encryption at rest.
