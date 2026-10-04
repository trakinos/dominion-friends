import type { Prompt, PromptAnswer } from '../engine/types';

/** Indices into the prompt's cards: a set for chooseCards, an ordered list for orderCards. */
export type Selection = number[];

export function toggle(prompt: Prompt, selection: Selection, index: number): Selection {
  if (prompt.kind === 'chooseCards') {
    if (!prompt.selectable.includes(index)) return selection;
    if (selection.includes(index)) return selection.filter((i) => i !== index);
    if (prompt.max === 1) return [index];
    return selection.length < prompt.max ? [...selection, index] : selection;
  }
  if (prompt.kind === 'orderCards') {
    if (!Number.isInteger(index) || index < 0 || index >= prompt.cards.length) return selection;
    return selection.includes(index) ? selection.filter((i) => i !== index) : [...selection, index];
  }
  return selection;
}

export function cardsAnswer(prompt: Prompt, selection: Selection): PromptAnswer | null {
  if (prompt.kind === 'chooseCards') {
    return selection.length >= prompt.min && selection.length <= prompt.max
      ? { kind: 'cards', indices: [...selection].sort((a, b) => a - b) }
      : null;
  }
  if (prompt.kind === 'orderCards') {
    return selection.length === prompt.cards.length ? { kind: 'order', order: [...selection] } : null;
  }
  return null;
}

export function selectionHint(prompt: Prompt): string {
  if (prompt.kind === 'orderCards') return 'Click the cards in order, starting with the one to put on top.';
  if (prompt.kind !== 'chooseCards') return '';
  const { min, max } = prompt;
  const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`;
  if (min === max) return `Choose ${cards(max)}.`;
  if (min === 0) return `Choose up to ${cards(max)}.`;
  return `Choose ${min} to ${max} cards.`;
}
