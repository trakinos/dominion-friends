// Helpers for tests only. Not imported by production code.
import { createRng, nextFloat } from '../engine/rng';
import type { HostOptions, HostSession } from './host';
import { createMemoryPair, flush } from './memory';
import type { HostMessage } from './protocol';
import type { Connection } from './transport';

export function seededHostOptions(seed = 1): HostOptions {
  const rng = createRng(seed);
  let n = 0;
  return { random: () => nextFloat(rng), makeToken: () => `token-${n++}` };
}

export interface TestClient {
  conn: Connection;
  messages: HostMessage[];
  closed: boolean;
  send(msg: unknown): void;
  last<T extends HostMessage['type']>(type: T): Extract<HostMessage, { type: T }> | undefined;
  close(): void;
}

export function connectClient(host: HostSession, opts: { local?: boolean } = {}): TestClient {
  let conn: Connection;
  if (opts.local) {
    conn = host.connectLocal();
  } else {
    const [hostEnd, clientEnd] = createMemoryPair();
    host.accept(hostEnd);
    conn = clientEnd;
  }
  const client: TestClient = {
    conn,
    messages: [],
    closed: false,
    send: (msg) => conn.send(msg),
    last: (type) => [...client.messages].reverse().find((m) => m.type === type) as never,
    close: () => conn.close(),
  };
  conn.onMessage((msg) => client.messages.push(msg as HostMessage));
  conn.onClose(() => {
    client.closed = true;
  });
  return client;
}

export async function join(
  host: HostSession,
  name: string,
  opts: { local?: boolean; token?: string } = {},
): Promise<TestClient> {
  const client = connectClient(host, opts);
  client.send({ type: 'hello', name, token: opts.token ?? null });
  await flush();
  return client;
}
