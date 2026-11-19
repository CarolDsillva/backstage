import { sendGroupMessage } from './nexconn';
import { BS_TYPES, SYSTEM_USER_ID, type StateSignal } from '@/lib/shared/types';

/** Tell every client in a room to refetch. Never throws (state is already saved). */
export async function signal(channelId: string | null, s: StateSignal) {
  if (!channelId) return;
  try {
    await sendGroupMessage({ from: SYSTEM_USER_ID, channelId, type: BS_TYPES.state, content: s, persist: false });
  } catch (e) {
    console.error('signal failed', e);
  }
}

/** Post a persisted Backstage card/system message into a room. */
export async function post(channelId: string, type: string, content: Record<string, unknown>, push?: string) {
  await sendGroupMessage({
    from: SYSTEM_USER_ID, channelId, type,
    content: { ...content, senderUserInfo: { userId: SYSTEM_USER_ID, name: 'Backstage' } },
    push,
  });
}
