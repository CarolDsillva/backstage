'use client';
import { useEffect, useRef } from 'react';

/** Bottom sheet dialog. Escape and backdrop close it; focus moves inside on open. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-velvet px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-haze">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  'h-12 w-full rounded-xl border border-line bg-night px-3 text-mist outline-none placeholder:text-haze/60 focus:border-spot';
export const primaryCls = 'h-12 w-full rounded-xl bg-spot font-semibold text-ink disabled:opacity-40';
