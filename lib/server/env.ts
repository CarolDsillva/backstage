import { z } from 'zod';

const schema = z.object({
  NEXCONN_APP_KEY: z.string().min(1),
  NEXCONN_APP_SECRET: z.string().min(1),
  NEXCONN_API_BASE: z.string().url().default('https://api.sg-light-api.com'),
  NEXCONN_API_BACKUP: z.string().url().default('https://api-b.sg-light-api.com'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(16),
  NEXT_PUBLIC_NEXCONN_APP_KEY: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Server-only. Validates env lazily so builds don't need secrets. */
export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing env: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
