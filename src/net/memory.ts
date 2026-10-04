import type { Connection } from './transport';

class MemoryEnd implements Connection {
  peer!: MemoryEnd;
  closed = false;
  private messageHandlers: ((msg: unknown) => void)[] = [];
  private closeHandlers: (() => void)[] = [];

  send(msg: unknown): void {
    if (this.closed) return;
    // A JSON round-trip mimics what crosses a real network connection.
    const copy: unknown = JSON.parse(JSON.stringify(msg));
    const target = this.peer;
    queueMicrotask(() => {
      if (!target.closed) for (const handler of target.messageHandlers) handler(copy);
    });
  }

  onMessage(cb: (msg: unknown) => void): void {
    this.messageHandlers.push(cb);
  }

  onClose(cb: () => void): void {
    this.closeHandlers.push(cb);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const handler of this.closeHandlers) handler();
    this.peer.close();
  }
}

/** Two connected ends. Used for the host's own UI and for tests. */
export function createMemoryPair(): [Connection, Connection] {
  const a = new MemoryEnd();
  const b = new MemoryEnd();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

/** Resolves after every queued message (and the replies they trigger) has been delivered. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
