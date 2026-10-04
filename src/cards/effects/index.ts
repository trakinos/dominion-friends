import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { HAND_EFFECTS } from './hand';
import { SIMPLE_EFFECTS } from './simple';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
};
