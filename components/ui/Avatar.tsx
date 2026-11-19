const GRADIENTS = [
  'from-fuchsia-400 to-violet-600',
  'from-lime-300 to-emerald-500',
  'from-amber-300 to-pink-500',
  'from-sky-300 to-indigo-500',
  'from-rose-400 to-orange-400',
  'from-teal-300 to-cyan-600',
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Deterministic gradient avatar: the same person always gets the same colour. */
export function Avatar({ name, seed, size = 36, ring = false }: { name: string; seed?: string; size?: number; ring?: boolean }) {
  const g = GRADIENTS[hash(seed ?? name) % GRADIENTS.length];
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${g} font-bold text-ink ${ring ? 'ring-2 ring-night' : ''}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, total, size = 30 }: { names: string[]; total: number; size?: number }) {
  const shown = names.slice(0, 4);
  const extra = Math.max(0, total - shown.length);
  return (
    <span className="flex items-center">
      {shown.map((n, i) => (
        <span key={i} style={{ marginLeft: i ? -size * 0.32 : 0 }}>
          <Avatar name={n} seed={n + i} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="grid place-items-center rounded-full bg-velvet-2 font-semibold text-mist ring-2 ring-night"
          style={{ width: size, height: size, marginLeft: -size * 0.32, fontSize: size * 0.34 }}
        >
          +{extra > 99 ? '99' : extra}
        </span>
      )}
    </span>
  );
}
