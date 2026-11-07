import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import {
  assistantConversationsById, assistantUsageLog, AssistantConversation, getUserTier,
} from '../data/store';
import { assistantConfig } from '../data/assistantConfig';
import { buildAssistantReply, AssistantReplyResult, StageEvent } from '../assistant/responseBuilder';
import { retrieveUserData, hasDataFor } from '../assistant/dataRetrieval';

/** Same TEMPORARY testing shim as every other route in this app: no real
 * auth exists yet, identity comes from the x-demo-user header. */
function currentUserId(req: any): string {
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

const messageSchema = z.object({
  conversationId: z.string().nullable(),
  message: z.string().trim().min(1).max(2000),
  // Which screen the user opened the assistant from, e.g. 'tarot'. Purely a
  // hint for intent detection when the message text itself is ambiguous -
  // never trusted for entitlement decisions, and carries no user data.
  screenContext: z.enum(['tarot', 'astrology', 'gemstone', 'vastu', 'palm']).optional().nullable(),
});

/**
 * Simple in-memory rate limit on /assistant/message, mirroring the login
 * rate-limiting pattern in routes/admin.ts: a fixed-size sliding window of
 * timestamps per userId. Per-process only, resets on restart, same caveat as
 * every other in-memory mechanism in this app.
 */
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const messageTimestampsByUser = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = (messageTimestampsByUser.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    messageTimestampsByUser.set(userId, timestamps);
    return true;
  }
  timestamps.push(now);
  messageTimestampsByUser.set(userId, timestamps);
  return false;
}

/** Shared by both /message and /message/stream: finds-or-creates the
 * conversation, appends the user turn, and returns it ready for a reply to
 * be appended. Extracted so the two routes never duplicate persistence
 * logic. */
function loadOrCreateConversation(userId: string, conversationId: string | null, message: string) {
  let id = conversationId;
  let conversation = id ? assistantConversationsById.get(id) : undefined;
  if (conversation && conversation.userId !== userId) {
    return { error: 'not_found' as const };
  }
  if (!conversation) {
    id = uuid();
    conversation = { id, userId, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    assistantConversationsById.set(id, conversation);
  }
  conversation.messages.push({ role: 'user', content: message, createdAt: new Date().toISOString() });
  return { conversation };
}

/** Shared by both /message and /message/stream: appends the assistant turn,
 * updates conversation timestamps, and records the usage log entry exactly
 * once per reply, regardless of which route produced it. */
function persistReply(
  conversation: AssistantConversation,
  userId: string,
  result: AssistantReplyResult,
  latencyMs: number,
) {
  conversation.messages.push({
    role: 'assistant', content: result.reply, detectedFeature: result.detectedFeature,
    premiumCard: result.premiumCard, createdAt: new Date().toISOString(),
  });
  conversation.updatedAt = new Date().toISOString();

  assistantUsageLog.push({
    id: uuid(),
    userId,
    conversationId: conversation.id,
    detectedFeature: result.detectedFeature,
    estimatedInputTokens: result.estimatedInputTokens,
    estimatedOutputTokens: result.estimatedOutputTokens,
    estimatedCostCents:
      (result.estimatedInputTokens / 1000) * 0.3 + (result.estimatedOutputTokens / 1000) * 1.5,
    latencyMs,
    success: result.success,
    premiumCardShown: !!result.premiumCard,
    createdAt: new Date().toISOString(),
    intentDetectionMs: result.timings?.intentDetectionMs,
    dataRetrievalMs: result.timings?.dataRetrievalMs,
    timeToFirstTokenMs: result.timings?.timeToFirstTokenMs,
    generationMs: result.timings?.generationMs,
    mode: result.mode,
  });
}

function ownedConversationOr404(res: any, userId: string, id: string): AssistantConversation | undefined {
  const convo = assistantConversationsById.get(id);
  if (!convo || convo.userId !== userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return undefined;
  }
  return convo;
}

export function buildAssistantRouter(aiProvider: AiProvider) {
  const router = Router();

  router.get('/config', (_req, res) => {
    // Public, read-only subset the app's chat UI needs for its welcome text.
    res.json({ name: assistantConfig.name, welcomeMessage: assistantConfig.welcomeMessage });
  });

  router.get('/suggested-questions', (req, res) => {
    const userId = currentUserId(req);
    const data = retrieveUserData(userId);
    const questions: string[] = [];
    if (hasDataFor('tarot', data)) questions.push('What does my latest tarot card mean?');
    if (hasDataFor('astrology', data)) questions.push("What's today's horoscope based on my chart?");
    if (hasDataFor('gemstone', data)) questions.push('Why was this gemstone recommended for me?');
    if (hasDataFor('vastu', data)) questions.push('Which room in my property needs the most attention?');
    if (hasDataFor('palm', data)) questions.push('What does my palm reading say about my career line?');
    if (questions.length === 0) {
      questions.push('What can you help me with?', 'How do I set up my birth profile?');
    }
    res.json({ questions });
  });

  router.post('/message', async (req, res) => {
    const userId = currentUserId(req);
    if (isRateLimited(userId)) {
      return res.status(429).json({ error: 'Too many messages. Please wait a moment before sending another.' });
    }

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const { message, screenContext } = parsed.data;
    const loaded = loadOrCreateConversation(userId, parsed.data.conversationId, message);
    if ('error' in loaded) return res.status(404).json({ error: 'Conversation not found' });
    const { conversation } = loaded;

    const start = Date.now();
    let result: AssistantReplyResult;
    try {
      result = await buildAssistantReply(userId, message, conversation.messages, aiProvider, assistantConfig, screenContext ?? undefined);
    } catch {
      result = {
        reply: 'Something went wrong generating a response - please try again.',
        detectedFeature: null, premiumCard: null, suggestedFollowUps: [], mode: null,
        estimatedInputTokens: 0, estimatedOutputTokens: 0, success: false, timings: { totalMs: 0 },
      };
    }
    const latencyMs = Date.now() - start;
    persistReply(conversation, userId, result, latencyMs);

    res.json({
      conversationId: conversation.id,
      reply: result.reply,
      premiumCard: result.premiumCard,
      suggestedFollowUps: result.suggestedFollowUps,
      detectedFeature: result.detectedFeature,
    });
  });

  /**
   * Streaming counterpart of /message. Same auth, rate-limiting,
   * conversation ownership, and request validation as above - only the
   * transport and the use of onStage/onChunk differ. Writes one
   * newline-delimited JSON object per line as the real pipeline progresses:
   *   {"type":"stage","key":...,"label":...}
   *   {"type":"chunk","text":...}
   *   {"type":"done","conversationId":...,"premiumCard":...,"suggestedFollowUps":...,"detectedFeature":...}
   *   {"type":"error","message":...}
   * Conversation/usage-log persistence reuses the exact same helpers as
   * /message so the two paths can never drift.
   */
  router.post('/message/stream', async (req, res) => {
    const userId = currentUserId(req);
    if (isRateLimited(userId)) {
      return res.status(429).json({ error: 'Too many messages. Please wait a moment before sending another.' });
    }

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const { message, screenContext } = parsed.data;
    const loaded = loadOrCreateConversation(userId, parsed.data.conversationId, message);
    if ('error' in loaded) return res.status(404).json({ error: 'Conversation not found' });
    const { conversation } = loaded;

    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // disable proxy buffering so chunks flush promptly
      Connection: 'keep-alive',
    });

    const writeLine = (obj: unknown) => {
      res.write(JSON.stringify(obj) + '\n');
    };

    const onStage = (stage: StageEvent) => writeLine({ type: 'stage', key: stage.key, label: stage.label });
    const onChunk = (text: string) => writeLine({ type: 'chunk', text });

    const start = Date.now();
    let result: AssistantReplyResult;
    try {
      result = await buildAssistantReply(
        userId, message, conversation.messages, aiProvider, assistantConfig,
        screenContext ?? undefined, onStage, onChunk,
      );
    } catch (err: any) {
      writeLine({ type: 'error', message: 'Something went wrong generating a response - please try again.' });
      return res.end();
    }
    const latencyMs = Date.now() - start;
    persistReply(conversation, userId, result, latencyMs);

    if (!result.success) {
      writeLine({ type: 'error', message: result.reply });
      return res.end();
    }

    writeLine({
      type: 'done',
      conversationId: conversation.id,
      // Always include the real reply text, not just rely on streamed
      // chunks - several pipeline paths (unknown feature, no data on file,
      // crisis response, unimplemented-feature notice) never call onChunk at
      // all, since they short-circuit before any AI generation happens. The
      // client falls back to this field whenever it received zero chunks.
      reply: result.reply,
      premiumCard: result.premiumCard,
      suggestedFollowUps: result.suggestedFollowUps,
      detectedFeature: result.detectedFeature,
    });
    res.end();
  });

  router.get('/conversations', (req, res) => {
    const userId = currentUserId(req);
    const items = [...assistantConversationsById.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({
        id: c.id,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        lastMessage: c.messages[c.messages.length - 1]?.content ?? null,
        messageCount: c.messages.length,
      }));
    res.json({ items });
  });

  router.get('/conversations/:id', (req, res) => {
    const convo = ownedConversationOr404(res, currentUserId(req), req.params.id);
    if (!convo) return;
    res.json(convo);
  });

  router.delete('/conversations/:id', (req, res) => {
    const convo = ownedConversationOr404(res, currentUserId(req), req.params.id);
    if (!convo) return;
    assistantConversationsById.delete(convo.id);
    res.json({ ok: true });
  });

  return router;
}
