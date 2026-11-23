import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';
import { buildPalmRouter } from './palm';
import { readingsById } from '../data/store';
import { CountingFakeAiProvider, fixtureAnalysisWithMatches, generateNoiseTestImage } from '../palmistry/testFixtures';
import { buildFreeReading } from '../palmistry/staticPalmistryEngine';
import { saveReadingImage, deleteReadingImage } from '../palmistry/imageStorage';
import { signPath, verifySignedPath } from '../auth/signedUrl';

const app = express();
app.use('/palm', buildPalmRouter(new CountingFakeAiProvider()));

async function seed(userId: string) {
  const analysis = fixtureAnalysisWithMatches();
  const id = uuid();
  readingsById.set(id, { id, userId, createdAt: new Date().toISOString(), analysis, freeReading: buildFreeReading(analysis), premiumReportAvailable: true, premiumReport: null, premiumReportGeneratedAt: null } as any);
  saveReadingImage(id, await generateNoiseTestImage());
  return id;
}

describe('palm photo access via short-lived signed URLs', () => {
  it('owner can mint a signed URL, and the URL alone (no credentials) fetches the image', async () => {
    const owner = `user-${uuid()}`; const id = await seed(owner);
    const minted = await request(app).get(`/palm/readings/${id}/image-url`).set('x-demo-user', owner);
    expect(minted.status).toBe(200);
    expect(minted.body.url).toMatch(new RegExp(`^/palm/readings/${id}/image\\?exp=\\d+&sig=[0-9a-f]+$`));
    const img = await request(app).get(minted.body.url); // no auth at all
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    deleteReadingImage(id);
  });

  it("a non-owner cannot mint a URL or read the image, and a signature for one photo does not open another", async () => {
    const owner = `user-${uuid()}`; const id = await seed(owner); const id2 = await seed(owner);
    expect((await request(app).get(`/palm/readings/${id}/image-url`).set('x-demo-user', `user-${uuid()}`)).status).toBe(404);
    expect((await request(app).get(`/palm/readings/${id}/image`).set('x-demo-user', `user-${uuid()}`)).status).toBe(404);
    const { exp, sig } = signPath(`/palm/readings/${id}/image`);
    expect((await request(app).get(`/palm/readings/${id2}/image?exp=${exp}&sig=${sig}`)).status).toBe(404);
    deleteReadingImage(id); deleteReadingImage(id2);
  });

  it('rejects tampered, expired and missing signatures; the old ?token= query param no longer authenticates', async () => {
    const owner = `user-${uuid()}`; const id = await seed(owner);
    const p = `/palm/readings/${id}/image`;
    const { exp, sig } = signPath(p);
    expect(verifySignedPath(p, exp, sig)).toBe(true);
    expect(verifySignedPath(p, exp + 1, sig)).toBe(false);
    expect(verifySignedPath(p, exp, sig.replace(/.$/, sig.endsWith('0') ? '1' : '0'))).toBe(false);
    const expired = signPath(p, -5);
    expect(verifySignedPath(p, expired.exp, expired.sig)).toBe(false);
    expect((await request(app).get(`${p}?exp=${exp}&sig=bad`)).status).toBe(404);
    expect((await request(app).get(p)).status).toBe(404);
    const { signUserToken } = await import('../auth/tokens');
    expect((await request(app).get(`${p}?token=${signUserToken(owner)}`)).status).toBe(404);
    deleteReadingImage(id);
  });
});

describe('auth context', () => {
  it('ignores a session token passed in the query string (only the Authorization header counts)', async () => {
    const { resolveAuthContext } = await import('../auth/context');
    const { signUserToken } = await import('../auth/tokens');
    const { accountsById } = await import('../data/store');
    accountsById.set('user-abc', { id: 'user-abc', email: 'abc@x.com', passwordHash: 'x', emailVerified: false, createdAt: '', updatedAt: '' } as any);
    const t = signUserToken('user-abc');
    expect(resolveAuthContext({ headers: {}, query: { token: t } }).userId).toBe('demo-user');
    expect(resolveAuthContext({ headers: { authorization: `Bearer ${t}` }, query: {} }).userId).toBe('user-abc');
  });
});
