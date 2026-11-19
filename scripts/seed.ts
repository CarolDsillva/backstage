/**
 * Seeds the demo gig. Re-runnable (upserts).
 * Usage: npx tsx --env-file=.env.local scripts/seed.ts [startsInMinutes]
 * Codes come from env CREW_CODE / LEAD_CODE / ARTIST_CODE (defaults are for local only).
 */
import venue from '../seed/venue.json';
import { db, check } from '../lib/server/db';

async function main() {
  const startsInMin = Number(process.argv[2] ?? 60);
  const start = new Date(Date.now() + startsInMin * 60_000);
  const end = new Date(start.getTime() + venue.event.durationHours * 3_600_000);
  const e = venue.event;

  check(
    await db().from('events').upsert({
      id: e.id, slug: e.slug, title: e.title, artist: e.artist, venue: e.venue,
      starts_at: start.toISOString(), ends_at: end.toISOString(),
      crew_code: process.env.CREW_CODE ?? 'crew123',
      lead_code: process.env.LEAD_CODE ?? 'lead123',
      artist_code: process.env.ARTIST_CODE ?? 'artist123',
    }),
  );
  check(
    await db().from('places').upsert(venue.places.map((p) => ({ ...p, event_id: e.id }))),
  );
  console.log(`seeded ${e.slug} (starts ${start.toISOString()})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
