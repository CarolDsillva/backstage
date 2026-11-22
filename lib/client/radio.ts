'use client';
/**
 * Walkie-talkie radio on the Nexconn Call SDK.
 * A team's radio is one multi-party AUDIO call. Everyone's mic is muted by default;
 * holding the talk button unmutes (enableMicrophone(true)) and releasing mutes again.
 * The server remembers the live callId so people who open the channel later can joinCall().
 */
import { getCallSdk, myId } from './nexconn';
import { postJson } from './useEventState';

export type RadioStatus = 'off' | 'connecting' | 'live' | 'error';
export type RadioState = {
  team: string | null;
  callId: string | null;
  status: RadioStatus;
  talking: boolean;
  /** Remote users whose mic is open right now (they are "keying" the radio). */
  keyed: string[];
  listeners: number;
  error: string | null;
  /** An invite to a radio we are not in yet. */
  incoming: { team: string; callId: string; from: string } | null;
};

let state: RadioState = { team: null, callId: null, status: 'off', talking: false, keyed: [], listeners: 0, error: null, incoming: null };
const subs = new Set<(s: RadioState) => void>();
let handlerSet = false;
let slugRef = '';
/** Teams whose radio this device auto-joins when someone else goes live ("radio on"). */
const autoJoin = new Set<string>();

function set(p: Partial<RadioState>) {
  state = { ...state, ...p };
  subs.forEach((s) => s(state));
}

export function onRadio(cb: (s: RadioState) => void) {
  subs.add(cb);
  cb(state);
  return () => void subs.delete(cb);
}

export function radioAvailable() {
  return !!getCallSdk();
}

export function setAutoJoin(team: string, on: boolean) {
  if (on) autoJoin.add(team);
  else autoJoin.delete(team);
}

function engine() {
  const sdk = getCallSdk();
  if (!sdk) throw new Error('Radio needs the Nexconn Call SDK, which did not load on this device.');
  const eng = sdk.NCCallEngine.initialize({});
  if (!handlerSet) {
    handlerSet = true;
    eng.setCallEventHandler({
      onCallReceived({ session, extra }) {
        let team = '';
        try { team = (JSON.parse(extra ?? '{}') as { team?: string }).team ?? ''; } catch { /* not ours */ }
        const callId = session.getCallId();
        if (team && autoJoin.has(team) && state.status === 'off') {
          void accept(team, callId);
        } else {
          set({ incoming: { team, callId, from: session.getCallerUserId() } });
        }
      },
      onCallConnected({ session }) {
        set({ status: 'live', callId: session.getCallId(), listeners: session.getRemoteParticipants().length });
        void eng.enableMicrophone(false); // walkie: muted until you hold the button
      },
      onCallEnded() {
        set({ status: 'off', callId: null, team: null, talking: false, keyed: [], listeners: 0 });
      },
      onRemoteUserStateChanged() {
        const s = eng.getCurrentCallSession();
        if (s) set({ listeners: s.getRemoteParticipants().length });
      },
      onRemoteMicrophoneStateChanged({ userId, disabled }) {
        const keyed = new Set(state.keyed);
        if (disabled) keyed.delete(userId);
        else keyed.add(userId);
        set({ keyed: [...keyed] });
      },
    });
  }
  return { sdk, eng };
}

async function record(team: string, live: boolean, callId?: string) {
  if (!slugRef) return null;
  return postJson<{ ok?: boolean; callId?: string; joinExisting?: boolean }>(`/api/crew/${slugRef}/radio`, { team, live, callId });
}

/** Go on air on a team channel: join the live call if there is one, otherwise start it. */
export async function goLive(opts: { slug: string; team: string; channelId: string; members: string[]; existingCallId?: string | null }) {
  slugRef = opts.slug;
  if (state.status === 'live' && state.team === opts.team) return;
  if (state.status === 'live') await leave();
  set({ status: 'connecting', team: opts.team, error: null, incoming: null });
  try {
    const { sdk, eng } = engine();
    if (opts.existingCallId) {
      const r = await eng.joinCall({ callId: opts.existingCallId });
      if (r.code === sdk.NCCallCode.SUCCESS) return set({ callId: opts.existingCallId });
      // The stored call has ended; fall through and start a fresh one.
      await record(opts.team, false, opts.existingCallId).catch(() => null);
    }
    const others = opts.members.filter((m) => m !== myId());
    const r = await eng.startCall({
      calleeIds: others,
      callType: sdk.NCCallType.MULTI,
      mediaType: sdk.NCCallMediaType.AUDIO,
      targetId: opts.channelId,
      extra: JSON.stringify({ team: opts.team }),
    });
    if (r.code !== sdk.NCCallCode.SUCCESS || !r.callId) throw new Error(radioError(r.code, sdk.NCCallCode.VOIP_SERVICE_UNAVAILABLE));
    set({ callId: r.callId });
    const saved = await record(opts.team, true, r.callId);
    if (saved?.joinExisting && saved.callId && saved.callId !== r.callId) {
      // Someone went live at the same moment: hop onto theirs so the team stays on one channel.
      await eng.endCall({ callId: r.callId });
      await eng.joinCall({ callId: saved.callId });
      set({ callId: saved.callId });
    }
  } catch (e) {
    set({ status: 'error', error: (e as Error).message, team: null, callId: null });
  }
}

async function accept(team: string, callId: string) {
  set({ status: 'connecting', team, callId, incoming: null, error: null });
  try {
    const { sdk, eng } = engine();
    const r = await eng.acceptCall({ callId });
    if (r.code !== sdk.NCCallCode.SUCCESS) throw new Error(radioError(r.code, sdk.NCCallCode.VOIP_SERVICE_UNAVAILABLE));
  } catch (e) {
    set({ status: 'error', error: (e as Error).message, team: null, callId: null });
  }
}

function radioError(code: number, voipOff: number) {
  if (code === voipOff) {
    return 'Live radio isn’t switched on for this Nexconn app yet (audio calls are off in the Nexconn console). Hold-to-talk voice clips still work.';
  }
  return `Couldn’t reach the radio (code ${code}). Hold-to-talk voice clips still work.`;
}

export function clearRadioError() {
  if (state.status === 'error') set({ status: 'off', error: null });
}

export function acceptIncoming() {
  if (state.incoming) void accept(state.incoming.team, state.incoming.callId);
}

export async function declineIncoming() {
  const inc = state.incoming;
  set({ incoming: null });
  if (!inc) return;
  try {
    const { eng } = engine();
    await eng.endCall({ callId: inc.callId });
  } catch { /* already gone */ }
}

/** Hold-to-talk. */
export async function key(on: boolean) {
  if (state.status !== 'live') return;
  try {
    const { eng } = engine();
    await eng.enableMicrophone(on);
    set({ talking: on });
  } catch (e) {
    set({ talking: false, error: (e as Error).message });
  }
}

/** Leave the radio. The last one out marks the channel off air. */
export async function leave() {
  const { team, callId, listeners } = state;
  try {
    const { eng } = engine();
    await eng.endCall(callId ? { callId } : undefined);
  } catch { /* already ended */ }
  set({ status: 'off', team: null, callId: null, talking: false, keyed: [], listeners: 0 });
  if (team && callId && listeners === 0) await record(team, false, callId).catch(() => null);
}
