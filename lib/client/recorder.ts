'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Press-and-hold voice recording for walkie clips (MediaRecorder).
 * start() on press, stop() on release returns a File, or null if it was too short.
 */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<{ start: number; mr: MediaRecorder; chunks: Blob[] } | null>(null);
  const holding = useRef(false);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => rec.current && setSecs(Math.round((Date.now() - rec.current.start) / 1000)), 200);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    if (holding.current) return;
    holding.current = true;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!holding.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.start(200);
      rec.current = { start: Date.now(), mr, chunks };
      setSecs(0);
      setRecording(true);
    } catch {
      holding.current = false;
      setError('Allow the microphone to talk on the channel.');
    }
  }

  async function stop(): Promise<File | null> {
    if (!holding.current) return null;
    holding.current = false;
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    if (!r) return null;
    const dur = Date.now() - r.start;
    await new Promise<void>((res) => { r.mr.onstop = () => res(); r.mr.stop(); });
    r.mr.stream.getTracks().forEach((t) => t.stop());
    if (dur < 600) { setError('Hold the button while you talk.'); return null; }
    const mime = r.mr.mimeType || 'audio/webm';
    return new File(r.chunks, `walkie.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: mime });
  }

  return { recording, secs, error, setError, start, stop };
}
