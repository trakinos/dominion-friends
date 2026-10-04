import type { GameResult } from '../../engine/types';
import { cardName } from '../../theme';

interface Props {
  result: GameResult;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
}

export function EndScreen({ result, isHost, onPlayAgain, onBackToLobby, onLeave }: Props) {
  const ranked = [...result.scores].sort((a, b) => b.vp - a.vp || a.turns - b.turns);
  const winnerNames = result.scores.filter((s) => result.winners.includes(s.playerId)).map((s) => s.name);
  return (
    <main className="screen end">
      <h1>{winnerNames.length > 1 ? `Shared victory: ${winnerNames.join(' & ')}` : `${winnerNames[0]} wins!`}</h1>
      <div className="table-wrap">
        <table className="scores">
          <thead>
            <tr>
              <th>Player</th>
              <th>VP</th>
              <th>Turns</th>
              <th>Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s) => (
              <tr key={s.playerId} className={result.winners.includes(s.playerId) ? 'is-winner' : ''}>
                <td>{s.name}</td>
                <td>{s.vp}</td>
                <td>{s.turns}</td>
                <td>
                  {Object.entries(s.breakdown)
                    .map(([id, row]) => `${cardName(id)} ×${row.count} (${row.vp})`)
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        {isHost ? (
          <>
            <button type="button" className="primary" onClick={onPlayAgain}>
              Play again (same kingdom)
            </button>
            <button type="button" onClick={onBackToLobby}>
              Back to lobby
            </button>
          </>
        ) : (
          <span className="muted">Waiting for the host…</span>
        )}
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </div>
    </main>
  );
}
