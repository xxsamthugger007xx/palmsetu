import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { WELLNESS_SYSTEM_PROMPT, PALMISTRY_SYSTEM_PROMPT } from '../ai/systemPrompts';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { conversationsById } from '../data/store';

const messageSchema = z.object({
  conversationId: z.string().nullable(),
  message: z.string().min(1).max(4000),
  mode: z.enum(['wellness', 'palmistry']),
});

export function buildCompanionRouter(aiProvider: AiProvider) {
  const router = Router();

  router.post('/message', async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const { message, mode } = parsed.data;
    const userId = (req.headers['x-demo-user'] as string) || 'demo-user';

    let conversationId = parsed.data.conversationId;
    let conversation = conversationId ? conversationsById.get(conversationId) : undefined;
    if (!conversation) {
      conversationId = uuid();
      conversation = { id: conversationId, userId, mode, messages: [] };
      conversationsById.set(conversationId, conversation);
    }

    conversation.messages.push({ role: 'user', content: message });

    if (containsCrisisLanguage(message)) {
      conversation.messages.push({ role: 'assistant', content: CRISIS_RESPONSE });
      return res.json({ conversationId, reply: CRISIS_RESPONSE, crisisFlag: true });
    }

    const systemPrompt = mode === 'wellness' ? WELLNESS_SYSTEM_PROMPT : PALMISTRY_SYSTEM_PROMPT;
    const reply = await aiProvider.complete([
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
    ]);

    conversation.messages.push({ role: 'assistant', content: reply });
    res.json({ conversationId, reply });
  });

  return router;
}
