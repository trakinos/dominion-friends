import { describe, it, expect } from 'vitest';
import { BASIC_IDS, KINGDOM_IDS } from '../cards/registry';
import { Game } from '../engine/game';
import { createRng, shuffle } from '../engine/rng';
import type { CardType, Intent } from '../engine/types';
import { botMove } from '../sim/bigMoney';
import { DICTIONARIES } from './index';

/** Dictionary entries that no bot game reaches but real play can. The host writes the timeout lines, not the engine. */
const LOG_ALLOWLIST: string[] = ['timeout: turn ended', 'timeout: random answer'];
// Sentry and Artisan prompts: Big Money never buys those cards.
const PROMPT_ALLOWLIST: string[] = ['orderTopdeck', 'gainToHandUpTo', 'topdeckFromHand'];
const OPTION_ALLOWLIST: string[] = [];

/** Parameterised reasons are stored in the dictionary as templates. */
const normalizeReason = (r: string): string => r.replace(/^Choose between \d+ and \d+ cards$/, 'Choose between {min} and {max} cards');

const ids = new Set<string>();
const optionIds = new Set<string>();
const logTexts = new Set<string>();
const reasons = new Set<string>();

function illegalIntents(game: Game): { playerId: string; intent: Intent }[] {
  const s = game.state;
  const cur = s.players[s.turn.player].id;
  const other = s.players[(s.turn.player + 1) % s.players.length].id;
  const out: { playerId: string; intent: Intent }[] = [
    { playerId: 'nobody', intent: { type: 'endPhase' } },
    { playerId: cur, intent: null as unknown as Intent },
    { playerId: cur, intent: { type: 'bogus' } as unknown as Intent },
    { playerId: other, intent: { type: 'endPhase' } },
    { playerId: other, intent: { type: 'playAllTreasures' } },
    { playerId: cur, intent: { type: 'buy', card: 'nonexistent' } },
    { playerId: cur, intent: { type: 'buy', card: 'province' } },
    { playerId: cur, intent: { type: 'playAction', handIndex: 99 } },
    { playerId: cur, intent: { type: 'playAction', handIndex: 0 } },
    { playerId: cur, intent: { type: 'playTreasure', handIndex: 99 } },
    { playerId: cur, intent: { type: 'playTreasure', handIndex: 0 } },
    { playerId: cur, intent: { type: 'playAllTreasures' } },
    { playerId: cur, intent: { type: 'answerPrompt', answer: { kind: 'option', index: 0 } } },
    { playerId: cur, intent: { type: 'answerPrompt', answer: null as never } },
  ];
  const p = s.pending;
  if (p) {
    const owner = s.players[p.player].id;
    const notOwner = s.players.find((x) => x.id !== owner)!.id;
    out.push(
      { playerId: owner, intent: { type: 'endPhase' } },
      { playerId: notOwner, intent: { type: 'answerPrompt', answer: { kind: 'option', index: 0 } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: null as never } },
    );
    const kinds = { cards: { kind: 'cards', indices: [0] }, supply: { kind: 'supply', card: 'copper' }, option: { kind: 'option', index: 0 }, order: { kind: 'order', order: [0] } } as const;
    for (const k of Object.values(kinds)) out.push({ playerId: owner, intent: { type: 'answerPrompt', answer: k as never } });
    out.push(
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'cards', indices: ['x'] as never } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'cards', indices: [0, 0] } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'cards', indices: [99] } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'supply', card: null } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'supply', card: 'zzz' } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'option', index: 99 } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'order', order: [] } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'order', order: [0, 0, 0, 0, 0, 0, 0, 0] } } },
      { playerId: owner, intent: { type: 'answerPrompt', answer: { kind: 'order', order: Array.from({ length: p.kind === 'orderCards' ? p.cards.length : 0 }, () => 0) } } },
    );
  }
  return out;
}

function collect(seed: number): void {
  const n = 2 + (seed % 3);
  const game = Game.create({
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Bot ${i}` })),
    kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
    seed,
  });
  for (let step = 0; step < 20000 && !game.state.result; step++) {
    const p = game.state.pending;
    if (p) {
      ids.add(p.id);
      if (p.kind === 'chooseOption') p.optionIds.forEach((o) => optionIds.add(o));
    }
    if (step % 7 === 0) {
      for (const { playerId, intent } of illegalIntents(game)) {
        // Some of these happen to be legal in the current state; only rejections matter here.
        const res = game.apply(playerId, intent);
        if (!res.ok) reasons.add(normalizeReason(res.reason));
      }
    }
    const m = botMove(game);
    game.apply(m.playerId, m.intent);
  }
  // After game over, every intent is rejected.
  const res = game.apply('p0', { type: 'endPhase' });
  if (!res.ok) reasons.add(normalizeReason(res.reason));
  game.state.log.forEach((e) => logTexts.add(e.text));
}

for (let seed = 1; seed <= 200; seed++) collect(seed);

describe('i18n coverage', () => {
  const { pt, en } = DICTIONARIES;

  it('collected enough', () => {
    expect(ids.size).toBeGreaterThan(15);
    expect(reasons.size).toBeGreaterThan(20);
  });

  it('every prompt id, option id, log text and reason is translated in both languages', () => {
    for (const d of [pt, en]) {
      for (const id of ids) expect(d.prompts[id], `prompt ${id}`).toBeTruthy();
      for (const o of optionIds) expect(d.options[o], `option ${o}`).toBeTruthy();
      for (const l of logTexts) expect(d.log[l], `log ${l}`).toBeTruthy();
      for (const r of reasons) expect(d.reasons[r], `reason ${r}`).toBeTruthy();
    }
  });

  it('every card has a name and text in both languages', () => {
    for (const d of [pt, en]) {
      for (const id of [...BASIC_IDS, ...KINGDOM_IDS]) {
        expect(d.cards[id].name, id).toBeTruthy();
        expect(d.cards[id].text, id).toBeTruthy();
      }
    }
  });

  it('every card type has a label', () => {
    const types: CardType[] = ['action', 'treasure', 'victory', 'curse', 'attack', 'reaction'];
    for (const d of [pt, en]) for (const t of types) expect(d.types[t]).toBeTruthy();
  });

  it('dictionaries have no unused prompt/option/log keys', () => {
    const extra = (keys: string[], used: Set<string>, allow: string[]) => keys.filter((k) => !used.has(k) && !allow.includes(k));
    expect(extra(Object.keys(en.prompts), ids, PROMPT_ALLOWLIST)).toEqual([]);
    expect(extra(Object.keys(en.options), optionIds, OPTION_ALLOWLIST)).toEqual([]);
    expect(extra(Object.keys(en.log), logTexts, LOG_ALLOWLIST)).toEqual([]);
  });
});
