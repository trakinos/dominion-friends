import { DEFAULT_KINGDOM, KINGDOM_IDS } from '../cards/registry';
import { Game } from '../engine/game';
import { createRng, shuffle } from '../engine/rng';
import type { ApplyResult, CardId, Intent } from '../engine/types';
import { viewFor } from '../engine/view';
import { PLAYER_COLORS, type PlayerColorId } from '../theme/playerColors';
import { createMemoryPair } from './memory';
import { parseGuestMessage, type HostMessage, type LobbyState } from './protocol';
import type { Connection } from './transport';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
/** Each view carries only the recent log: keeps messages small (binary channels chunk large ones, but a whole-game log is wasteful). */
export const MAX_LOG_ENTRIES = 150;

export interface HostOptions {
  random?: () => number;
  makeToken?: () => string;
}

interface Seat {
  id: string;
  name: string;
  token: string;
  conn: Connection | null;
  color: PlayerColorId;
}

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function send(conn: Connection, msg: HostMessage): void {
  conn.send(msg);
}

/** Runs in the host's browser: owns the seats, the lobby and the game. */
export class HostSession {
  private seats: Seat[] = [];
  private hostSeatId: string | null = null;
  private nextSeat = 0;
  private kingdom: CardId[];
  private activeGame: Game | null = null;
  private readonly random: () => number;
  private readonly makeToken: () => string;

  constructor(opts: HostOptions = {}) {
    this.random = opts.random ?? Math.random;
    this.makeToken = opts.makeToken ?? randomToken;
    this.kingdom = [...DEFAULT_KINGDOM];
  }

  get game(): Game | null {
    return this.activeGame;
  }

  get lobby(): LobbyState {
    return {
      hostId: this.hostSeatId ?? '',
      players: this.seats.map((s) => ({ id: s.id, name: s.name, online: s.conn !== null, color: s.color })),
      kingdom: [...this.kingdom],
      inGame: this.activeGame !== null,
    };
  }

  /** Connects the host's own UI. The seat created through it is the host. */
  connectLocal(): Connection {
    const [hostEnd, uiEnd] = createMemoryPair();
    this.accept(hostEnd, true);
    return uiEnd;
  }

  accept(conn: Connection, isHost = false): void {
    let seat: Seat | null = null;
    conn.onMessage((raw) => {
      const msg = parseGuestMessage(raw);
      if (!msg) return;
      if (msg.type === 'hello') {
        if (!seat) seat = this.hello(conn, msg.name, msg.token, isHost);
        return;
      }
      if (msg.type === 'setColor') {
        if (seat && seat.conn === conn) this.setColor(seat, conn, msg.color);
        return;
      }
      if (seat && seat.conn === conn) this.handleIntent(seat, conn, msg.intent);
    });
    conn.onClose(() => {
      if (seat && seat.conn === conn) this.disconnected(seat);
    });
  }

  setKingdom(kingdom: CardId[]): ApplyResult {
    if (this.activeGame) return fail('Game in progress');
    const valid =
      kingdom.length === 10 && new Set(kingdom).size === 10 && kingdom.every((id) => KINGDOM_IDS.includes(id));
    if (!valid) return fail('Choose 10 different kingdom cards');
    this.kingdom = [...kingdom];
    this.broadcastLobby();
    return ok();
  }

  randomizeKingdom(): void {
    if (this.activeGame) return;
    this.kingdom = this.pickRandomKingdom();
    this.broadcastLobby();
  }

  resetKingdom(): void {
    if (this.activeGame) return;
    this.kingdom = [...DEFAULT_KINGDOM];
    this.broadcastLobby();
  }

  start(): ApplyResult {
    if (this.activeGame) return fail('Game already started');
    if (this.seats.length < MIN_PLAYERS) return fail('Need at least 2 players');
    this.activeGame = Game.create({
      players: this.seats.map((s) => ({ id: s.id, name: s.name })),
      kingdom: this.kingdom,
      seed: this.newSeed(),
    });
    this.broadcastLobby();
    this.broadcastViews();
    return ok();
  }

  playAgain(): ApplyResult {
    if (!this.activeGame?.state.result) return fail('The game is not over');
    this.activeGame = null;
    return this.start();
  }

  backToLobby(): void {
    if (!this.activeGame) return;
    this.activeGame = null;
    this.seats = this.seats.filter((s) => s.conn !== null);
    this.broadcastLobby();
  }

  private hello(conn: Connection, name: string, token: string | null, isHost: boolean): Seat | null {
    const existing = token ? this.seats.find((s) => s.token === token) : undefined;
    if (existing) {
      const previous = existing.conn;
      existing.conn = conn;
      if (previous && previous !== conn) previous.close();
      this.welcome(existing);
      this.broadcastLobby();
      this.sendView(existing);
      return existing;
    }
    if (this.activeGame) return this.reject(conn, 'Game in progress');
    if (this.seats.length >= MAX_PLAYERS) return this.reject(conn, 'Room full');

    const seat: Seat = { id: `p${this.nextSeat++}`, name, token: this.makeToken(), conn, color: this.freeColor() };
    this.seats.push(seat);
    if (isHost && this.hostSeatId === null) this.hostSeatId = seat.id;
    this.welcome(seat);
    this.broadcastLobby();
    return seat;
  }

  /** Tells the connection why it can't join. The guest closes the connection itself after reading this. */
  private reject(conn: Connection, reason: string): null {
    send(conn, { type: 'error', reason });
    return null;
  }

  private disconnected(seat: Seat): void {
    seat.conn = null;
    if (!this.activeGame) this.seats = this.seats.filter((s) => s !== seat);
    this.broadcastLobby();
  }

  private handleIntent(seat: Seat, conn: Connection, intent: Intent): void {
    if (!this.activeGame) {
      send(conn, { type: 'error', reason: 'No game in progress' });
      return;
    }
    let result: ApplyResult;
    try {
      result = this.activeGame.apply(seat.id, intent);
    } catch (err) {
      console.error('Engine error while applying intent', intent, err);
      result = fail('Something went wrong');
    }
    if (!result.ok) {
      send(conn, { type: 'error', reason: result.reason });
      return;
    }
    this.broadcastViews();
  }

  private setColor(seat: Seat, conn: Connection, color: PlayerColorId): void {
    if (this.activeGame) return void send(conn, { type: 'error', reason: 'Game in progress' });
    if (this.seats.some((s) => s !== seat && s.color === color)) return void send(conn, { type: 'error', reason: 'That color is taken' });
    seat.color = color;
    this.broadcastLobby();
  }

  private freeColor(): PlayerColorId {
    const taken = new Set(this.seats.map((s) => s.color));
    return (PLAYER_COLORS.find((c) => !taken.has(c.id)) ?? PLAYER_COLORS[0]).id;
  }

  private welcome(seat: Seat): void {
    if (seat.conn) send(seat.conn, { type: 'welcome', playerId: seat.id, token: seat.token });
  }

  private broadcastLobby(): void {
    const lobby = this.lobby;
    for (const seat of this.seats) if (seat.conn) send(seat.conn, { type: 'lobby', lobby });
  }

  private broadcastViews(): void {
    for (const seat of this.seats) this.sendView(seat);
  }

  private sendView(seat: Seat): void {
    if (seat.conn && this.activeGame) {
      const view = viewFor(this.activeGame.state, seat.id);
      send(seat.conn, { type: 'view', view: { ...view, log: view.log.slice(-MAX_LOG_ENTRIES) } });
    }
  }

  private newSeed(): number {
    return Math.floor(this.random() * 2 ** 31);
  }

  private pickRandomKingdom(): CardId[] {
    return shuffle(createRng(this.newSeed()), KINGDOM_IDS).slice(0, 10);
  }
}
