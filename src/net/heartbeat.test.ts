import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withHeartbeat } from './heartbeat';
import { createMemoryPair } from './memory';
import type { Connection } from './transport';

const opts = { intervalMs: 100, timeoutMs: 300 };

describe('withHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps two live ends open past the timeout', async () => {
    const [a, b] = createMemoryPair();
    const wa = withHeartbeat(a, opts);
    const wb = withHeartbeat(b, opts);
    const closed = vi.fn();
    wa.onClose(closed);
    wb.onClose(closed);
    await vi.advanceTimersByTimeAsync(2000);
    expect(closed).not.toHaveBeenCalled();
    wa.close();
  });

  it('passes real messages through and swallows heartbeat frames', async () => {
    const [a, b] = createMemoryPair();
    const wa = withHeartbeat(a, opts);
    const wb = withHeartbeat(b, opts);
    const got: unknown[] = [];
    wb.onMessage((m) => got.push(m));
    wa.send({ type: 'hello' });
    await vi.advanceTimersByTimeAsync(500);
    expect(got).toEqual([{ type: 'hello' }]);
    wa.close();
  });

  it('closes when the peer goes silent past the timeout', async () => {
    const [a, b] = createMemoryPair();
    const wa = withHeartbeat(a, opts);
    void b; // other end is not wrapped and never sends
    const closed = vi.fn();
    wa.onClose(closed);
    await vi.advanceTimersByTimeAsync(250);
    expect(closed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('stops sending after close and leaves no timers', async () => {
    const sent: unknown[] = [];
    const fake: Connection = {
      send: (m) => void sent.push(m),
      onMessage: () => {},
      onClose: () => {},
      close: () => {},
    };
    const w = withHeartbeat(fake, opts);
    await vi.advanceTimersByTimeAsync(250);
    expect(sent).toEqual([{ type: '__hb' }, { type: '__hb' }]);
    w.close();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(2);
  });

  it('fires onClose once, and clears timers when the other side closes', async () => {
    const [a, b] = createMemoryPair();
    const wa = withHeartbeat(a, opts);
    const closed = vi.fn();
    wa.onClose(closed);
    b.close();
    wa.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes the inner connection when it closes itself, so the peer gets released', async () => {
    let innerClose: () => void = () => {};
    const close = vi.fn();
    const fake: Connection = { send: () => {}, onMessage: () => {}, onClose: (cb) => (innerClose = cb), close };
    const w = withHeartbeat(fake, opts);
    const closed = vi.fn();
    w.onClose(closed);
    innerClose();
    expect(close).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('ignores messages that arrive after it closed', async () => {
    let deliver: (m: unknown) => void = () => {};
    const fake: Connection = { send: () => {}, onMessage: (cb) => (deliver = cb), onClose: () => {}, close: () => {} };
    const w = withHeartbeat(fake, opts);
    const got = vi.fn();
    w.onMessage(got);
    w.close();
    deliver({ type: 'late' });
    expect(got).not.toHaveBeenCalled();
  });

  it('treats a local timer stall as a stall, not a dead peer', async () => {
    const [a, b] = createMemoryPair();
    const wa = withHeartbeat(a, opts);
    const wb = withHeartbeat(b, opts);
    const closed = vi.fn();
    wa.onClose(closed);
    wb.onClose(closed);
    await vi.advanceTimersByTimeAsync(200);
    // The machine sleeps: the clock jumps far ahead before the next tick fires.
    vi.setSystemTime(Date.now() + 60_000);
    await vi.advanceTimersByTimeAsync(100);
    expect(closed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(closed).not.toHaveBeenCalled();
    wa.close();
  });
});
