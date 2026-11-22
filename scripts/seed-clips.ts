/**
 * Posts the end-of-night walkie transmissions on Raahe Live as Nexconn HD voice messages.
 * The audio files are in public/clips (text-to-speech stand-ins for the crew's voices, demo data).
 * Run after deploying, so the clip URLs resolve:
 *   npx tsx --env-file=.env.local scripts/seed-clips.ts https://backstage-two-weld.vercel.app
 */
import { getEventBySlug } from '../lib/server/db';
import { ensureTeamChannel } from '../lib/server/crew';
import { sendGroupMessage } from '../lib/server/nexconn';
import type { TeamId } from '../lib/shared/teams';

const CLIPS: { file: string; secs: number; from: string; name: string; team: TeamId }[] = [
  { file: 'divyansh-merch', secs: 7, from: 'md_divyansh', name: 'Divyansh', team: 'runners' },
  { file: 'niharika-tissue', secs: 7, from: 'md_niharika', name: 'Niharika', team: 'hospitality' },
  { file: 'smera-wrap', secs: 8, from: 'md_smera', name: 'Smera', team: 'control' },
  { file: 'vaibhav-door', secs: 7, from: 'md_vaibhav', name: 'Vaibhav', team: 'security' },
  { file: 'shashi-mics', secs: 6, from: 'md_shashi', name: 'Shashi', team: 'production' },
  { file: 'rj-closing', secs: 6, from: 'md_rj', name: 'RJ', team: 'artist' },
];

async function main() {
  const base = process.argv[2];
  if (!base?.startsWith('https://')) throw new Error('Pass the deployed base URL');
  const ev = await getEventBySlug('mic-drop');
  if (!ev) throw new Error('mic-drop missing');
  for (const c of CLIPS) {
    const channelId = await ensureTeamChannel(ev.id, ev.title, c.team);
    await sendGroupMessage({
      from: c.from, channelId, type: 'RC:HQVCMsg',
      content: { remoteUrl: `${base}/clips/${c.file}.wav`, duration: c.secs, format: 'wav', user: { id: c.from, name: c.name } },
      push: `${c.name}: 🎙️ walkie clip`,
    });
    console.log('sent', c.file);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
