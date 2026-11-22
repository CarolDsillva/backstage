'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Small tap-to-copy chip for a code. */
export function CopyChip({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label.toLowerCase()} ${value}`}
      onClick={() => void navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#EC4F9B]/20 px-2.5 py-1 font-mono text-xs font-bold text-[#FFB3D9] ring-1 ring-[#EC4F9B]/40">
      {done ? <Check size={12} /> : <Copy size={12} />}{done ? 'Copied' : value}
    </button>
  );
}
