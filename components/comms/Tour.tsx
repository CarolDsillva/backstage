'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Hands-on walkthrough: dims the screen, cuts a spotlight around the real control to use next,
 * and waits for the person to actually use it. Steps advance on a click on the target, on a named
 * signal from the app (e.g. "sent"), or on the Next button.
 */
export type TourStep = {
  target?: string; // data-tour value; none = centered card
  title: string;
  body: string;
  wait?: 'click' | `signal:${string}`;
  cta?: string; // Next button label (always shown when there is no wait)
  skip?: string; // optional escape hatch label for waits
};

const listeners = new Set<(name: string) => void>();
/** Let the app tell the tour that something happened ("sent", "voice", ...). */
export function tourSignal(name: string) {
  listeners.forEach((l) => l(name));
}

export function Tour({ steps, onStep, onDone }: { steps: TourStep[]; onStep?: (i: number) => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const advancing = useRef(false);

  const next = () => {
    if (advancing.current) return;
    advancing.current = true;
    setTimeout(() => {
      advancing.current = false;
      if (i + 1 >= steps.length) onDone();
      else { setI(i + 1); onStep?.(i + 1); }
    }, 250);
  };

  // Freeze page scrolling while the tour is up, so the spotlight never drifts with the wheel.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, []);

  // Follow the target as layouts change (tabs switch, lists load, keyboard opens).
  useEffect(() => {
    if (!step.target) { setRect(null); return; }
    let raf = 0;
    const tick = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      setRect((prev) => (r && r.width > 0 ? (prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1 ? prev : r) : null));
      raf = requestAnimationFrame(tick);
    };
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center', behavior: 'instant' });
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.target, i]);

  // Advance when the person uses the highlighted control.
  useEffect(() => {
    if (step.wait !== 'click' || !step.target) return;
    const onUp = (e: Event) => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el && e.target instanceof Node && el.contains(e.target)) next();
    };
    document.addEventListener('click', onUp, true);
    return () => document.removeEventListener('click', onUp, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!step.wait?.startsWith('signal:')) return;
    const name = step.wait.slice(7);
    const l = (n: string) => { if (n === name) next(); };
    listeners.add(l);
    return () => void listeners.delete(l);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const pad = 8;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const below = hole ? hole.top + hole.height / 2 < vh * 0.5 : false;
  const showNext = !step.wait || !!step.skip;
  const dim = 'rgba(8,3,24,0.7)';

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] [&>div]:pointer-events-auto" aria-live="polite">
      {/* Four panels around the spotlight block taps everywhere except the target. */}
      {hole ? (
        <>
          <div className="fixed inset-x-0 top-0" style={{ height: Math.max(0, hole.top), background: dim }} />
          <div className="fixed inset-x-0 bottom-0" style={{ top: hole.top + hole.height, background: dim }} />
          <div className="fixed left-0" style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left), background: dim }} />
          <div className="fixed right-0" style={{ top: hole.top, height: hole.height, left: hole.left + hole.width, background: dim }} />
          <div className="tour-ring fixed rounded-[22px]" style={{ ...hole, pointerEvents: 'none' }} />
        </>
      ) : <div className="fixed inset-0" style={{ background: dim }} />}

      <div className="pop-in fixed inset-x-4 mx-auto max-w-[340px] rounded-[26px] bg-[#24135A] p-5 text-white ring-1 ring-white/15 shadow-[0_24px_50px_-16px_rgba(0,0,0,.5)]"
        style={hole ? (below ? { top: Math.min(vh - 230, hole.top + hole.height + 14) } : { bottom: Math.min(vh - 230, vh - hole.top + 14) }) : { top: '28%' }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.14em] text-[#EC4F9B] uppercase">Step {i + 1} of {steps.length}</span>
          <button onClick={onDone} className="text-xs font-semibold text-[#8C7FC0] underline-offset-2 hover:underline">Skip tour</button>
        </div>
        <p className="mt-1.5 font-display text-[22px] leading-tight font-extrabold">{step.title}</p>
        <p className="mt-1 text-[15px] leading-snug text-[#CFC4F5]">{step.body}</p>
        {step.wait && !step.skip && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#FF8CC6]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#EC4F9B]" />Waiting for you…</p>}
        {showNext && (
          <div className="mt-4 flex gap-2">
            {step.wait && step.skip && <p className="flex flex-1 items-center gap-2 text-xs font-bold text-[#FF8CC6]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#EC4F9B]" />Waiting for you…</p>}
            <button onClick={next} className={stepBtn(!!step.wait)}>{step.wait ? step.skip : step.cta ?? 'Next'}</button>
          </div>
        )}
        <div className="mt-4 flex gap-1" aria-hidden>
          {steps.map((_, k) => <span key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? '#EC4F9B' : '#33236B' }} />)}
        </div>
      </div>
    </div>
  );
}

const stepBtn = (secondary: boolean) =>
  secondary ? 'h-10 rounded-full bg-[#33236B] px-4 text-sm font-bold text-white' : 'h-12 w-full rounded-full bg-[#7C4DFF] font-display text-base font-extrabold text-white';

export const DEMO_TOUR: TourStep[] = [
  { title: 'Welcome to Sundown Sessions 🎶', body: 'This is an interactive demo. You’re the event manager, and ten crew members are already on the radio. Let’s run the night together: a few real actions, about two minutes.', cta: 'Let’s go' },
  { target: 'take', wait: 'click', title: 'A critical issue just landed', body: 'Security says Barrier B is bowing. Tap “I’m on it” so every team knows you own it.' },
  { target: 'tab-chats', wait: 'click', title: 'Every team has a chat', body: 'Nine channels, one per team. Open Chats.' },
  { target: 'chat-security', wait: 'click', title: 'Open Security', body: 'The red dot means a critical issue is open on this channel.' },
  { target: 'composer', wait: 'signal:sent', title: 'Tell them help is coming', body: 'Type something like “Sending 2 runners to Barrier B” and send it. Watch Security reply.' },
  { target: 'call', wait: 'click', title: 'Need everyone to hear you?', body: 'The green phone calls the whole team. Their phones ring and play your voice out loud.' },
  { target: 'call-hold', wait: 'signal:called', skip: 'No mic? Skip', title: 'Hold and speak', body: 'Say “Two runners on the way to Barrier B”, then let go. Vikram will call you back.' },
  { target: 'to-walkie', wait: 'click', title: 'Hands full? Use the walkie', body: 'Crew can’t always type. Open the walkie for this channel.' },
  { target: 'ptt', wait: 'signal:voice', skip: 'No mic? Skip', title: 'Push to talk', body: 'Hold the pink button, say “Barrier B, two runners on the way”, then let go. It goes out on CH05.' },
  { target: 'tab-map', wait: 'click', title: 'See the whole venue', body: 'Open the live map: every open issue is pinned where it is, and red is critical.' },
  { target: 'tab-tasks', wait: 'click', title: 'Who’s on what', body: 'Open Tasks: every open job, who has it, and what still needs someone.' },
  { target: 'fix', wait: 'click', title: 'Barrier’s holding', body: 'That one is yours. Tap Done. Everyone sees it cleared, and Security gets the update in their chat.' },
  { title: 'That’s Backstage', body: 'Alerts for what needs you. A chat for every team. Tasks so nothing is dropped. A walkie for when you can’t type. The demo crew keep working while you look around.', cta: 'Explore on my own' },
];

export const VIEWER_TOUR: TourStep[] = [
  { title: 'You’re watching Mic Drop 👀', body: 'Raahe’s open mic at a Bangalore café, from the crew’s side: Smera, RJ, Shashi, Vaibhav, Niharika and Divyansh. You can read everything; only crew can post.', cta: 'Show me around' },
  { target: 'stats', title: 'What needs attention', body: 'Open issues first, critical ones on top, then everything happening across the event.' },
  { target: 'tab-chats', wait: 'click', title: 'Every team’s chat', body: 'Open Chats to see all nine channels.' },
  { target: 'chat-control', wait: 'click', title: 'Control: the event manager', body: 'Open Control. It’s where the event is run and every critical issue is echoed.' },
  { target: 'to-walkie', wait: 'click', title: 'The walkie', body: 'Each team channel is also a walkie channel. Open it.' },
  { target: 'tab-map', wait: 'click', title: 'The venue', body: 'Open the map to see where issues happened.' },
  { title: 'Look around', body: 'Scroll any chat to replay the night: 22 sign-ups for 14 slots, the coffee machine tripping the power, and the crowd spilling onto the footpath.', cta: 'Got it' },
];
