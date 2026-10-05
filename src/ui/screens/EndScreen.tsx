import { useState } from 'react';
import type { CardId, GameResult } from '../../engine/types';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { primaryType } from '../format';
import { playerColor } from '../playerColor';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { Tally } from '../components/Tally';

interface Props {
  result: GameResult;
  lobby: LobbyState;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
}

export function EndScreen({ result, lobby, isHost, onPlayAgain, onBackToLobby, onLeave }: Props) {
  const { tr } = useLang();
  const ranked = [...result.scores].sort((a, b) => b.vp - a.vp || a.turns - b.turns);
  const winnerNames = result.scores.filter((s) => result.winners.includes(s.playerId)).map((s) => s.name);
  const best = Math.max(...result.scores.map((s) => s.vp));
  // One winner but a tie on points: the turn count broke it.
  const tieBroken = result.winners.length === 1 && result.scores.filter((s) => s.vp === best).length > 1;
  const [revealed, setRevealed] = useState(false);
  return (
    <main className="screen end">
      {!revealed && <h1 className="tally__title">{tr.t('tallyTitle')}</h1>}
      <Tally result={result} lobby={lobby} onDone={() => setRevealed(true)} />
      {revealed && (
        <div className="end__reveal">
          <div className="trophy" aria-hidden="true">
            <Icon name="trophy" />
          </div>
          <h1>{winnerNames.length > 1 ? tr.t('sharedVictory', { names: winnerNames.join(' & ') }) : tr.t('wins', { name: winnerNames[0] })}</h1>
          {tieBroken && <p className="muted">{tr.t('tieBroken')}</p>}
          <div className="table-wrap">
            <table className="scores">
              <thead>
                <tr>
                  <th aria-label="#" />
                  <th>{tr.t('colPlayer')}</th>
                  <th>{tr.t('colVp')}</th>
                  <th>{tr.t('colTurns')}</th>
                  <th>{tr.t('colBreakdown')}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, rank) => {
                  const won = result.winners.includes(s.playerId);
                  return (
                    <tr key={s.playerId} className={won ? 'is-winner' : ''}>
                      <td className="scores__rank">{rank + 1}</td>
                      <td>
                        <span className="scores__player">
                          <Avatar name={s.name} color={playerColor(lobby, s.playerId)} />
                          {s.name}
                          {won && (
                            <span className="pill pill--gold">
                              <Icon name="trophy" />
                              {tr.t('winnerTag')}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="scores__vp">
                        {s.vp} <span className="sr-only">{tr.t('pts')}</span>
                      </td>
                      <td>
                        <b>{s.turns}</b> <span className="sr-only">{tr.t('colTurns')}</span>
                      </td>
                      <td>
                        <span className="bd">
                          {Object.entries(s.breakdown).map(([id, row]) => (
                            <span key={id}>
                              <span className={`lchip lchip--${primaryType(id as CardId)}`}>{tr.card(id as CardId)}</span>
                              <span className="lx">
                                {' '}
                                ×{row.count} ({row.vp})
                              </span>
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="actions actions--center">
            {isHost ? (
              <>
                <button type="button" className="primary lg" onClick={onPlayAgain}>
                  <Icon name="refresh" />
                  {tr.t('playAgain')}
                </button>
                <button type="button" className="lg" onClick={onBackToLobby}>
                  {tr.t('backToLobby')}
                </button>
              </>
            ) : (
              <span className="muted">{tr.t('waitingHost')}</span>
            )}
            <button type="button" className="ghost lg" onClick={onLeave}>
              <Icon name="door" />
              {tr.t('leave')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
