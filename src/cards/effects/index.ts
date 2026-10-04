import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { ATTACK_EFFECTS } from './attacks';
import { HAND_EFFECTS } from './hand';
import { LOOK_EFFECTS } from './look';
import { SIMPLE_EFFECTS } from './simple';
import { TRANSFORM_EFFECTS } from './transform';

// Effect files must import types only: the registry reads EFFECTS at module load, so a runtime
// import of the registry or engine from an effect file causes a use-before-initialization error.
export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
  ...TRANSFORM_EFFECTS,
  ...ATTACK_EFFECTS,
  ...LOOK_EFFECTS,
};
