import { describe, it, expect } from 'vitest';
import { connAction, KICKED_CODE } from '@/lib/shared/conn';

// Nexconn ConnectionStatus: 0 CONNECTED, 1 CONNECTING, 2 DISCONNECTED, 3 SUSPENDED
describe('connAction (review I2)', () => {
  it('connected is online', () => expect(connAction(0)).toBe('online'));
  it('connecting and suspended wait for the SDK', () => {
    expect(connAction(1)).toBe('wait');
    expect(connAction(3)).toBe('wait');
  });
  it('kicked by another session asks the user', () => expect(connAction(2, KICKED_CODE)).toBe('kicked'));
  it('any other disconnect reconnects with a fresh token', () => {
    expect(connAction(2)).toBe('reconnect');
    expect(connAction(2, 31004)).toBe('reconnect');
  });
});

import { backoffMs } from '@/lib/shared/conn';
describe('backoffMs', () => {
  it('grows and caps at 30s', () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(10)).toBe(30000);
  });
});
