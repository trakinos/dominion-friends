import { GuestSession, localTokenStore, memoryTokenStore } from '../net/guest';
import { HostSession } from '../net/host';
import { connectToHost, hostWithFreshCode } from '../net/peer';
import { generateRoomCode } from '../net/roomCode';

export interface ActiveSession {
  code: string;
  /** This player's view of the room. The host plays through one too. */
  session: GuestSession;
  /** Present only in the host's tab. */
  host: HostSession | null;
  close(): void;
}

export async function hostGame(name: string): Promise<ActiveSession> {
  const peer = await hostWithFreshCode(() => generateRoomCode());
  const host = new HostSession();
  peer.onConnection((conn) => host.accept(conn));
  const session = new GuestSession(host.connectLocal(), name, memoryTokenStore());
  return {
    code: peer.code,
    session,
    host,
    close: () => {
      host.close();
      peer.destroy();
    },
  };
}

export async function joinGame(code: string, name: string): Promise<ActiveSession> {
  const conn = await connectToHost(code);
  const session = new GuestSession(conn, name, localTokenStore(code));
  return { code, session, host: null, close: () => session.leave() };
}
