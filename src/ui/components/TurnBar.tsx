import { useState } from 'react';
import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import { canPlayAllTreasures, isMyTurn } from '../moves';
import { Icon } from './Icon';

/** Action → Buy → Cleanup. Cleanup is instant in the engine, so it only ever shows as the step ahead. */
const STEPS = ['action', 'buy', 'cleanup'] as const;
const LABELS = { action: 'actionPhase', buy: 'buyPhase', cleanup: 'cleanupPhase' } as const;
const INFO = { action: 'actionPhaseInfo', buy: 'buyPhaseInfo', cleanup: 'cleanupPhaseInfo' } as const;
type Step = (typeof STEPS)[number];

interface Props {
  view: PlayerView;
  names: string[];
  onPlayAll(): void;
  onEndPhase(): void;
}

export function TurnBar({ view, names, onPlayAll, onEndPhase }: Props) {
  const { tr } = useLang();
  const mine = isMyTurn(view);
  const idle = mine && view.prompt === null && view.waitingOn === null;
  const t = view.turn;
  const [info, setInfo] = useState<Step | null>(null);
  return (
    <>
      <div className="turnbar">
        {/* keyed on the player so the pill pops in again at every turn change */}
        <strong key={t.player} className={`turn-pill ${mine ? '' : 'is-other'}`} aria-live="polite">
          {mine ? tr.t('yourTurn') : tr.t('turnOf', { name: names[t.player] })}
        </strong>
        <ol className="phases">
          {STEPS.map((step, i) => {
            const at = STEPS.indexOf(t.phase);
            const state = i < at ? 'is-done' : i === at ? 'is-on' : '';
            return (
              <li key={step} className={state} aria-current={i === at ? 'step' : undefined}>
                {i < at && <Icon name="check" />}
                {tr.t(LABELS[step])}
                <button
                  type="button"
                  className={`info-btn ${info === step ? 'is-open' : ''}`}
                  aria-label={tr.t('phaseInfo', { phase: tr.t(LABELS[step]) })}
                  title={tr.t('phaseInfo', { phase: tr.t(LABELS[step]) })}
                  aria-expanded={info === step}
                  onClick={() => setInfo(info === step ? null : step)}
                >
                  <Icon name="info" />
                </button>
              </li>
            );
          })}
        </ol>
        <div className="counters">
          <span className="ctr">
            <Icon name="action" />
            <b>{t.actions}</b>
            {tr.t('actions')}
          </span>
          <span className="ctr">
            <Icon name="buy" />
            <b>{t.buys}</b>
            {tr.t('buys')}
          </span>
          <span className="ctr">
            <Icon name="coin" />
            <b>{'$' + t.coins}</b>
          </span>
        </div>
        {idle && (
          <div className="turnbar__btns">
            <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
              <Icon name="coin" />
              {tr.t('playAllTreasures')}
            </button>
            <button type="button" className="primary" onClick={onEndPhase}>
              {t.phase === 'action' ? tr.t('endActions') : tr.t('endTurn')}
            </button>
          </div>
        )}
      </div>
      {info && (
        <div className="banner banner--info" role="note">
          <Icon name="info" />
          <span>
            <b>{tr.t(LABELS[info])}:</b> {tr.t(INFO[info])}
          </span>
          <button type="button" className="banner__close" onClick={() => setInfo(null)} aria-label={tr.t('dismiss')}>
            <Icon name="x" />
          </button>
        </div>
      )}
    </>
  );
}
