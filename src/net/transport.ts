/** A message channel between the host and one player. PeerJS and in-memory pairs both implement it. */
export interface Connection {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
