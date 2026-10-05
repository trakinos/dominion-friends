import type { CardId, Intent } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { isPlayerColor, type PlayerColorId } from '../theme/playerColors';

export interface LobbyPlayer {
  id: string;
  name: string;
  online: boolean;
  color: PlayerColorId;
}

export interface LobbyState {
  hostId: string;
  players: LobbyPlayer[];
  kingdom: CardId[];
  inGame: boolean;
}

export type GuestMessage =
  | { type: 'hello'; name: string; token: string | null }
  | { type: 'intent'; intent: Intent }
  | { type: 'setColor'; color: PlayerColorId };

export type HostMessage =
  | { type: 'welcome'; playerId: string; token: string }
  | { type: 'lobby'; lobby: LobbyState }
  | { type: 'view'; view: PlayerView }
  | { type: 'error'; reason: string };

export const MAX_NAME_LENGTH = 20;
const MAX_TOKEN_LENGTH = 64;

export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || 'Player';
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Validates the envelope of a guest message. Intent contents are validated by the engine. */
export function parseGuestMessage(raw: unknown): GuestMessage | null {
  if (!isRecord(raw)) return null;
  if (raw.type === 'hello') {
    const token = typeof raw.token === 'string' && raw.token.length <= MAX_TOKEN_LENGTH ? raw.token : null;
    return { type: 'hello', name: cleanName(raw.name), token };
  }
  if (raw.type === 'intent' && isRecord(raw.intent) && typeof raw.intent.type === 'string') {
    return { type: 'intent', intent: raw.intent as unknown as Intent };
  }
  if (raw.type === 'setColor' && isPlayerColor(raw.color)) return { type: 'setColor', color: raw.color };
  return null;
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'welcome':
      return typeof raw.playerId === 'string' && typeof raw.token === 'string'
        ? { type: 'welcome', playerId: raw.playerId, token: raw.token }
        : null;
    case 'lobby':
      return isRecord(raw.lobby) ? { type: 'lobby', lobby: raw.lobby as unknown as LobbyState } : null;
    case 'view':
      return isRecord(raw.view) ? { type: 'view', view: raw.view as unknown as PlayerView } : null;
    case 'error':
      return typeof raw.reason === 'string' ? { type: 'error', reason: raw.reason } : null;
    default:
      return null;
  }
}
