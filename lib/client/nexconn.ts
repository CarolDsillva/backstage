'use client';
/**
 * Thin client wrapper over the Nexconn Web Chat SDK.
 * The SDK is imported dynamically so it never runs during SSR.
 */
import { BS_TYPES } from '@/lib/shared/types';

type Sdk = typeof import('@nexconn/chat');
type SdkMessage = import('@nexconn/chat').Message;

export type ConnStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

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
    senderName: info?.name ?? (m.senderUserId === 'backstagebot' ? 'Backstage' : 'Someone'),
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
export function connectNexconn(opts: { appKey: string; userId: string; name: string; token?: string }) {
  myUserId = opts.userId;
  myName = opts.name;
  connectPromise ??= (async () => {
    const sdk = await loadSdk();
    const { NCEngine, MessageHandler, ConnectionStatusHandler, ConnectionStatus } = sdk;
    NCEngine.initialize({ appKey: opts.appKey });
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
      onConnectionStatusChanged({ status: s }) {
        if (s === ConnectionStatus.CONNECTED) setStatus('online');
        else if (s === ConnectionStatus.CONNECTING) setStatus(status === 'online' ? 'reconnecting' : 'connecting');
        else setStatus('reconnecting');
      },
    }));

    let token = opts.token ?? (await fetchToken());
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await NCEngine.connect({ token });
      if (res.isOk && res.data) {
        setStatus('online');
        return res.data.userId;
      }
      // Token rejected/expired → fetch a fresh one and retry.
      token = await fetchToken();
    }
    setStatus('offline');
    connectPromise = null;
    throw new Error('Could not connect to chat');
  })();
  return connectPromise;
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
