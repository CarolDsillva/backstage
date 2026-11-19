'use client';
import { useState } from 'react';

export type Slide = { emoji: string; title: string; body: string; tint: string };

export const AUDIENCE_SLIDES: Slide[] = [
  { emoji: '🙌', title: 'Find your people', body: 'Going alone? Post “I’m going solo” and meet others at the door. Share a ride home too.', tint: 'from-violet-600/60' },
  { emoji: '🎶', title: 'Vote the setlist', body: 'Request a song and upvote others. The top picks show up on the stage screen, live.', tint: 'from-pink-500/60' },
  { emoji: '🛟', title: 'The crew’s got you', body: 'Lost something, lost your group, or something’s wrong? Tap Help. Only the crew sees it.', tint: 'from-lime-400/50' },
];

export function onboardedKey(slug: string, who: string) {
  return `bs_onboarded_${who}_${slug}`;
}

/** Three quick cards after joining. Skippable; shown once per device. */
export function Onboarding({ slides, storageKey, name, onDone }: { slides: Slide[]; storageKey: string; name: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = slides[i];
  const last = i === slides.length - 1;

  function finish() {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // private mode: show again next time, no harm
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night" role="dialog" aria-modal="true" aria-label="Getting started">
      <div className={`absolute inset-0 bg-gradient-to-b ${s.tint} via-transparent to-transparent transition-colors duration-500`} aria-hidden />
      <div className="relative flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-sm text-haze">You’re in, {name}</p>
        <button onClick={finish} className="rounded-full px-3 py-1 text-sm text-haze">Skip</button>
      </div>

      <div key={i} className="rise relative flex flex-1 flex-col justify-center px-8">
        <span className="grid h-24 w-24 place-items-center rounded-[2rem] bg-white/10 text-5xl backdrop-blur" aria-hidden>{s.emoji}</span>
        <h2 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight">{s.title}</h2>
        <p className="mt-3 max-w-[30ch] text-lg text-haze">{s.body}</p>
      </div>

      <div className="relative flex items-center justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${slides.length}`}>
          {slides.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-spot' : 'w-1.5 bg-line'}`} />
          ))}
        </div>
        <button onClick={() => (last ? finish() : setI(i + 1))} className="h-14 rounded-full bg-spot px-8 text-lg font-bold text-ink">
          {last ? 'Enter the room' : 'Next'}
        </button>
      </div>
    </div>
  );
}
