import { z } from 'zod';
import type { ConditionStatus, Incident, Place } from '@/lib/shared/types';
import { CATEGORY_LABEL } from '@/lib/shared/incidents';

export type Draft = {
  placeId: string;
  status: ConditionStatus;
  notice: string;
  expiresMins: number;
  source: 'ai' | 'fallback';
};

type Input = {
  incident: Incident;
  place: Place | null;
  places: Place[];
  messages: { name: string; text: string }[];
};

type Generate = (prompt: string) => Promise<string>;

const schema = z.object({
  placeId: z.string(),
  status: z.enum(['ok', 'limited', 'closed']),
  notice: z.string().trim().min(1),
  expiresMins: z.number(),
});

export function parseDraft(raw: string, places: Place[]): Omit<Draft, 'source'> | null {
  try {
    const p = schema.safeParse(JSON.parse(raw));
    if (!p.success || !places.some((x) => x.id === p.data.placeId)) return null;
    return {
      placeId: p.data.placeId,
      status: p.data.status,
      notice: p.data.notice.slice(0, 140),
      expiresMins: Math.min(240, Math.max(10, Math.round(p.data.expiresMins))),
    };
  } catch {
    return null;
  }
}

function fallback(input: Input): Draft {
  const place = input.place ?? input.places[0];
  return {
    placeId: place.id,
    status: 'limited',
    notice: input.place ? `${input.place.name}: crew update — please follow staff directions.` : 'Crew update — please follow staff directions.',
    expiresMins: 60,
    source: 'fallback',
  };
}

export function buildPrompt(input: Input): string {
  const places = input.places.map((p) => `- ${p.id}: ${p.name} (${p.kind})`).join('\n');
  const chat = input.messages.slice(-30).map((m) => `${m.name}: ${m.text}`).join('\n') || '(no messages yet)';
  return `You help the crew at a live music gig write one short, calm update for the audience.
Only describe what the crew has confirmed in the conversation. Never invent hazards, never give emergency or evacuation instructions.
If an alternative place of the same kind exists, point people to it.

Report: ${CATEGORY_LABEL[input.incident.category]}${input.place ? ` at ${input.place.name}` : ''}
Reporter's note: ${input.incident.note}

Crew conversation:
${chat}

Places (use one of these ids for placeId):
${places}

Return JSON: {"placeId": string, "status": "ok"|"limited"|"closed", "notice": string (max 140 chars, plain and friendly, addressed to the audience), "expiresMins": number (how long until the crew should recheck, 15-240)}.
Use "ok" only if the crew says the problem is fixed.`;
}

async function gemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: key });
  const res = await Promise.race([
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
  ]);
  return res.text ?? '';
}

/** Draft an audience-facing update. Never writes state; a lead must approve it. */
export async function draftProposal(input: Input, generate: Generate = gemini): Promise<Draft> {
  try {
    const d = parseDraft(await generate(buildPrompt(input)), input.places);
    return d ? { ...d, source: 'ai' } : fallback(input);
  } catch {
    return fallback(input);
  }
}
