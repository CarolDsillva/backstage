/** Nexconn: "kicked" because the same user connected elsewhere. */
export const KICKED_CODE = 31010;

export type ConnAction = 'online' | 'wait' | 'kicked' | 'reconnect';

/** Status values follow Nexconn ConnectionStatus: 0 connected, 1 connecting, 2 disconnected, 3 suspended. */
export function connAction(status: number, code?: number): ConnAction {
  if (status === 0) return 'online';
  if (status === 1 || status === 3) return 'wait'; // the SDK retries these itself
  if (code === KICKED_CODE) return 'kicked';
  return 'reconnect'; // the SDK does not recover from DISCONNECTED on its own
}

export function backoffMs(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** attempt);
}
