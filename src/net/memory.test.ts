import { describe, it, expect } from 'vitest';
import { createMemoryPair, flush } from './memory';

describe('memory connection pair', () => {
  it('delivers JSON copies asynchronously in both directions', async () => {
    const [a, b] = createMemoryPair();
    const atB: unknown[] = [];
    const atA: unknown[] = [];
    b.onMessage((m) => atB.push(m));
    a.onMessage((m) => atA.push(m));
    const original = { n: 1, list: [1, 2] };
    a.send(original);
    b.send('pong');
    expect(atB).toEqual([]);
    original.list.push(3);
    await flush();
    expect(atB).toEqual([{ n: 1, list: [1, 2] }]);
    expect(atA).toEqual(['pong']);
  });

  it('closes both ends and stops delivery', async () => {
    const [a, b] = createMemoryPair();
    let closedA = 0;
    let closedB = 0;
    const atB: unknown[] = [];
    a.onClose(() => closedA++);
    b.onClose(() => closedB++);
    b.onMessage((m) => atB.push(m));
    a.send('before');
    a.close();
    a.send('after');
    await flush();
    expect(closedA).toBe(1);
    expect(closedB).toBe(1);
    expect(atB).toEqual([]);
  });
});
