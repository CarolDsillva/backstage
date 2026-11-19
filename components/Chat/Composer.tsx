'use client';
import { useRef, useState } from 'react';
import { Camera, Plus, SendHorizontal } from 'lucide-react';

type Props = {
  onText: (t: string) => Promise<void>;
  onImage?: (f: File, onProgress: (p: number) => void) => Promise<void>;
  onPlus?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

export function Composer({ onText, onImage, onPlus, placeholder = 'Say something to the room', disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError('');
    setText(''); // feels instant; restored if sending fails
    try {
      await onText(t);
    } catch {
      setText(t);
      setError('Message not sent. Check your connection and tap send again.');
    } finally {
      setSending(false);
    }
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !onImage) return;
    setError('');
    setProgress(0);
    try {
      await onImage(f, setProgress);
    } catch {
      setError('Photo not sent. Try a smaller photo or check your connection.');
    } finally {
      setProgress(null);
    }
  }

  const iconBtn = 'grid h-11 w-11 shrink-0 place-items-center rounded-full text-haze transition-colors hover:text-mist disabled:opacity-40';

  return (
    <form onSubmit={send} className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {error && <p role="alert" className="mb-1.5 px-2 text-xs text-gel">{error}</p>}
      {progress !== null && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-velvet" aria-label={`Uploading photo, ${Math.round(progress)}%`}>
          <div className="h-full bg-spot transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex items-end gap-1 rounded-[1.75rem] border border-line bg-velvet p-1 focus-within:border-spot/60">
        {onPlus && (
          <button type="button" onClick={onPlus} disabled={disabled} aria-label="Add a poll, song request or meetup" className={iconBtn}>
            <Plus size={22} />
          </button>
        )}
        {onImage && (
          <>
            <button type="button" onClick={() => file.current?.click()} disabled={disabled || progress !== null} aria-label="Send a photo" className={iconBtn}>
              <Camera size={21} />
            </button>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={pick} />
          </>
        )}
        <label className="sr-only" htmlFor="composer">Message</label>
        <textarea
          id="composer"
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          placeholder={disabled ? 'Connecting to the room…' : placeholder}
          maxLength={1000}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-mist outline-none placeholder:text-haze/60"
        />
        <button
          disabled={disabled || sending || !text.trim()}
          aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-spot text-ink transition-opacity disabled:opacity-30"
        >
          <SendHorizontal size={20} strokeWidth={2.4} />
        </button>
      </div>
    </form>
  );
}
