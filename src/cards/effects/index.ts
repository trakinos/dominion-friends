import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { ATTACK_EFFECTS } from './attacks';
import { HAND_EFFECTS } from './hand';
import { LOOK_EFFECTS } from './look';
import { SIMPLE_EFFECTS } from './simple';
import { TRANSFORM_EFFECTS } from './transform';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
  ...TRANSFORM_EFFECTS,
  ...ATTACK_EFFECTS,
  ...LOOK_EFFECTS,
};
