import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Eye, Lock, Radio, Sparkles } from 'lucide-react';

/** Home: the events you can open. Demo Fest needs no code; Mic Drop takes a viewer or crew code. */
export default function Home() {
  return (
    <main className="min-h-dvh bg-[#0B0620]">
      <div className="cosmos mx-auto min-h-dvh max-w-[480px] px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#7C4DFF] text-[#FF9CCB]"><Radio size={20} /></span>
            <span className="font-display text-xl font-extrabold">Backstage</span>
          </span>
          <span className="rounded-full bg-[#251856] px-3 py-1.5 text-xs font-semibold text-[#B8ABE6]">Crew comms</span>
        </header>

        <h1 className="mt-8 font-display text-[46px] leading-[0.95] font-extrabold tracking-tight"><span className="grad-text">Every team</span><br />on one radio.</h1>
        <p className="mt-3 text-[16px] leading-snug text-[#CFC4F5]">Chat, walkie, alerts and a live map for the people who run a show: artist team, security, runners, bars and everyone in between.</p>

        <h2 className="mt-8 mb-3 flex items-center justify-between font-display text-[22px] font-extrabold">Events <span className="text-xs font-medium text-[#8C7FC0]">3 events</span></h2>

        <div className="space-y-3">
          <Link href="/e/demo-fest/crew" className="group block overflow-hidden rounded-[30px] bg-[linear-gradient(140deg,#FF6FB5_0%,#D2338B_45%,#7C4DFF_100%)] p-5 text-white shadow-[0_20px_50px_-20px_rgba(236,79,155,.7)]">
            <div className="flex items-start justify-between">
              <span className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/demofest-logo.svg" alt="" className="h-16 w-16 rounded-[18px] shadow-lg ring-2 ring-white/30" />
                <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold"><Sparkles size={13} />Try it now · no code</span>
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[#251856] px-2 py-1 text-[10px] font-bold text-[#FF8CC6]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF6B5B]" />LIVE</span>
            </div>
            <p className="mt-6 font-display text-[38px] leading-none font-extrabold">Demo Fest</p>
            <p className="mt-1 text-sm text-white/85">Bandstand Grounds, Mumbai · practice event</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm font-semibold">Be the show caller, Security or a Runner. Guided tour included.</span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#7C4DFF] transition-transform group-active:scale-95"><ArrowUpRight size={22} /></span>
            </div>
          </Link>

          <Link href="/e/mic-drop/crew" className="group block overflow-hidden rounded-[30px] bg-[radial-gradient(120%_80%_at_100%_0%,rgba(236,79,155,.35),transparent_60%),#1A1030] p-5 text-white ring-1 ring-white/10">
            <div className="flex items-start justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/raahe-logo.png" alt="Raahe" className="h-16 w-16 rounded-[18px]" />
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><Eye size={13} />Viewer or crew code</span>
            </div>
            <p className="mt-5 font-display text-[38px] leading-none font-extrabold">Mic <span className="text-[#EC4F9B]">Drop</span></p>
            <p className="mt-1 text-sm text-white/70">Raahe open mic · a café in Indiranagar, Bangalore</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/90">Watch Smera, RJ, Shashi, Vaibhav, Niharika and Divyansh run the night.</span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EC4F9B] transition-transform group-active:scale-95"><ArrowUpRight size={22} /></span>
            </div>
          </Link>

          <div className="rounded-[30px] bg-[#251856] p-5">
            <div className="flex items-start justify-between">
              <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-[#2E2470] text-[#B7AEFF]"><CalendarDays size={28} /></span>
              <span className="flex items-center gap-1.5 rounded-full bg-[#33236B] px-3 py-1 text-xs font-bold text-[#B8ABE6]"><Lock size={12} />Opens 6 Dec</span>
            </div>
            <p className="mt-5 font-display text-[30px] leading-none font-extrabold">Raahe Unplugged</p>
            <p className="mt-1 text-sm text-[#B8ABE6]">Bangalore · crew channels open on show day</p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[#8C7FC0]">
          Going to a gig? <Link href="/e/mic-drop" className="font-semibold underline">Open the audience room</Link>
        </p>
      </div>
    </main>
  );
}
