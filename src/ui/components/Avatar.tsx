const COLORS = ['#2c4ba8', '#b8321f', '#17716f', '#8c5a2b'];

/** A player's initial on a colored disc; the color follows the seat, so it is stable for a whole game. */
export function Avatar({ name, seat, online }: { name: string; seat: number; online?: boolean }) {
  return (
    <span className="avatar" style={{ background: COLORS[seat % COLORS.length] }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
      {online !== undefined && <span className={`dot ${online ? 'dot--on' : ''}`} />}
    </span>
  );
}
