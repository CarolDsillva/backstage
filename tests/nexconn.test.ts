import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { resetEnvCache, getEnv } from '@/lib/server/env';
import {
  sign, nexconnPost, NexconnError, joinGroup, sendGroupMessage, createGroup, issueToken,
} from '@/lib/server/nexconn';

const envSrc = {
  NEXCONN_APP_KEY: 'appkey', NEXCONN_APP_SECRET: 'secret',
  SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc',
  SESSION_SECRET: 'a-long-session-secret-value-123456', NEXT_PUBLIC_NEXCONN_APP_KEY: 'appkey',
};

function ok(body: object = { code: 0 }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('nexconn server client', () => {
  beforeEach(() => { resetEnvCache(); getEnv(envSrc); });

  it('signs as sha1(secret+nonce+timestamp)', () => {
    const expected = crypto.createHash('sha1').update('secret143141408710653491').digest('hex');
    expect(sign('secret', '14314', '1408710653491')).toBe(expected);
  });

  it('sends signed headers to the primary base', async () => {
    const f = vi.fn().mockImplementation(async () => ok());
    await nexconnPost('/v4/x', { a: 1 }, f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.sg-light-api.com/v4/x');
    const h = init.headers as Record<string, string>;
    expect(h['App-Key']).toBe('appkey');
    expect(h.Nonce.length).toBeLessThanOrEqual(18);
    expect(h.Signature).toBe(sign('secret', h.Nonce, h.Timestamp));
  });

  it('falls back to the backup base when the first fetch rejects', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockImplementation(async () => ok());
    await nexconnPost('/v4/x', {}, f);
    expect(f.mock.calls[1][0]).toBe('https://api-b.sg-light-api.com/v4/x');
  });

  it('throws NexconnError when code !== 0', async () => {
    const f = vi.fn().mockResolvedValue(ok({ code: 1002, msg: 'bad' }));
    await expect(nexconnPost('/v4/x', {}, f)).rejects.toBeInstanceOf(NexconnError);
  });

  it('joinGroup chunks 150 ids into 2 calls', async () => {
    const f = vi.fn().mockImplementation(async () => ok());
    await joinGroup('g1', Array.from({ length: 150 }, (_, i) => `u${i}`), f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[1][1].body).userIds).toHaveLength(50);
  });

  it('sendGroupMessage serialises content and persistence', async () => {
    const f = vi.fn().mockImplementation(async () => ok());
    await sendGroupMessage({ from: 'sys', channelId: 'g1', type: 'BS:State', content: { kind: 'card' }, persist: false }, f);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body).toMatchObject({ fromUserId: 'sys', toChannelIds: ['g1'], messageType: 'BS:State', shouldPersist: 0 });
    expect(JSON.parse(body.content)).toEqual({ kind: 'card' });
  });

  it('createGroup treats "already exists" as ok', async () => {
    const f = vi.fn().mockResolvedValue(ok({ code: 25001, msg: 'group already exists' }));
    await expect(createGroup('g1', 'Gig', 'owner', [], f)).resolves.toBeUndefined();
  });

  it('issueToken returns accessToken', async () => {
    const f = vi.fn().mockResolvedValue(ok({ code: 0, result: { userId: 'u1', accessToken: 'tok' } }));
    expect(await issueToken('u1', 'Ann', f)).toBe('tok');
  });
});
