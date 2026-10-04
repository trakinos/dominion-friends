import type { CardId } from '../../engine/types';
import { Card } from './Card';

interface Props {
  cards: CardId[];
  playable: boolean[];
  /** It is your turn and nothing is pending: cards you cannot play fade out. */
  active: boolean;
  onPlay(handIndex: number): void;
}

export function Hand({ cards, playable, active, onPlay }: Props) {
  return (
    <div className="hand">
      {cards.map((id, i) => (
        <Card
          key={`${i}-${id}`}
          id={id}
          highlight={playable[i]}
          dimmed={active && !playable[i]}
          onClick={playable[i] ? () => onPlay(i) : undefined}
        />
      ))}
    </div>
  );
}
