import Link from 'next/link';
import { ArrowRight, CalendarDays, Eye, MapPin, MessageCircle, Phone, Plus, QrCode, Radio, Users } from 'lucide-react';
import { MyEvents } from '@/components/comms/MyEvents';
import { CopyChip } from '@/components/comms/CopyChip';

const PLANETS = [
  { r: 74, a: 0.15, c: '#FF8CC6', s: 10 }, { r: 74, a: 0.48, c: '#B7AEFF', s: 7 }, { r: 74, a: 0.8, c: '#5EE6C0', s: 9 },
  { r: 118, a: 0.05, c: '#FFCB5C', s: 8 }, { r: 118, a: 0.3, c: '#FF9A8F', s: 12 }, { r: 118, a: 0.55, c: '#8CC8FF', s: 7 },
  { r: 118, a: 0.72, c: '#D7B4FF', s: 9 }, { r: 118, a: 0.9, c: '#FFFFFF', s: 6 },
];

/** Home: what Backstage is in one glance, then the events (live first), then your own. */
export default function Home() {
  return (
    <main className="min-h-dvh bg-[#0B0620]">
      <div className="cosmos mx-auto min-h-dvh max-w-[480px] overflow-hidden px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-14 text-white">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#FF6FB5,#7C4DFF)] shadow-[0_8px_20px_-6px_rgba(124,77,255,.8)]"><Radio size={20} /></span>
            <span className="font-display text-[21px] font-extrabold tracking-tight">Backstage</span>
          </span>
          <Link href="/new" className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-[#160B36] transition-transform active:scale-95"><Plus size={16} />Create event</Link>
        </header>

        {/* Hero */}
        <section className="relative mt-2 flex flex-col items-center text-center" aria-label="Backstage">
          <div className="relative h-[260px] w-[260px]" aria-hidden>
            {[74, 118].map((r) => <span key={r} className="absolute rounded-full border border-white/[0.09]" style={{ width: r * 2, height: r * 2, left: 130 - r, top: 130 - r }} />)}
            <span className="orb absolute top-1/2 left-1/2 h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
            <div className="orbit-spin absolute inset-0">
              {PLANETS.map((p, i) => (
                <span key={i} className="absolute rounded-full" style={{
                  width: p.s, height: p.s, background: p.c, boxShadow: `0 0 12px ${p.c}`,
                  left: 130 + p.r * Math.cos(p.a * Math.PI * 2) - p.s / 2, top: 130 + p.r * Math.sin(p.a * Math.PI * 2) - p.s / 2,
                }} />
              ))}
            </div>
          </div>
          <h1 className="-mt-4 font-display text-[44px] leading-[0.95] font-extrabold tracking-tight">
            <span className="grad-text">Every team.</span><br />One frequency.
          </h1>
          <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[#B8ABE6]">
            Chat, walkie, calls and tasks for everyone running your event, from the artist team to the runners.
          </p>
        </section>

        {/* Live now */}
        <section className="mt-10" aria-label="Live now">
          <Heading title="Live now" note={<><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF6B5B]" />2 events</>} />
          <div className="space-y-5">
            <EventPoster
              art={<SunsetArt />}
              logo="/demofest-logo.svg"
              chip="Interactive demo"
              title="Sundown Sessions"
              place="Bandstand Grounds, Mumbai"
              facts={['9 teams', '10 crew on the radio']}
              note="No entry code required. Be the event manager, security lead or a runner, with a guided tour."
              crew={{ href: '/e/sundown-sessions/crew', label: 'Try the crew app' }}
              audience="/e/sundown-sessions"
            />
            <EventPoster
              art={<CloudArt />}
              logo="/raahe-logo.png"
              chip="Raahe open mic"
              title={<>Mic <span className="text-[#FF8CC6]">Drop</span></>}
              place="A café in Indiranagar, Bangalore"
              facts={['6 crew', 'Full show night']}
              note={<span className="flex flex-wrap items-center gap-2">Watch the crew run the night. <CopyChip label="Viewer code" value="micdrop-watch" /></span>}
              crew={{ href: '/e/mic-drop/crew', label: 'Crew comms' }}
              audience="/e/mic-drop"
            />
          </div>
        </section>

        {/* Coming up */}
        <section className="mt-10" aria-label="Coming up">
          <Heading title="Coming up" />
          <div className="flex items-center gap-4 rounded-[24px] bg-white/[0.05] p-4 ring-1 ring-white/[0.08]">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] bg-[#2E2470] text-[#B7AEFF]"><CalendarDays size={24} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[19px] font-bold">Raahe Unplugged</p>
              <p className="truncate text-sm text-[#B8ABE6]">Sat 6 Dec · Bangalore · opens on show day</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-10" aria-label="How it works">
          <Heading title="Run your own" />
          <ol className="grid grid-cols-3 gap-2.5">
            {[
              { icon: <Plus size={18} />, t: 'Create', d: 'Name, place, teams' },
              { icon: <QrCode size={18} />, t: 'Share', d: 'One code, one QR' },
              { icon: <MessageCircle size={18} />, t: 'Run it', d: 'Chat, walkie, tasks' },
            ].map((s, i) => (
              <li key={s.t} className="rounded-[22px] bg-white/[0.05] p-3.5 ring-1 ring-white/[0.08]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#7C4DFF]/30 text-[#D9CCFF]">{s.icon}</span>
                <p className="mt-3 text-[11px] font-bold text-[#8C7FC0]">STEP {i + 1}</p>
                <p className="font-display text-[17px] font-bold">{s.t}</p>
                <p className="mt-0.5 text-xs leading-snug text-[#B8ABE6]">{s.d}</p>
              </li>
            ))}
          </ol>
          <Link href="/new" className="mt-3 flex h-14 items-center justify-center gap-2 rounded-full bg-[linear-gradient(120deg,#FF6FB5,#7C4DFF)] font-display text-[17px] font-extrabold shadow-[0_16px_30px_-12px_rgba(124,77,255,.8)]">
            Create an event <ArrowRight size={18} />
          </Link>
        </section>

        <MyEvents />

        <p className="mt-12 text-center text-xs text-[#8C7FC0]">Built on the Nexconn Chat SDK, Chat UI kit and Call SDK</p>
      </div>
    </main>
  );
}

function Heading({ title, note }: { title: string; note?: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-end justify-between px-1">
      <h2 className="font-display text-[24px] font-extrabold tracking-tight">{title}</h2>
      {note && <span className="flex items-center gap-1.5 text-xs font-semibold text-[#B8ABE6]">{note}</span>}
    </div>
  );
}

function EventPoster({ art, logo, chip, title, place, facts, note, crew, audience }: {
  art: React.ReactNode; logo: string; chip: string; title: React.ReactNode; place: string; facts: string[];
  note: React.ReactNode; crew: { href: string; label: string }; audience: string;
}) {
  return (
    <article className="overflow-hidden rounded-[32px] bg-[#1C1045] ring-1 ring-white/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)]">
      <div className="relative h-[190px] overflow-hidden">
        {art}
        <div className="absolute inset-x-4 top-4 flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-12 w-12 rounded-[14px] shadow-lg ring-2 ring-white/25" />
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold backdrop-blur">{chip}</span>
            <span className="flex items-center gap-1 rounded-full bg-[#FF6B5B] px-2 py-1 text-[10px] font-extrabold"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
          </span>
        </div>
        <p className="absolute right-5 bottom-4 left-5 font-display text-[34px] leading-[0.95] font-extrabold drop-shadow-[0_2px_12px_rgba(0,0,0,.45)]">{title}</p>
      </div>
      <div className="p-5 pt-4">
        <p className="flex items-center gap-1.5 text-sm text-[#CFC4F5]"><MapPin size={14} className="shrink-0" />{place}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {facts.map((f) => <span key={f} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-[#D9CCFF]">{f}</span>)}
        </div>
        <div className="mt-3 text-sm leading-relaxed text-[#B8ABE6]">{note}</div>
        <div className="mt-5 grid grid-cols-[1.35fr_1fr] gap-2.5">
          <Link href={crew.href} className="flex h-13 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-[#160B36] transition-transform active:scale-[.97]">
            <Radio size={17} />{crew.label}
          </Link>
          <Link href={audience} className="flex h-13 items-center justify-center gap-2 rounded-full bg-white/[0.1] text-[15px] font-bold ring-1 ring-white/15 transition-transform active:scale-[.97]">
            <Users size={17} />Audience
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Poster art: a sunset over the sea, in CSS. */
function SunsetArt() {
  return (
    <div className="absolute inset-0" aria-hidden style={{ background: 'linear-gradient(180deg,#3B1C7A 0%,#B0347F 52%,#FF8A5B 78%,#FFC46B 100%)' }}>
      <span className="absolute right-6 top-[30%] h-32 w-32 rounded-full" style={{ background: 'radial-gradient(circle,#FFE6A3 0%,#FFB45E 55%,rgba(255,138,91,0) 72%)' }} />
      <div className="absolute inset-x-0 bottom-0 h-[34%]" style={{ background: 'linear-gradient(180deg,rgba(43,15,92,.65),#1C1045)' }} />
      
    </div>
  );
}

/** Poster art: Raahe's pink clouds on a dark sky. */
function CloudArt() {
  const cloud = 'radial-gradient(closest-side,#FF9CCB,#EC4F9B 70%,rgba(236,79,155,0))';
  return (
    <div className="absolute inset-0 bg-[#221232]" aria-hidden>
      <span className="absolute -left-10 top-10 h-28 w-56 rounded-full opacity-80 blur-[2px]" style={{ background: cloud }} />
      <span className="absolute right-[-30px] top-[70px] h-24 w-48 rounded-full opacity-70 blur-[2px]" style={{ background: cloud }} />
      <span className="absolute left-[38%] top-[-20px] h-20 w-40 rounded-full opacity-40 blur-[3px]" style={{ background: cloud }} />
      <div className="absolute inset-x-0 bottom-0 h-[45%]" style={{ background: 'linear-gradient(180deg,rgba(34,18,50,0),#1C1045)' }} />
    </div>
  );
}
