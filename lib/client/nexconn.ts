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

/** Optional extra SDKs for the crew app: Call SDK (walkie radio) and the ready-made Chat UI kit (inbox). */
export type SetupOpts = { call?: boolean; chatUI?: boolean };
type CallSdk = typeof import('@nexconn/call');
let callSdk: CallSdk | null = null;
let chatUIApp: import('@nexconn/chatui').NCChatUIApplication | null = null;

/** Names the Chat UI kit shows for users/groups; filled from the crew bootstrap. */
const profiles = {
  users: new Map<string, string>(),
  groups: new Map<string, { name: string; members: string[] }>(),
};
export function setChatProfiles(users: { userId: string; name: string }[], groups: { channelId: string; name: string; members: string[] }[]) {
  users.forEach((u) => profiles.users.set(u.userId, u.name));
  groups.forEach((g) => profiles.groups.set(g.channelId, { name: g.name, members: g.members }));
  if (!chatUIApp) return;
  users.forEach((u) => chatUIApp?.updateUserProfile({ userId: u.userId, name: u.name }));
  groups.forEach((g) => chatUIApp?.updateGroupProfile({ groupId: g.channelId, name: g.name, memberCount: g.members.length }));
}
export function getCallSdk() {
  return callSdk;
}
export function getChatUIApp() {
  return chatUIApp;
}
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
function setup(appKey: string, opts: SetupOpts = {}) {
  setupPromise ??= (async () => {
    const sdk = await loadSdk();
    const { NCEngine, MessageHandler, ConnectionStatusHandler } = sdk;
    if (opts.call) {
      // The Call SDK must install its plugin before NCEngine.initialize().
      try {
        callSdk = await import('@nexconn/call');
        callSdk.NCCallEngine.install();
      } catch (e) {
        console.warn('Call SDK unavailable', e);
        callSdk = null;
      }
    }
    NCEngine.initialize({ appKey });
    NCEngine.registerCustomMessages([
      ...PERSISTED_TYPES.map((messageType) => ({ messageType, isPersisted: true, isCounted: true })),
      { messageType: BS_TYPES.state, isPersisted: false, isCounted: false, isStatusMessage: true },
    ]);
    if (callSdk) {
      try {
        callSdk.NCCallEngine.initialize({});
      } catch (e) {
        console.warn('Call engine init failed', e);
        callSdk = null;
      }
    }
    if (opts.chatUI) await setupChatUI();
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

const PERSISTED_TYPES = [BS_TYPES.poll, BS_TYPES.song, BS_TYPES.meetup, BS_TYPES.carpool, BS_TYPES.question,
  BS_TYPES.incident, BS_TYPES.proposal, BS_TYPES.announce, BS_TYPES.issue, BS_TYPES.issueUpdate, BS_TYPES.radio];

/** One-line text for a Backstage card, used by the Chat UI kit's renderer and channel list. */
export function cardDigest(type: string, c: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (type) {
    case BS_TYPES.issue:
      return `${c.severity === 'critical' ? '🔴 ' : c.severity === 'urgent' ? '🟠 ' : ''}Issue: ${s(c.title)}${c.placeName ? ` · ${s(c.placeName)}` : ''}`;
    case BS_TYPES.issueUpdate:
      return `${s(c.by) || 'Someone'} ${c.action === 'take' ? 'is on' : c.action === 'fix' ? 'fixed' : 'reopened'}: ${s(c.title)}`;
    case BS_TYPES.radio:
      return c.live ? `📻 Radio live · started by ${s(c.by) || 'crew'}` : '📻 Radio off air';
    case BS_TYPES.announce:
      return `📣 ${s(c.text)}`;
    case BS_TYPES.incident:
      return `Report: ${s(c.note)}`;
    default:
      return `[${type.replace('BS:', '')}]`;
  }
}

/** The ready-made Nexconn Chat UI kit (inbox). Must be ready() before connect. */
async function setupChatUI() {
  try {
    const { NCChatUIApplication } = await import('@nexconn/chatui');
    const app = NCChatUIApplication.initialize({
      language: 'en_US',
      hooks: {
        reqUserProfiles: async (ids) => ids.map((userId) => ({ userId, name: userId === SYSTEM_USER_ID ? 'Backstage' : profiles.users.get(userId) ?? 'Crew' })),
        reqGroupProfiles: async (ids) => ids.map((groupId) => {
          const g = profiles.groups.get(groupId);
          return { groupId, name: g?.name ?? 'Crew channel', memberCount: g?.members.length ?? 0 };
        }),
        reqSystemProfiles: async (ids) => ids.map((systemId) => ({ systemId, name: 'Backstage' })),
        reqGroupMembers: async (groupId) => (profiles.groups.get(groupId)?.members ?? []).map((userId) => ({ userId })),
      },
    });
    if (!app) return;
    // Render Backstage cards inside the kit as a compact one-line card.
    class BsCard extends HTMLElement {
      private _m: { messageType: string; content: Record<string, unknown> } | null = null;
      set message(m: { messageType: string; content: Record<string, unknown> }) { this._m = m; this.paint(); }
      get message(): { messageType: string; content: Record<string, unknown> } { return this._m as never; }
      connectedCallback() { this.paint(); }
      private paint() {
        if (!this._m) return;
        this.textContent = cardDigest(this._m.messageType, this._m.content ?? {});
        this.setAttribute('style', 'display:block;font:600 14px/1.35 system-ui;padding:2px 0;');
      }
    }
    app.registerCustomMessages(PERSISTED_TYPES.map((messageType) => ({
      messageType, isPersisted: true, isCounted: true,
      digest: (m) => cardDigest(m.messageType, (m.content ?? {}) as Record<string, unknown>),
      component: { tagName: 'bs-card', elementClass: BsCard },
    })));
    app.ready();
    chatUIApp = app;
  } catch (e) {
    console.warn('Chat UI unavailable', e);
  }
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
export function connectNexconn(opts: { appKey: string; userId: string; name: string; token?: string; setup?: SetupOpts }) {
  myUserId = opts.userId;
  myName = opts.name;
  connectPromise ??= (async () => {
    await setup(opts.appKey, opts.setup);
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
  // Don't trust page order: sort oldest → newest by send time.
  return r.data.data.map(toChatMsg).sort((a, b) => a.sentAt - b.sentAt);
}

/** Walkie clip: an HD voice message (Chat SDK). */
export async function sendVoice(channelId: string, file: File): Promise<ChatMsg> {
  const { GroupChannel, Helper } = await loadSdk();
  const prep = await Helper.createSendHDVoiceMessageParams(file);
  if (!prep.isOk || !prep.data) throw new Error('Could not prepare voice clip');
  Object.assign(prep.data.content as object, { senderUserInfo: { userId: myUserId, name: myName } });
  const r = await new GroupChannel(channelId).sendMediaMessage(prep.data);
  if (!r.isOk || !r.data) throw new Error(`send failed (${r.code})`);
  return toChatMsg(r.data);
}

export function myId() {
  return myUserId;
}
