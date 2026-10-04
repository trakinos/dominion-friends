import type { CardId } from '../../engine/types';
import { Card } from './Card';

interface Props {
  cards: CardId[];
  playable: boolean[];
  onPlay(handIndex: number): void;
}

export function Hand({ cards, playable, onPlay }: Props) {
  return (
    <div className="hand">
      {cards.map((id, i) => (
        <Card key={`${i}-${id}`} id={id} highlight={playable[i]} onClick={playable[i] ? () => onPlay(i) : undefined} />
      ))}
    </div>
  );
}
