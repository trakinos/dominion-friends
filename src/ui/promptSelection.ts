import type { Prompt, PromptAnswer } from '../engine/types';
import type { Translator } from '../i18n';

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

export function selectionHint(prompt: Prompt, tr: Translator): string {
  if (prompt.kind === 'orderCards') return tr.t('hintOrder');
  if (prompt.kind !== 'chooseCards') return '';
  const { min, max } = prompt;
  if (min === max) return max === 1 ? tr.t('hintExact1') : tr.t('hintExact', { n: max });
  if (min === 0) return max === 1 ? tr.t('hintUpTo1') : tr.t('hintUpTo', { n: max });
  return tr.t('hintRange', { min, max });
}
