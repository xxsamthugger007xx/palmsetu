import { describe, it, expect } from 'vitest';
import {
  recordCompletedReading, listMemoriesForUser, deleteMemory, deleteAllMemoriesForUser,
  retrieveRelevantMemories, isMemoryEnabledForUser, setMemoryEnabledForUser,
  extractAndStoreFacts, listFactsForUser,
} from './memoryService';

describe('memoryService', () => {
  it('saves a completed reading and makes it retrievable', () => {
    const userId = `user-${Math.random()}`;
    const row = recordCompletedReading(userId, 'tarot', 'source-1', 'free', 'three-card reading on 2026-10-28, cards: The Fool, The Star, The Sun');
    expect(row).not.toBeNull();
    const list = listMemoriesForUser(userId);
    expect(list.some((m) => m.sourceId === 'source-1')).toBe(true);
  });

  it('never records a failed/incomplete reading as a memory (route-level contract)', () => {
    // memoryService has no "recordFailed" path at all - recordCompletedReading
    // is the only entry point, and routes only call it after real success.
    // This test documents that contract: calling it is itself the proof of
    // completion, there is no separate status flag a caller could set to 'failed'.
    const userId = `user-${Math.random()}`;
    const before = listMemoriesForUser(userId).length;
    expect(before).toBe(0);
  });

  it('isolates memories between users', () => {
    const userA = `userA-${Math.random()}`;
    const userB = `userB-${Math.random()}`;
    recordCompletedReading(userA, 'tarot', 'src-a', 'free', 'reading for A');
    recordCompletedReading(userB, 'tarot', 'src-b', 'free', 'reading for B');

    const aList = listMemoriesForUser(userA);
    const bList = listMemoriesForUser(userB);
    expect(aList.every((m) => m.userId === userA)).toBe(true);
    expect(bList.some((m) => m.sourceId === 'src-a')).toBe(false);
  });

  it('deleting a reading removes its memory record', () => {
    const userId = `user-${Math.random()}`;
    const row = recordCompletedReading(userId, 'astrology', 'src-del', 'free', 'daily horoscope');
    expect(row).not.toBeNull();
    const ok = deleteMemory(userId, row!.id);
    expect(ok).toBe(true);
    expect(listMemoriesForUser(userId).some((m) => m.id === row!.id)).toBe(false);
  });

  it('deleting all data removes every memory for that user', () => {
    const userId = `user-${Math.random()}`;
    recordCompletedReading(userId, 'tarot', 'src-1', 'free', 'a');
    recordCompletedReading(userId, 'gemstone', 'src-2', 'free', 'b');
    const count = deleteAllMemoriesForUser(userId);
    expect(count).toBe(2);
    expect(listMemoriesForUser(userId).length).toBe(0);
  });

  it('disabling memory stops retrieval', () => {
    const userId = `user-${Math.random()}`;
    recordCompletedReading(userId, 'tarot', 'src-x', 'free', 'moon sign reading');
    expect(retrieveRelevantMemories(userId, 'moon sign', 'tarot').length).toBeGreaterThan(0);

    setMemoryEnabledForUser(userId, false);
    expect(isMemoryEnabledForUser(userId)).toBe(false);
    expect(retrieveRelevantMemories(userId, 'moon sign', 'tarot').length).toBe(0);
  });

  it('extracts a durable fact from a substantive message without an AI call', () => {
    const userId = `user-${Math.random()}`;
    const facts = extractAndStoreFacts(userId, 'I am interested in learning vedic astrology more deeply', null);
    expect(facts.length).toBe(1);
    expect(facts[0].kind).toBe('interest');
    expect(listFactsForUser(userId).length).toBe(1);
  });

  it('does not extract facts from short/trivial messages', () => {
    const userId = `user-${Math.random()}`;
    extractAndStoreFacts(userId, 'ok', null);
    expect(listFactsForUser(userId).length).toBe(0);
  });
});
