import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { GameResult } from '../../engine/types';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { primaryType } from '../format';
import { playerColor } from '../playerColor';
import { peakTotal, stepDelay, tallySteps } from '../tally';
import { Avatar } from './Avatar';

interface Props {
  result: GameResult;
  lobby: LobbyState;
  onDone(): void;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts VP cards onto a bar per player, then calls onDone. */
export function Tally({ result, lobby, onDone }: Props) {
  const { tr } = useLang();
  const steps = useMemo(() => tallySteps(result), [result]);
  const [shown, setShown] = useState(() => (reducedMotion() ? steps.length : 0));
  const done = shown >= steps.length;

  useEffect(() => {
    if (done) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setShown((n) => n + 1), stepDelay(shown, steps.length));
    return () => clearTimeout(timer);
  }, [shown, done]);

  const peak = useMemo(() => peakTotal(steps), [steps]);
  return (
    <div className="tally">
      {result.scores.map((s, i) => {
        const mine = steps.slice(0, shown).filter((x) => x.player === i);
        const last = mine.at(-1);
        const total = last?.total ?? 0;
        const won = done && result.winners.includes(s.playerId);
        return (
          <div key={s.playerId} className={`tally__row ${won ? 'is-winner' : ''}`} style={{ '--player': playerColor(lobby, s.playerId) } as CSSProperties}>
            <Avatar name={s.name} color={playerColor(lobby, s.playerId)} />
            <span className="tally__name">{s.name}</span>
            <span className="tally__track">
              <span className="tally__fill" style={{ width: `${(Math.max(0, total) / peak) * 100}%` }} />
              {last && (
                <span key={mine.length} className={`lchip lchip--${primaryType(last.card)} tally__chip ${last.points < 0 ? 'is-minus' : ''}`}>
                  {tr.card(last.card)} {last.points > 0 ? `+${last.points}` : last.points}
                </span>
              )}
            </span>
            <b className="tally__vp">{total}</b>
          </div>
        );
      })}
      {!done && (
        <button type="button" className="ghost" onClick={() => setShown(steps.length)}>
          {tr.t('skip')}
        </button>
      )}
    </div>
  );
}
