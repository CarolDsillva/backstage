import { describe, it, expect } from 'vitest';
import { isRenderable } from '@/lib/shared/trust';
import { BS_TYPES, SYSTEM_USER_ID } from '@/lib/shared/types';

describe('isRenderable (review I3)', () => {
  it('drops a forged crew update sent by an attendee', () => {
    expect(isRenderable({ type: BS_TYPES.announce, senderId: 'u123' })).toBe(false);
    expect(isRenderable({ type: BS_TYPES.proposal, senderId: 'u123' })).toBe(false);
    expect(isRenderable({ type: BS_TYPES.poll, senderId: 'u123' })).toBe(false);
  });
  it('shows Backstage cards from the system sender', () => {
    expect(isRenderable({ type: BS_TYPES.announce, senderId: SYSTEM_USER_ID })).toBe(true);
    expect(isRenderable({ type: BS_TYPES.song, senderId: SYSTEM_USER_ID })).toBe(true);
  });
  it('shows ordinary text and images from anyone', () => {
    expect(isRenderable({ type: 'RC:TxtMsg', senderId: 'u123' })).toBe(true);
    expect(isRenderable({ type: 'RC:ImgMsg', senderId: 'u123' })).toBe(true);
  });
  it('drops unknown message types', () => {
    expect(isRenderable({ type: 'RC:FileMsg', senderId: 'u123' })).toBe(false);
  });
});
