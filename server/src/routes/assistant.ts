import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import {
  assistantConversationsById, assistantUsageLog, AssistantConversation, getUserTier, assistantFreeChatByKey,
} from '../data/store';
import { freeChatLimits, getMonthlySpendInr } from '../ai/budget';
import { requestLocalDate } from '../util/localDate';
import { assistantConfig } from '../data/assistantConfig';
import { buildAssistantReply, AssistantReplyResult, StageEvent } from '../assistant/responseBuilder';
import { retrieveUserData, hasDataFor } from '../assistant/dataRetrieval';

/** Same TEMPORARY testing shim as every other route in this app: no real
 * auth exists yet, identity comes from the x-demo-user header. */
function currentUserId(req: Request): string {
  // Prefers the real resolved auth context (see auth/middleware.ts's
  // attachAuthContext, mounted globally in index.ts) - falls back to the
  // legacy header read directly only for a test harness that builds this
  // router's Express app without that middleware mounted.
  if (req.auth?.userId) return req.auth.userId;
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

function ownedConversationOr404(res: Response, userId: string, id: string): AssistantConversation | undefined {
  const convo = assistantConversationsById.get(id);
  if (!convo || convo.userId !== userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return undefined;
  }
  return convo;
}

/**
 * Premium: full AI, bounded only by the monthly AI budget. Free: real AI too, but fast/short, a few messages a day and a
 * small monthly spend ceiling; past either limit the assistant falls back to answers built without AI.
 */
function chatPlan(req: Request, userId: string) {
  if (getUserTier(userId) === 'premium') return { free: false, options: { aiEnabled: true }, countKey: null as string | null };
  const limits = freeChatLimits();
  const localDate = requestLocalDate(req);
  const countKey = `${userId}:${localDate}`;
  const used = assistantFreeChatByKey.get(countKey)?.count ?? 0;
  const dayDone = used >= limits.dailyMessages;
  const monthDone = getMonthlySpendInr(userId) >= limits.monthlyInr;
  if (dayDone || monthDone) {
    return {
      free: true, countKey: null as string | null,
      options: {
        aiEnabled: false,
        noAiNote: dayDone
          ? `\n\nYou've used today's ${limits.dailyMessages} free AI messages. They reset tomorrow, or upgrade to Premium to keep chatting.`
          : '\n\nYou\'ve reached this month\'s free AI chat limit. Upgrade to Premium to keep chatting.',
      },
    };
  }
  return { free: true, countKey, options: { aiEnabled: true, fastOnly: true } };
}

/** Counts a free user's AI message, only when the reply really used the AI. */
/** Free-plan AI messages left today (null for Premium), shown as a small counter in the chat. */
function freeRemaining(plan: ReturnType<typeof chatPlan>, userId: string, req: Request): number | null {
  if (!plan.free) return null;
  const used = assistantFreeChatByKey.get(`${userId}:${requestLocalDate(req)}`)?.count ?? 0;
  return Math.max(0, freeChatLimits().dailyMessages - used);
}

function recordFreeChat(plan: ReturnType<typeof chatPlan>, userId: string, result: AssistantReplyResult) {
  if (!plan.countKey || result.mode === null || !result.success) return;
  const cur = assistantFreeChatByKey.get(plan.countKey);
  assistantFreeChatByKey.set(plan.countKey, { userId, localDate: plan.countKey.split(':').pop()!, count: (cur?.count ?? 0) + 1 });
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
    const plan = chatPlan(req, userId);
    let result: AssistantReplyResult;
    try {
      result = await buildAssistantReply(userId, message, conversation.messages, aiProvider, assistantConfig, screenContext ?? undefined, undefined, undefined, plan.options);
    } catch {
      result = {
        reply: 'Something went wrong generating a response - please try again.',
        detectedFeature: null, premiumCard: null, suggestedFollowUps: [], mode: null,
        estimatedInputTokens: 0, estimatedOutputTokens: 0, success: false, timings: { totalMs: 0 },
      };
    }
    const latencyMs = Date.now() - start;
    recordFreeChat(plan, userId, result);
    persistReply(conversation, userId, result, latencyMs);

    res.json({
      conversationId: conversation.id,
      reply: result.reply,
      premiumCard: result.premiumCard,
      suggestedFollowUps: result.suggestedFollowUps,
      detectedFeature: result.detectedFeature,
      freeRemaining: freeRemaining(plan, userId, req),
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
    const plan = chatPlan(req, userId);
    let result: AssistantReplyResult;
    try {
      result = await buildAssistantReply(
        userId, message, conversation.messages, aiProvider, assistantConfig,
        screenContext ?? undefined, onStage, onChunk,
        plan.options,
      );
    } catch (err: any) {
      writeLine({ type: 'error', message: 'Something went wrong generating a response - please try again.' });
      return res.end();
    }
    const latencyMs = Date.now() - start;
    recordFreeChat(plan, userId, result);
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
      freeRemaining: freeRemaining(plan, userId, req),
    });
    res.end();
  });

  router.get('/conversations', (req, res) => {
    const userId = currentUserId(req);
    const items = assistantConversationsById.valuesForUser(userId)
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
