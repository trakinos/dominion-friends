const SERVER_UNREACHABLE = 'Could not reach the connection server. Check your internet connection and try again.';

/** Turns PeerJS and connection errors into messages a player can act on. */
export function describePeerError(err: unknown): string {
  const type = typeof err === 'object' && err !== null ? (err as { type?: unknown }).type : undefined;
  switch (type) {
    case 'peer-unavailable':
      return 'Room not found. Check the code and try again.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return SERVER_UNREACHABLE;
    case 'browser-incompatible':
      return 'This browser does not support peer-to-peer connections.';
    default:
      return err instanceof Error && err.message ? err.message : 'Connection failed.';
  }
}
