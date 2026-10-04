import type { GameResult } from '../../engine/types';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';

interface Props {
  result: GameResult;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
}

export function EndScreen({ result, isHost, onPlayAgain, onBackToLobby, onLeave }: Props) {
  const { tr } = useLang();
  const ranked = [...result.scores].sort((a, b) => b.vp - a.vp || a.turns - b.turns);
  const winnerNames = result.scores.filter((s) => result.winners.includes(s.playerId)).map((s) => s.name);
  return (
    <main className="screen end">
      <h1>{winnerNames.length > 1 ? tr.t('sharedVictory', { names: winnerNames.join(' & ') }) : tr.t('wins', { name: winnerNames[0] })}</h1>
      <div className="table-wrap">
        <table className="scores">
          <thead>
            <tr>
              <th>{tr.t('colPlayer')}</th>
              <th>{tr.t('colVp')}</th>
              <th>{tr.t('colTurns')}</th>
              <th>{tr.t('colBreakdown')}</th>
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
                    .map(([id, row]) => `${tr.card(id as CardId)} ×${row.count} (${row.vp})`)
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
              {tr.t('playAgain')}
            </button>
            <button type="button" onClick={onBackToLobby}>
              {tr.t('backToLobby')}
            </button>
          </>
        ) : (
          <span className="muted">{tr.t('waitingHost')}</span>
        )}
        <button type="button" onClick={onLeave}>
          {tr.t('leave')}
        </button>
      </div>
    </main>
  );
}
