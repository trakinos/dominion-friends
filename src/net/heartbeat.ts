import type { Connection } from './transport';

const HEARTBEAT = { type: '__hb' };

function isHeartbeat(msg: unknown): boolean {
  return typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === '__hb';
}

/**
 * Wraps a connection with a liveness check. Abruptly dropped WebRTC peers never fire 'close',
 * so each side pings every intervalMs and closes if it hears nothing for timeoutMs.
 */
export function withHeartbeat(
  conn: Connection,
  { intervalMs = 4000, timeoutMs = 12000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Connection {
  let closed = false;
  let lastSeen = Date.now();
  const messageHandlers: ((msg: unknown) => void)[] = [];
  const closeHandlers: (() => void)[] = [];

  const finish = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    for (const handler of closeHandlers) handler();
  };

  const timer = setInterval(() => {
    if (Date.now() - lastSeen >= timeoutMs) {
      conn.close();
      finish();
      return;
    }
    conn.send(HEARTBEAT);
  }, intervalMs);

  conn.onMessage((msg) => {
    lastSeen = Date.now();
    if (isHeartbeat(msg)) return;
    for (const handler of messageHandlers) handler(msg);
  });
  conn.onClose(finish);

  return {
    send: (msg) => conn.send(msg),
    onMessage: (cb) => void messageHandlers.push(cb),
    onClose: (cb) => void closeHandlers.push(cb),
    close() {
      if (closed) return;
      conn.close();
      finish();
    },
  };
}
