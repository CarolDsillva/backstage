'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Centered } from '@/components/GigApp';

type Stats = {
  joined: number; chatters: number; messages: number; optins: number; cards: number; incidents: number;
  medianMinutesToAction: number | null; avgRating: number | null; ratings: number;
  quotes: { quote: string; name: string; rating: number }[];
};

/** Lead-only, screenshot-ready numbers for the night. */
export function StatsView({ slug }: { slug: string }) {
  const [data, setData] = useState<{ title: string; stats: Stats; at: string } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/stats?slug=${slug}`, { cache: 'no-store' });
    if (r.status === 401 || r.status === 403) return setError('Only the lead can see tonight’s numbers.');
    if (!r.ok) return setError('Couldn’t load the numbers. Reload to try again.');
    setError('');
    setData(await r.json());
  }, [slug]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <Centered title={error} />;
  if (!data) return <Centered title="Counting…" />;
  const s = data.stats;

  const rows: { value: string; label: string }[] = [
    { value: String(s.chatters), label: 'people chatted in the room' },
    { value: String(s.joined), label: 'joined the room' },
    { value: String(s.messages), label: 'messages sent' },
    { value: String(s.cards), label: 'polls, song requests and meetups posted' },
    { value: String(s.incidents), label: 'reports sent to the crew' },
    { value: s.medianMinutesToAction === null ? 'n/a' : `${s.medianMinutesToAction} min`, label: 'median time from report to crew action' },
    { value: String(s.optins), label: 'joined the fan club for the next gig' },
    { value: s.avgRating === null ? 'n/a' : `${s.avgRating} / 5`, label: `average rating from ${s.ratings} ${s.ratings === 1 ? 'person' : 'people'}` },
  ];

  return (
    <main className="stage-light min-h-dvh px-6 py-10 md:px-16">
      <div className="mx-auto max-w-5xl">
        <Link href={`/e/${slug}`} className="text-sm text-haze">‹ Back to the room</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{data.title}: the night in numbers</h1>
        <p className="mt-1 text-sm text-haze">Live from the database, updated every 15 seconds. Last update {new Date(data.at).toLocaleTimeString()}.</p>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
          {rows.map((r) => (
            <div key={r.label} className="border-t border-line pt-3">
              <dt className="text-sm text-haze">{r.label}</dt>
              <dd className="order-first text-4xl font-bold text-spot">{r.value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-12 text-xl font-semibold">What people said</h2>
        {s.quotes.length === 0 ? (
          <p className="mt-2 text-haze">No written feedback yet. It appears here after the show, from the Fan club tab.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {s.quotes.map((q, i) => (
              <li key={i} className="rounded-2xl bg-velvet p-4">
                <p>“{q.quote}”</p>
                <p className="mt-2 text-sm text-haze">{q.name}, {q.rating}/5</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
