import type { Intent } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { parseHostMessage, type GuestMessage, type HostMessage, type LobbyState } from './protocol';
import type { Connection } from './transport';

export type GuestStatus = 'connecting' | 'joined' | 'rejected' | 'disconnected';

export interface GuestState {
  status: GuestStatus;
  playerId: string | null;
  lobby: LobbyState | null;
  view: PlayerView | null;
  /** The last error from the host: why joining failed, or why a move was refused. */
  error: string | null;
}

export interface TokenStore {
  get(): string | null;
  set(token: string): void;
}

/** One player's side of the connection, the host's own UI included. */
export class GuestSession {
  private state: GuestState = { status: 'connecting', playerId: null, lobby: null, view: null, error: null };
  private readonly listeners = new Set<(state: GuestState) => void>();

  constructor(
    private readonly conn: Connection,
    name: string,
    private readonly tokens: TokenStore,
  ) {
    conn.onMessage((raw) => {
      const msg = parseHostMessage(raw);
      if (msg) this.receive(msg);
    });
    conn.onClose(() => {
      if (this.state.status !== 'rejected') this.update({ status: 'disconnected' });
    });
    const hello: GuestMessage = { type: 'hello', name, token: tokens.get() };
    conn.send(hello);
  }

  get current(): GuestState {
    return this.state;
  }

  subscribe(listener: (state: GuestState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sendIntent(intent: Intent): void {
    if (this.state.status !== 'joined') return;
    if (this.state.error) this.update({ error: null });
    const msg: GuestMessage = { type: 'intent', intent };
    this.conn.send(msg);
  }

  dismissError(): void {
    this.update({ error: null });
  }

  leave(): void {
    this.conn.close();
  }

  private receive(msg: HostMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.tokens.set(msg.token);
        this.update({ status: 'joined', playerId: msg.playerId, error: null });
        break;
      case 'lobby':
        this.update({ lobby: msg.lobby, view: msg.lobby.inGame ? this.state.view : null });
        break;
      case 'view':
        this.update({ view: msg.view });
        break;
      case 'error':
        if (this.state.status === 'connecting') {
          this.update({ status: 'rejected', error: msg.reason });
          this.conn.close();
        } else {
          this.update({ error: msg.reason });
        }
        break;
    }
  }

  private update(patch: Partial<GuestState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}

export function localTokenStore(code: string): TokenStore {
  const key = `dmf-token-${code}`;
  return {
    get() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(token) {
      try {
        localStorage.setItem(key, token);
      } catch {
        // Storage unavailable (private mode): rejoining after a refresh won't work, but play continues.
      }
    },
  };
}

export function memoryTokenStore(initial: string | null = null): TokenStore {
  let token = initial;
  return {
    get: () => token,
    set: (value) => {
      token = value;
    },
  };
}
