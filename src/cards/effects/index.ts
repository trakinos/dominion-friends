import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { HAND_EFFECTS } from './hand';
import { SIMPLE_EFFECTS } from './simple';
import { TRANSFORM_EFFECTS } from './transform';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
  ...TRANSFORM_EFFECTS,
};
