import { describe, expect, it } from 'vitest';
import { botMove } from '../sim/bigMoney';
import { HostSession, MAX_LOG_ENTRIES } from './host';
import { flush } from './memory';
import { join, seededHostOptions } from './testing';

// PeerJS refuses JSON messages of 16300 bytes or more, so stay well under.
const LIMIT = 16000;

describe('message size', () => {
  for (const seed of [1, 2, 3]) {
    it(`keeps every message small in a full 4-player game (seed ${seed})`, async () => {
      const host = new HostSession(seededHostOptions(seed));
      const clients = [await join(host, 'A', { local: true })];
      for (const name of ['B', 'C', 'D']) clients.push(await join(host, name));
      expect(host.start()).toEqual({ ok: true });
      await flush();
      const game = host.game!;
      for (let step = 0; step < 20000 && !game.state.result; step++) {
        const { playerId, intent } = botMove(game);
        clients[Number(playerId.slice(1))].send({ type: 'intent', intent });
        await flush();
      }
      expect(game.state.result).not.toBeNull();
      let max = 0;
      for (const c of clients) {
        for (const m of c.messages) {
          const size = JSON.stringify(m).length;
          max = Math.max(max, size);
          expect(size).toBeLessThan(LIMIT);
          if (m.type === 'view') expect(m.view.log.length).toBeLessThanOrEqual(MAX_LOG_ENTRIES);
        }
      }
      console.info(`seed ${seed}: max message ${max} bytes, full log ${game.state.log.length}`);
    }, 60000);
  }
});
