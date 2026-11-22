'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

type Mine = { slug: string; title: string; venue: string; startsAt: string };

/**
 * Events this device created (kept locally, so other people's test events never clutter the list).
 * Entries whose event no longer exists are dropped.
 */
export function MyEvents() {
  const [mine, setMine] = useState<Mine[]>([]);
  useEffect(() => {
    let saved: Mine[] = [];
    try { saved = JSON.parse(localStorage.getItem('bs_my_events') ?? '[]') as Mine[]; } catch { return; }
    if (!saved.length) return;
    void Promise.all(saved.map((e) => fetch(`/api/event/${e.slug}/preview`).then((r) => (r.status === 404 ? null : e)).catch(() => e)))
      .then((list) => {
        const alive = list.filter(Boolean) as Mine[];
        setMine(alive);
        try { localStorage.setItem('bs_my_events', JSON.stringify(alive)); } catch { /* ignore */ }
      });
  }, []);
  if (!mine.length) return null;
  return (
    <section className="mt-10" aria-label="Your events">
      <h2 className="mb-3.5 px-1 font-display text-[24px] font-extrabold tracking-tight">Your events</h2>
      <ul className="space-y-2.5">
        {mine.map((e) => (
          <li key={e.slug}>
            <a href={`/e/${e.slug}/crew`} className="flex items-center gap-4 rounded-[24px] bg-white/[0.05] p-4 ring-1 ring-white/[0.08]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#FF6FB5,#7C4DFF)] font-display text-lg font-extrabold">{e.title.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[18px] font-bold">{e.title}</span>
                <span className="block truncate text-xs text-[#B8ABE6]">{new Date(e.startsAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {e.venue}</span>
              </span>
              <ArrowUpRight size={18} className="text-[#B9A2FF]" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
