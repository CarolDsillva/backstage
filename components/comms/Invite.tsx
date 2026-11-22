'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, Eye, Radio, Share2 } from 'lucide-react';
import { cx } from './ui';

/** Invite people to an event: crew (can talk) and viewers (read-only), with a QR to put on the wall. */
export function Invite({ slug, title, crew, viewer, compact }: { slug: string; title: string; crew: string; viewer: string | null; compact?: boolean }) {
  const [origin, setOrigin] = useState('');
  const [qr, setQr] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const link = `${origin}/e/${slug}/crew`;
  useEffect(() => {
    if (!origin || compact) return;
    void import('qrcode').then((m) => m.toDataURL(link, { margin: 1, width: 360, color: { dark: '#160B36', light: '#FFFFFF' } })).then(setQr).catch(() => {});
  }, [origin, link, compact]);

  const text = `Join the ${title} crew on Backstage: ${link}\nCrew code: ${crew}`;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `${title} crew`, text });
      else await navigator.clipboard.writeText(text);
    } catch { /* cancelled */ }
  }

  return (
    <div className="rounded-[26px] bg-[#251856] p-4">
      <p className="font-display text-[20px] font-extrabold">Invite your crew</p>
      <p className="text-sm text-[#B8ABE6]">They open the link, enter the code and pick their team.</p>
      {!compact && qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR code for ${link}`} className="mx-auto mt-4 h-44 w-44 rounded-2xl" />
      )}
      <div className="mt-4 space-y-2">
        <Row icon={<Radio size={16} />} label="Crew code · can talk" value={crew} />
        {viewer && <Row icon={<Eye size={16} />} label="Viewer code · read-only" value={viewer} />}
        <Row label="Link" value={link.replace(/^https?:\/\//, '')} copy={link} />
      </div>
      <button onClick={() => void share()} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7C4DFF] text-sm font-bold">
        <Share2 size={16} />Share invite
      </button>
    </div>
  );
}

function Row({ icon, label, value, copy }: { icon?: React.ReactNode; label: string; value: string; copy?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { void navigator.clipboard.writeText(copy ?? value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      className="flex w-full items-center gap-3 rounded-[16px] bg-white/[0.06] px-3.5 py-2.5 text-left" aria-label={`Copy ${label}`}>
      {icon && <span className="text-[#B9A2FF]">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-[#8C7FC0]">{label}</span>
        <span className="block truncate font-mono text-[15px] font-bold">{value}</span>
      </span>
      <span className={cx('grid h-8 w-8 place-items-center rounded-full', done ? 'bg-[#2FB392]' : 'bg-white/10')}>{done ? <Check size={15} /> : <Copy size={15} />}</span>
    </button>
  );
}
