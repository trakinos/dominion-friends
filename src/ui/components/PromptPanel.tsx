import { useState } from 'react';
import type { Prompt, PromptAnswer } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { cardsAnswer, selectionHint, toggle, type Selection } from '../promptSelection';
import { Card } from './Card';

interface Props {
  prompt: Prompt;
  onAnswer(answer: PromptAnswer): void;
}

export function PromptPanel({ prompt, onAnswer }: Props) {
  const { tr } = useLang();
  const [selection, setSelection] = useState<Selection>([]);
  const answer = cardsAnswer(prompt, selection);
  const pick = (i: number) => setSelection((s) => toggle(prompt, s, i));
  const confirm = (
    <button type="button" className="primary" disabled={!answer} onClick={() => answer && onAnswer(answer)}>
      {tr.t('confirm')}
    </button>
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tr.prompt(prompt)}>
      <div className="prompt panel">
        <h2>{tr.prompt(prompt)}</h2>

        {prompt.kind === 'chooseCards' && (
          <>
            <p className="prompt__hint">{selectionHint(prompt, tr)}</p>
            <div className="card-row">
              {prompt.cards.map((id, i) => {
                const allowed = prompt.selectable.includes(i);
                return (
                  <Card
                    key={i}
                    id={id}
                    selected={selection.includes(i)}
                    dimmed={!allowed}
                    onClick={allowed ? () => pick(i) : undefined}
                  />
                );
              })}
            </div>
            <div className="actions">{confirm}</div>
          </>
        )}

        {prompt.kind === 'orderCards' && (
          <>
            <p className="prompt__hint">{selectionHint(prompt, tr)}</p>
            <div className="card-row">
              {prompt.cards.map((id, i) => (
                <Card
                  key={i}
                  id={id}
                  selected={selection.includes(i)}
                  order={selection.includes(i) ? selection.indexOf(i) + 1 : undefined}
                  onClick={() => pick(i)}
                />
              ))}
            </div>
            <div className="actions">
              <button type="button" onClick={() => setSelection([])}>
                {tr.t('reset')}
              </button>
              {confirm}
            </div>
          </>
        )}

        {prompt.kind === 'chooseSupply' && (
          <>
            <div className="card-row">
              {prompt.piles.map((id) => (
                <Card key={id} id={id} onClick={() => onAnswer({ kind: 'supply', card: id })} />
              ))}
            </div>
            {prompt.optional && (
              <div className="actions">
                <button type="button" onClick={() => onAnswer({ kind: 'supply', card: null })}>
                  {tr.t('skip')}
                </button>
              </div>
            )}
          </>
        )}

        {prompt.kind === 'chooseOption' && (
          <>
            {prompt.cards && (
              <div className="card-row">
                {prompt.cards.map((id, i) => (
                  <Card key={i} id={id} />
                ))}
              </div>
            )}
            <div className="actions">
              {prompt.options.map((_, i) => (
                <button key={i} type="button" className={i === 0 ? 'primary' : ''} onClick={() => onAnswer({ kind: 'option', index: i })}>
                  {tr.option(prompt, i)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
