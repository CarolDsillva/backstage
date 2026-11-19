import { describe, it, expect, beforeEach } from 'vitest';
import { getEnv, resetEnvCache } from '@/lib/server/env';

const full = {
  NEXCONN_APP_KEY: 'k',
  NEXCONN_APP_SECRET: 's',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_KEY: 'svc',
  SESSION_SECRET: 'a-long-session-secret-value-123456',
  NEXT_PUBLIC_NEXCONN_APP_KEY: 'k',
};

describe('getEnv', () => {
  beforeEach(() => resetEnvCache());

  it('throws listing missing keys', () => {
    const { NEXCONN_APP_SECRET: _omit, ...rest } = full;
    expect(() => getEnv(rest)).toThrow(/NEXCONN_APP_SECRET/);
  });

  it('applies Singapore API defaults', () => {
    const env = getEnv(full);
    expect(env.NEXCONN_API_BASE).toBe('https://api.sg-light-api.com');
    expect(env.NEXCONN_API_BACKUP).toBe('https://api-b.sg-light-api.com');
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });
});
