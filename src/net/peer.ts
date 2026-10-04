import Peer, { type DataConnection } from 'peerjs';
import { withHeartbeat } from './heartbeat';
import { peerIdFor } from './roomCode';
import type { Connection } from './transport';

const CONNECT_TIMEOUT_MS = 10_000;
const HOST_ATTEMPTS = 3;

function wrap(dc: DataConnection, onClosed?: () => void): Connection {
  return {
    send(msg) {
      if (!dc.open) return;
      try {
        void dc.send(msg);
      } catch (err) {
        console.warn('Send failed', err);
      }
    },
    onMessage(cb) {
      dc.on('data', cb);
    },
    onClose(cb) {
      let fired = false;
      const once = () => {
        if (fired) return;
        fired = true;
        cb();
      };
      dc.on('close', once);
      dc.on('error', () => {
        // A channel that errored may be half-broken; tear it down so the peer is released too.
        dc.close();
        once();
      });
    },
    close() {
      dc.close();
      onClosed?.();
    },
  };
}

export interface HostPeer {
  code: string;
  onConnection(cb: (conn: Connection) => void): void;
  destroy(): void;
}

function openHostPeer(code: string): Promise<HostPeer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerIdFor(code));
    let opened = false;
    let closing = false;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    peer.on('open', () => {
      retryDelay = 1000;
      if (opened) return; // re-opened after a broker reconnect; already resolved
      opened = true;
      resolve({
        code,
        onConnection(cb) {
          peer.on('connection', (dc) => {
            dc.on('open', () => cb(withHeartbeat(wrap(dc))));
          });
        },
        destroy() {
          closing = true;
          clearTimeout(retryTimer);
          peer.destroy();
        },
      });
    });
    // Losing the broker only stops new guests from joining; existing connections keep working.
    peer.on('disconnected', () => {
      if (closing || peer.destroyed) return;
      retryTimer = setTimeout(() => {
        if (!closing && !peer.destroyed) peer.reconnect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    });
    peer.on('error', (err) => {
      if (opened) {
        console.warn('Host connection error', err);
        return;
      }
      closing = true;
      clearTimeout(retryTimer);
      peer.destroy();
      reject(err);
    });
  });
}

/** Opens the host's peer, picking a new room code if the first one is taken. */
export async function hostWithFreshCode(generate: () => string): Promise<HostPeer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await openHostPeer(generate());
    } catch (err) {
      const taken = (err as { type?: string } | null)?.type === 'unavailable-id';
      if (!taken || attempt >= HOST_ATTEMPTS) throw err;
    }
  }
}

export function connectToHost(code: string): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.destroy();
      reject(err);
    };
    const timer = setTimeout(
      () => fail(new Error('Could not connect. The code may be wrong, or your network blocks peer-to-peer connections.')),
      CONNECT_TIMEOUT_MS,
    );
    peer.on('error', fail);
    peer.on('open', () => {
      const dc = peer.connect(peerIdFor(code), { reliable: true, serialization: 'binary' });
      dc.on('error', fail);
      dc.on('close', () =>
        fail(new Error('Could not connect. The code may be wrong, or your network blocks peer-to-peer connections.')),
      );
      dc.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(withHeartbeat(wrap(dc, () => peer.destroy())));
      });
    });
  });
}
