import type { LobbyState } from '../net/protocol';
import { colorHex } from '../theme/playerColors';

export function playerColor(lobby: LobbyState, playerId: string): string {
  return colorHex(lobby.players.find((p) => p.id === playerId)?.color);
}
