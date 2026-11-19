import crypto from 'node:crypto';
import { getEnv } from './env';

type FetchImpl = typeof fetch;

export class NexconnError extends Error {
  constructor(public code: number, public path: string, msg?: string) {
    super(`Nexconn ${path} failed: code ${code}${msg ? ` (${msg})` : ''}`);
  }
}

/** Documented codes we treat as success because the desired state already holds. */
export const GROUP_EXISTS = 25409;
export const ALREADY_MEMBER = 25412;

export function sign(secret: string, nonce: string, ts: string): string {
  return crypto.createHash('sha1').update(secret + nonce + ts).digest('hex');
}

function headers() {
  const env = getEnv();
  const nonce = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  const ts = Date.now().toString();
  return {
    'App-Key': env.NEXCONN_APP_KEY,
    Nonce: nonce,
    Timestamp: ts,
    Signature: sign(env.NEXCONN_APP_SECRET, nonce, ts),
    'Content-Type': 'application/json',
  };
}

// Remember which base worked last (docs: switch to backup on timeout / bad status).
let preferBackup = false;

export async function nexconnPost<T = { code: number }>(
  path: string,
  body: object,
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const env = getEnv();
  const bases = preferBackup
    ? [env.NEXCONN_API_BACKUP, env.NEXCONN_API_BASE]
    : [env.NEXCONN_API_BASE, env.NEXCONN_API_BACKUP];
  let lastErr: unknown;
  for (let i = 0; i < bases.length; i++) {
    try {
      const res = await fetchImpl(bases[i] + path, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { code: number; msg?: string; errorMessage?: string };
      preferBackup = i === 1 ? !preferBackup : preferBackup;
      if (json.code !== 0 && json.code !== 200) {
        throw new NexconnError(json.code, path, json.msg ?? json.errorMessage);
      }
      return json as T;
    } catch (e) {
      if (e instanceof NexconnError) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function issueToken(userId: string, name: string, f?: FetchImpl): Promise<string> {
  const r = await nexconnPost<{ result: { accessToken: string } }>(
    '/v4/auth/access-token/issue',
    { userId, name },
    f,
  );
  return r.result.accessToken;
}

export async function createGroup(
  channelId: string,
  name: string,
  owner: string,
  userIds: string[] = [],
  f?: FetchImpl,
): Promise<void> {
  try {
    await nexconnPost(
      '/v4/group-channel/create',
      { channelId, name: name.slice(0, 64), owner, userIds: userIds.slice(0, 30) },
      f,
    );
  } catch (e) {
    if (e instanceof NexconnError && (e.code === GROUP_EXISTS || /already exist/i.test(e.message))) return;
    throw e;
  }
  if (userIds.length > 30) await joinGroup(channelId, userIds.slice(30), f);
}

export async function joinGroup(channelId: string, userIds: string[], f?: FetchImpl): Promise<void> {
  for (let i = 0; i < userIds.length; i += 100) {
    try {
      await nexconnPost('/v4/group-channel/join', { channelId, userIds: userIds.slice(i, i + 100) }, f);
    } catch (e) {
      if (!(e instanceof NexconnError && e.code === ALREADY_MEMBER)) throw e;
    }
  }
}

export async function sendGroupMessage(
  a: { from: string; channelId: string; type: string; content: object; persist?: boolean; push?: string },
  f?: FetchImpl,
): Promise<void> {
  await nexconnPost(
    '/v4/group-channel/message/send',
    {
      fromUserId: a.from,
      toChannelIds: [a.channelId],
      messageType: a.type,
      content: JSON.stringify(a.content),
      shouldPersist: a.persist === false ? 0 : 1,
      isEchoToSender: 0,
      ...(a.push ? { pushContent: a.push } : {}),
    },
    f,
  );
}
