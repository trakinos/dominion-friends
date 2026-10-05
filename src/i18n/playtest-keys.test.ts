import { describe, it, expect } from 'vitest';
import { PLAYER_COLORS } from '../theme/playerColors';
import { DICTIONARIES } from './index';

// Keys added in playtest round 1.
const UI_KEYS = [
  'guardTitle', 'guardTreasure', 'guardAllTreasures', 'guardBuy', 'guardCancel',
  'tallyTitle', 'tieBroken', 'yourColor',
  'turnTimer', 'timerOff', 'timerSeconds', 'timerHint', 'turnStatus', 'timeLeft',
];
const LOG_KEYS = ['timeout: turn ended', 'timeout: random answer'];
const REASONS = ['That color is taken', 'Invalid timer'];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('playtest round 1 strings', () => {
  it('has every new ui, log and reason key in both languages', () => {
    for (const d of Object.values(DICTIONARIES)) {
      for (const k of UI_KEYS) expect((d.ui as Record<string, string>)[k], `ui ${k}`).toBeTruthy();
      for (const k of LOG_KEYS) expect(d.log[k], `log ${k}`).toBeTruthy();
      for (const k of REASONS) expect(d.reasons[k], `reason ${k}`).toBeTruthy();
    }
  });

  it('has a label for every player color in both languages', () => {
    for (const d of Object.values(DICTIONARIES)) {
      for (const c of PLAYER_COLORS) {
        const key = `color${c.id[0].toUpperCase()}${c.id.slice(1)}`;
        expect((d.ui as Record<string, string>)[key], key).toBeTruthy();
      }
    }
  });

  it('keeps the same placeholders in pt and en', () => {
    const { en, pt } = DICTIONARIES;
    for (const k of UI_KEYS) {
      expect(placeholders((pt.ui as Record<string, string>)[k]), k).toEqual(placeholders((en.ui as Record<string, string>)[k]));
    }
  });
});
