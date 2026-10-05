/** A player's initial on a disc in their chosen color. */
export function Avatar({ name, color, online }: { name: string; color: string; online?: boolean }) {
  return (
    <span className="avatar" style={{ background: color }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
      {online !== undefined && <span className={`dot ${online ? 'dot--on' : ''}`} />}
    </span>
  );
}
