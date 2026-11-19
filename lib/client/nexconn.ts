'use client';
/**
 * Thin client wrapper over the Nexconn Web Chat SDK.
 * The SDK is imported dynamically so it never runs during SSR.
 */
import { BS_TYPES, SYSTEM_USER_ID } from '@/lib/shared/types';
import { backoffMs, connAction } from '@/lib/shared/conn';

type Sdk = typeof import('@nexconn/chat');
type SdkMessage = import('@nexconn/chat').Message;

export type ConnStatus = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'kicked';

export type ChatMsg = {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  type: string;
  content: Record<string, unknown>;
  sentAt: number;
  mine: boolean;
};

let sdkPromise: Promise<Sdk> | null = null;
let connectPromise: Promise<string> | null = null;
let myUserId = '';
let myName = '';
let status: ConnStatus = 'connecting';

const msgListeners = new Set<(m: ChatMsg) => void>();
const statusListeners = new Set<(s: ConnStatus) => void>();

function loadSdk() {
  sdkPromise ??= import('@nexconn/chat');
  return sdkPromise;
}

function setStatus(s: ConnStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

export function getStatus() {
  return status;
}

export function onStatus(cb: (s: ConnStatus) => void) {
  statusListeners.add(cb);
  cb(status);
  return () => void statusListeners.delete(cb);
}

export function onMessage(cb: (m: ChatMsg) => void) {
  msgListeners.add(cb);
  return () => void msgListeners.delete(cb);
}

export function toChatMsg(m: SdkMessage): ChatMsg {
  const content = (m.content ?? {}) as Record<string, unknown>;
  const info = content.senderUserInfo as { name?: string } | undefined;
  return {
    id: m.messageId || `${m.senderUserId}-${m.sentTime}`,
    channelId: m.channelIdentifier.channelId,
    senderId: m.senderUserId,
    senderName: m.senderUserId === SYSTEM_USER_ID ? 'Backstage' : info?.name ?? 'Someone',
    type: m.messageType,
    content,
    sentAt: m.sentTime,
    mine: m.senderUserId === myUserId,
  };
}

async function fetchToken(): Promise<string> {
  const r = await fetch('/api/token', { cache: 'no-store' });
  if (!r.ok) throw new Error('token');
  return ((await r.json()) as { token: string }).token;
}

/** Initialise once and connect. Safe to call many times. */
let setupPromise: Promise<Sdk> | null = null;
let reconnecting = false;

/** Initialise the engine, custom types and handlers exactly once. */
function setup(appKey: string) {
  setupPromise ??= (async () => {
    const sdk = await loadSdk();
    const { NCEngine, MessageHandler, ConnectionStatusHandler } = sdk;
    NCEngine.initialize({ appKey });
    NCEngine.registerCustomMessages([
      ...[BS_TYPES.poll, BS_TYPES.song, BS_TYPES.meetup, BS_TYPES.carpool, BS_TYPES.question,
        BS_TYPES.incident, BS_TYPES.proposal, BS_TYPES.announce].map((messageType) => ({
        messageType, isPersisted: true, isCounted: true,
      })),
      { messageType: BS_TYPES.state, isPersisted: false, isCounted: false, isStatusMessage: true },
    ]);
    NCEngine.addMessageHandler('backstage', new MessageHandler({
      onMessageReceived({ messages }) {
        for (const m of messages) {
          const cm = toChatMsg(m);
          msgListeners.forEach((l) => l(cm));
        }
      },
    }));
    NCEngine.addConnectionStatusHandler('backstage', new ConnectionStatusHandler({
      onConnectionStatusChanged({ status: s, code }) {
        const action = connAction(Number(s), code);
        if (action === 'online') setStatus('online');
        else if (action === 'wait') setStatus(status === 'online' ? 'reconnecting' : status === 'kicked' ? 'kicked' : 'connecting');
        else if (action === 'kicked') setStatus('kicked');
        else void reconnectLoop();
      },
    }));
    return sdk;
  })();
  return setupPromise;
}

/** Connect with a fresh token, retrying with backoff. Never gives up silently. */
async function connectWithRetry(firstToken?: string): Promise<string> {
  const { NCEngine } = await loadSdk();
  let token = firstToken;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      token ??= await fetchToken();
      const res = await NCEngine.connect({ token });
      if (res.isOk && res.data) {
        setStatus('online');
        return res.data.userId;
      }
    } catch {
      // network or token fetch failed; fall through to backoff
    }
    token = undefined; // rejected/expired → fetch a fresh one next time
    setStatus(attempt === 0 && status === 'connecting' ? 'connecting' : 'reconnecting');
    await new Promise((r) => setTimeout(r, backoffMs(attempt)));
  }
  setStatus('offline');
  throw new Error('Could not connect to chat');
}

async function reconnectLoop() {
  if (reconnecting) return;
  reconnecting = true;
  setStatus('reconnecting');
  try {
    await connectWithRetry();
  } catch {
    // status is 'offline'; the UI offers "Try again"
  } finally {
    reconnecting = false;
  }
}

/** Initialise once and connect. Safe to call many times. */
export function connectNexconn(opts: { appKey: string; userId: string; name: string; token?: string }) {
  myUserId = opts.userId;
  myName = opts.name;
  connectPromise ??= (async () => {
    await setup(opts.appKey);
    try {
      return await connectWithRetry(opts.token);
    } catch (e) {
      connectPromise = null;
      throw e;
    }
  })();
  return connectPromise;
}

/** "Try again" / "Use it here" button: force a fresh connection now. */
export async function reconnectNow() {
  if (!setupPromise) return;
  const { NCEngine } = await loadSdk();
  try {
    await NCEngine.disconnect();
  } catch {
    // already disconnected
  }
  await reconnectLoop();
}

function withSender<T extends Record<string, unknown>>(content: T) {
  return { ...content, senderUserInfo: { userId: myUserId, name: myName } };
}

export async function sendText(channelId: string, text: string): Promise<ChatMsg> {
  const { GroupChannel, SendTextMessageParams } = await loadSdk();
  const ch = new GroupChannel(channelId);
  const r = await ch.sendMessage(new SendTextMessageParams(withSender({ text })));
  if (!r.isOk || !r.data) throw new Error(`send failed (${r.code})`);
  return toChatMsg(r.data);
}

export async function sendCustom(channelId: string, type: string, content: Record<string, unknown>) {
  const { GroupChannel, SendMessageParams } = await loadSdk();
  const ch = new GroupChannel(channelId);
  const r = await ch.sendMessage(new SendMessageParams(withSender(content), type));
  if (!r.isOk || !r.data) throw new Error(`send failed (${r.code})`);
  return toChatMsg(r.data);
}

export async function sendImage(channelId: string, file: File, onProgress?: (p: number) => void) {
  const { GroupChannel, Helper } = await loadSdk();
  const prep = await Helper.createSendImageMessageParams(file);
  if (!prep.isOk || !prep.data) throw new Error('Could not prepare image');
  const params = prep.data;
  if (onProgress) params.onUploadProgress = (p: number) => onProgress(p);
  Object.assign(params.content as object, { senderUserInfo: { userId: myUserId, name: myName } });
  const r = await new GroupChannel(channelId).sendMediaMessage(params);
  if (!r.isOk || !r.data) throw new Error(`upload failed (${r.code})`);
  return toChatMsg(r.data);
}

export async function loadHistory(channelId: string, pageSize = 50): Promise<ChatMsg[]> {
  const { BaseChannel, GroupChannelIdentifier } = await loadSdk();
  const q = BaseChannel.createMessagesQuery({
    channelIdentifier: new GroupChannelIdentifier(channelId),
    startTime: Date.now(),
    pageSize,
    isAscending: false,
  });
  const r = await q.loadNextPage();
  if (!r.isOk || !r.data) return [];
  return r.data.data.map(toChatMsg).reverse();
}
