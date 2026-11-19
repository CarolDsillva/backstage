import { describe, it, expect } from 'vitest';
import { fanInput } from '@/lib/shared/fan';

describe('fanInput', () => {
  it('accepts an opt-in', () => {
    expect(fanInput.safeParse({ slug: 'g', action: 'optin' }).success).toBe(true);
  });
  it('rating must be 1 to 5', () => {
    expect(fanInput.safeParse({ slug: 'g', action: 'feedback', rating: 0 }).success).toBe(false);
    expect(fanInput.safeParse({ slug: 'g', action: 'feedback', rating: 6 }).success).toBe(false);
    expect(fanInput.safeParse({ slug: 'g', action: 'feedback', rating: 5 }).success).toBe(true);
  });
  it('quote is optional and capped at 280', () => {
    expect(fanInput.safeParse({ slug: 'g', action: 'feedback', rating: 4, quote: 'x'.repeat(281) }).success).toBe(false);
    expect(fanInput.safeParse({ slug: 'g', action: 'feedback', rating: 4, quote: 'Loved it' }).success).toBe(true);
  });
});
