'use client';
import { useRef, useState } from 'react';

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
    try {
      await onText(t);
      setText('');
    } catch {
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

  return (
    <form onSubmit={send} className="border-t border-line bg-night/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      {error && <p role="alert" className="mb-1 px-1 text-xs text-gel">{error}</p>}
      {progress !== null && <p className="mb-1 px-1 text-xs text-haze">Uploading photo… {Math.round(progress)}%</p>}
      <div className="flex items-end gap-2">
        {onPlus && (
          <button
            type="button"
            onClick={onPlus}
            disabled={disabled}
            aria-label="Add a poll, song request or meetup"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-velvet-2 text-2xl text-spot disabled:opacity-40"
          >
            +
          </button>
        )}
        {onImage && (
          <>
            <button
              type="button"
              onClick={() => file.current?.click()}
              disabled={disabled || progress !== null}
              aria-label="Send a photo"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-velvet-2 text-lg disabled:opacity-40"
            >
              📷
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
          className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-velvet px-4 py-2.5 text-mist outline-none placeholder:text-haze/60 focus:border-spot"
        />
        <button
          disabled={disabled || sending || !text.trim()}
          className="h-11 shrink-0 rounded-full bg-spot px-4 font-semibold text-ink disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}
