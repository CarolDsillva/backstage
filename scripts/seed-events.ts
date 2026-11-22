/**
 * Seeds the two events judges see on the home screen:
 *  - mic-drop: Raahe's open mic at a Bangalore café. Six named crew members talk through the real Nexconn server API
 *    (messages, issues, fixes, announcements). This is DEMO DATA, not real usage.
 *  - demo-fest: open practice event (pick a role, no code) with ten scripted demo crew.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-events.ts [--no-chat]
 * Codes: CREW_CODE / LEAD_CODE / ARTIST_CODE / VIEWER_CODE env.
 */
import venue from '../seed/venue.json';
import { db, check, getEventBySlug, upsertUser } from '../lib/server/db';
import { issueToken, joinGroup } from '../lib/server/nexconn';

const VIEWER_POOL = 40;
import { DEMO_BOTS, enrolCrew, say, type Bot } from '../lib/server/demo';
import { raiseIssue, actOnIssue, getIssue } from '../lib/server/issues';
import { ensureTeamChannel } from '../lib/server/crew';
import { post } from '../lib/server/broadcast';
import { BS_TYPES } from '../lib/shared/types';
import type { TeamId } from '../lib/shared/teams';

const CREW: Bot[] = [
  { id: 'md_smera', name: 'Smera', team: 'control', role: 'lead' },
  { id: 'md_rj', name: 'RJ', team: 'artist', role: 'crew' },
  { id: 'md_shashi', name: 'Shashi', team: 'production', role: 'crew' },
  { id: 'md_vaibhav', name: 'Vaibhav', team: 'security', role: 'crew' },
  { id: 'md_niharika', name: 'Niharika', team: 'hospitality', role: 'crew' },
  { id: 'md_divyansh', name: 'Divyansh', team: 'runners', role: 'crew' },
];

/** The cafe's spots, on the same map layout. */
const CAFE_NAMES: Record<string, string> = {
  stage: 'Stage', barrier: 'Front row', bar1: 'Counter', bar2: 'Coffee bar', water: 'Water station',
  firstaid: 'First aid box', sideexit: 'Fire exit', toilets: 'Washroom', merch: 'Merch table', entry: 'Entry',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = () => Math.random().toString(36).slice(2, 8);

async function upsertEvent(e: { id: string; slug: string; title: string; artist: string; venue: string; codes: [string, string, string]; refs: object; names?: Record<string, string> }) {
  const start = new Date(Date.now() - 75 * 60_000);
  const end = new Date(Date.now() + 3 * 3_600_000);
  check(await db().from('events').upsert({
    id: e.id, slug: e.slug, title: e.title, artist: e.artist, venue: e.venue,
    starts_at: start.toISOString(), ends_at: end.toISOString(), phase_override: 'live',
    crew_code: e.codes[0], lead_code: e.codes[1], artist_code: e.codes[2], refs: e.refs,
  }));
  check(await db().from('places').upsert(venue.places.map((p) => ({ ...p, name: e.names?.[p.id] ?? p.name, event_id: e.id }))));
  const ev = await getEventBySlug(e.slug);
  if (!ev) throw new Error('event missing after upsert');
  return ev;
}

async function main() {
  const chat = !process.argv.includes('--no-chat');
  const env = process.env;
  if (!env.CREW_CODE || !env.LEAD_CODE || !env.ARTIST_CODE) throw new Error('Set CREW_CODE, LEAD_CODE and ARTIST_CODE');

  // The staged event. Park any older copies (and their test messages) under other slugs.
  const ID = env.MAIN_EVENT_ID ?? 'evmicdrop1';
  for (const slug of ['raahe-live', 'mic-drop']) {
    const old = check(await db().from('events').select('id').eq('slug', slug).maybeSingle()) as { id: string } | null;
    if (old && old.id !== ID) check(await db().from('events').update({ slug: `old-${old.id}` }).eq('id', old.id));
  }

  const raahe = await upsertEvent({
    id: ID, slug: 'mic-drop', title: 'Mic Drop', artist: 'Raahe', venue: 'A café in Indiranagar, Bangalore',
    codes: [env.CREW_CODE, env.LEAD_CODE, env.ARTIST_CODE], names: CAFE_NAMES,
    refs: {
      tagline: 'Raahe open mic · Bangalore',
      viewerCode: env.VIEWER_CODE ?? 'micdrop-watch',
      viewerPool: VIEWER_POOL,
      doors: '7:00 PM',
      sets: [{ time: '7:30 PM', name: 'Sign-ups close' }, { time: '7:45 PM', name: 'Open mic: 14 slots' }, { time: '9:30 PM', name: 'Raahe closing set' }],
      contacts: [{ role: 'Show caller', name: 'Smera', channel: 'CH01' }, { role: 'Host', name: 'RJ', channel: 'CH02' }, { role: 'Sound', name: 'Shashi', channel: 'CH03' }],
      notes: ['Fire exit behind the coffee bar: keep it clear', 'Each slot is 5 minutes, light flashes at 4'],
    },
  });

  const demo = await upsertEvent({
    id: 'evdemofest', slug: 'demo-fest', title: 'Demo Fest', artist: 'Neon Monsoon', venue: 'Bandstand Grounds, Mumbai',
    codes: [`crew-${rand()}`, `lead-${rand()}`, `artist-${rand()}`],
    refs: {
      demo: true, tagline: 'Practice event · try any role',
      doors: '6:30 PM',
      sets: [{ time: '7:00 PM', name: 'Opening DJ' }, { time: '8:00 PM', name: 'Neon Monsoon' }],
      contacts: [{ role: 'Stage manager', name: 'Isha', channel: 'CH01' }, { role: 'Security', name: 'Vikram', channel: 'CH05' }],
      notes: ['Everyone here except you is a scripted demo crew member.'],
    },
  });

  console.log('enrolling crews…');
  await enrolCrew(raahe, CREW);
  await enrolCrew(demo, DEMO_BOTS);
  // Make sure all nine rooms exist for both events.
  for (const ev of [raahe, demo]) {
    for (const t of ['control', 'artist', 'production', 'hospitality', 'security', 'runners', 'stalls', 'foh', 'medical'] as TeamId[]) {
      await ensureTeamChannel(ev.id, ev.title, t);
    }
  }
  // Nexconn shows group history from the moment someone joins, so read-only viewer accounts
  // must be in every room BEFORE the show night is replayed. The viewer code signs you in as one of them.
  console.log('viewer pool…');
  const pool = Array.from({ length: VIEWER_POOL }, (_, k) => `rv_${String(k + 1).padStart(2, '0')}`);
  for (const id of pool) {
    await upsertUser(id, 'Viewer');
    check(await db().from('memberships').upsert({ event_id: raahe.id, user_id: id, role: 'attendee', team: 'viewer' }));
    await issueToken(id, 'Viewer');
  }
  for (const t of ['control', 'artist', 'production', 'hospitality', 'security', 'runners', 'stalls', 'foh', 'medical'] as TeamId[]) {
    await joinGroup(await ensureTeamChannel(raahe.id, raahe.title, t), pool);
  }
  if (!chat) return console.log('done (no chat)');

  console.log('demo fest opening lines…');
  const d = (id: string) => DEMO_BOTS.find((b) => b.id === id)!;
  await say(demo, d('dm_isha'), 'control', 'Morning crew! Radio check on your team channels please 📻');
  await sleep(1200);
  await say(demo, d('dm_kabir'), 'production', 'PA is up. Line check at 5:30.');
  await sleep(1200);
  await say(demo, d('dm_arjun'), 'foh', 'Gates A and B scanners tested ✅');

  console.log('mic drop night…');
  await raaheNight(raahe);
  console.log('done');
}

type Ev = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;

async function raaheNight(ev: Ev) {
  const p = (id: string) => CREW.find((b) => b.id === id)!;
  const T = async (id: string, team: TeamId, text: string, wait = 1400) => { await say(ev, p(id), team, text); await sleep(wait); };
  const announce = async (text: string) => {
    const control = await ensureTeamChannel(ev.id, ev.title, 'control');
    await post(control, BS_TYPES.announce, { text, by: 'Smera', crew: true }, `📣 ${text}`);
    await sleep(1400);
  };
  const issue = async (id: string, team: TeamId, title: string, note: string, severity: 'normal' | 'urgent' | 'critical', placeId: string | null) => {
    const r = await raiseIssue(ev, { team, title, note, severity, placeId, reporterId: id, reporterName: p(id).name });
    await sleep(1400);
    return r.id;
  };
  const act = async (issueId: string, action: 'take' | 'fix', id: string) => {
    const i = await getIssue(issueId);
    if (i) await actOnIssue(ev, i, action, { userId: id, name: p(id).name });
    await sleep(1400);
  };

  await announce('Doors at 7. Sign-ups close 7:30. Check in on your channel when you are set.');
  await T('md_shashi', 'production', 'Two mics, one DI for guitars. Line check done ✅');
  await T('md_niharika', 'hospitality', 'Café floor set: 40 chairs, standing room at the back. Kitchen closes at 9.');
  await T('md_vaibhav', 'security', 'On the door. Wristbands ready, fire exit is clear.');
  await T('md_divyansh', 'runners', 'Floating between the counter and the stage. Shout if you need me.');
  await T('md_rj', 'artist', 'Sign-up sheet is live at the counter. 9 names already!');
  await T('md_smera', 'control', 'Lovely. RJ, cap it at 14 slots, 5 minutes each.');
  await announce('Doors open! Let’s have a good one 🎤');
  await T('md_vaibhav', 'security', 'Steady stream coming in. About 25 inside.');
  const signup = await issue('md_rj', 'artist', '22 sign-ups for 14 slots', 'People are asking if they will get a turn.', 'normal', 'stage');
  await T('md_smera', 'control', 'Keep 14. Put the rest on a waitlist and do 3-minute slots if we are ahead of time.');
  await act(signup, 'take', 'md_rj');
  await T('md_rj', 'artist', 'Waitlist is up on the board. Everyone is cool with it 👍');
  await act(signup, 'fix', 'md_rj');
  await T('md_shashi', 'production', 'Starting at 7:45 sharp. Houselights to half.');
  const mic = await issue('md_shashi', 'production', 'Mic 2 crackling', 'Cable, I think. Swapping it between slots.', 'urgent', 'stage');
  await act(mic, 'take', 'md_shashi');
  await T('md_divyansh', 'runners', 'Bringing the spare XLR from the back room.');
  await T('md_shashi', 'production', 'Swapped. Clean now 🎚️');
  await act(mic, 'fix', 'md_shashi');
  const power = await issue('md_niharika', 'hospitality', 'Coffee machine tripped the power', 'Lights at the coffee bar went off. Stage is fine.', 'urgent', 'bar2');
  await act(power, 'take', 'md_shashi');
  await T('md_shashi', 'production', 'Breaker reset. Moved the coffee machine to the other socket so it does not share with the lights.');
  await act(power, 'fix', 'md_shashi');
  await T('md_vaibhav', 'security', 'We are full. Crowd is spilling onto the footpath outside.');
  const crowd = await issue('md_vaibhav', 'security', 'Crowd spilling onto the footpath', 'Neighbours already asked us to keep the entrance clear.', 'critical', 'entry');
  await T('md_smera', 'control', 'Pausing after this slot. RJ, ask people at the back to move in please.');
  await act(crowd, 'take', 'md_vaibhav');
  await T('md_rj', 'artist', 'Done, announced it on the mic. Everyone squeezed in 😄');
  await T('md_vaibhav', 'security', 'Footpath clear. One in, one out from now.');
  await act(crowd, 'fix', 'md_vaibhav');
  await T('md_niharika', 'hospitality', 'Glass broke near the front row. Nobody hurt.');
  const glass = await issue('md_niharika', 'hospitality', 'Broken glass, front row', 'Need a broom before the next performer walks up.', 'urgent', 'barrier');
  await act(glass, 'take', 'md_divyansh');
  await T('md_divyansh', 'runners', 'Swept and mopped. Safe to walk.');
  await act(glass, 'fix', 'md_divyansh');
  await T('md_rj', 'artist', 'Slot 9 was a 12-year-old with a ukulele. The room lost it 🥹');
  await issue('md_niharika', 'hospitality', 'Washroom out of tissue', 'Restock when you get a minute.', 'normal', 'toilets');
  const merch = await issue('md_divyansh', 'runners', 'Merch table card reader not pairing', 'UPI works. Card only for now.', 'normal', 'merch');
  await act(merch, 'take', 'md_divyansh');
  await announce('Raahe closing set in 10. Last two open-mic slots, then lights down.');
  await T('md_shashi', 'production', 'Raahe’s guitar is tuned and on the stand.');
  await T('md_smera', 'control', 'Thank you all. Smoothest Mic Drop yet 💜', 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
