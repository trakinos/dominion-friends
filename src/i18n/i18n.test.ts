import { describe, it, expect } from 'vitest';
import { DICTIONARIES, interpolate, translator } from './index';

function keyShape(o: unknown): unknown {
  if (o && typeof o === 'object') {
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, keyShape((o as Record<string, unknown>)[k])]));
  }
  return 'leaf';
}

describe('interpolate', () => {
  it('replaces params and leaves missing ones literal', () => {
    expect(interpolate('Hi {name}, {n}', { name: 'Ana', n: 3 })).toBe('Hi Ana, 3');
    expect(interpolate('Hi {x}', {})).toBe('Hi {x}');
    expect(interpolate('Hi {x}')).toBe('Hi {x}');
    expect(interpolate('Gain up to ${cost}', { cost: 4 })).toBe('Gain up to $4');
  });
});

describe('dictionaries', () => {
  it('pt and en have identical key sets', () => {
    expect(keyShape(DICTIONARIES.pt)).toEqual(keyShape(DICTIONARIES.en));
  });
});

describe('translator', () => {
  const pt = translator('pt');
  const en = translator('en');

  it('translates card names and text', () => {
    expect(pt.card('smithy')).toBe('Compre Três');
    expect(en.card('smithy')).toBe('Draw Three');
    expect(pt.cardText('village')).toBe('+1 Carta, +2 Ações.');
    expect(en.cardText('village')).toBe('+1 Card, +2 Actions.');
    expect(pt.cardType('victory')).toBe('Vitória');
  });

  it('translates ui strings', () => {
    expect(pt.t('room', { code: 'ABC' })).toBe('Sala ABC');
    expect(en.t('room', { code: 'ABC' })).toBe('Room ABC');
  });

  it('translates prompts with params and falls back to the message', () => {
    expect(pt.prompt({ id: 'discardDownTo', message: 'x', params: { n: 2 } })).toBe('Descarte 2 carta(s) até ficar com 3');
    expect(pt.prompt({ id: 'nope', message: 'fallback' })).toBe('fallback');
  });

  it('translates options by id', () => {
    const p = { optionIds: ['reveal', 'dontReveal'], options: ['Reveal', "Don't reveal"] };
    expect(pt.option(p, 0)).toBe('Revelar');
    expect(en.option(p, 1)).toBe("Don't reveal");
    expect(pt.option({ optionIds: ['zzz'], options: ['Raw'] }, 0)).toBe('Raw');
  });

  it('formats log lines', () => {
    expect(pt.logLine({ player: 0, text: 'plays', cards: ['village', 'smithy'] }, ['Ana'])).toBe('Ana joga Vila, Compre Três');
    expect(en.logLine({ player: 0, text: 'plays', cards: ['village', 'smithy'] }, ['Ana'])).toBe('Ana plays Village, Draw Three');
    expect(pt.logLine({ player: null, text: 'Game over' }, ['Ana'])).toBe('Fim de jogo');
  });

  it('translates reasons and passes unknown ones through', () => {
    expect(pt.reason('It is not your turn')).toBe('Não é a sua vez');
    expect(pt.reason('Choose between 1 and 3 cards')).toBe('Escolha de 1 a 3 cartas');
    expect(pt.reason('Something odd')).toBe('Something odd');
  });
});
