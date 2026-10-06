import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { PlayerView } from '../engine/view';
import { cardMotion, type CardMotion } from './motion';

const FLY_MS = 420;
const DRAW_MS = 380;
/** Gap between cards in a stream, so a hand of five reads as five draws. */
const STAGGER_MS = 70;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Where the cards sat after the last render, so leaving cards can fly from there. */
interface Snapshot {
  view: PlayerView;
  hand: { el: HTMLElement; rect: DOMRect }[];
  play: { el: HTMLElement; rect: DOMRect }[];
}

const cardsIn = (root: HTMLElement, zone: string) =>
  [...root.querySelectorAll<HTMLElement>(`[data-motion="${zone}"] > .card`)].map((el) => ({ el, rect: el.getBoundingClientRect() }));

function snapshot(root: HTMLElement, view: PlayerView): Snapshot {
  return { view, hand: cardsIn(root, 'hand'), play: cardsIn(root, 'play') };
}

function rectOf(root: HTMLElement, zone: string): DOMRect | null {
  const rect = root.querySelector(`[data-motion="${zone}"]`)?.getBoundingClientRect();
  // Zones hidden on phones (another tab) have no box; skip their flights.
  return rect && rect.width > 0 ? rect : null;
}

/** Reduced motion, or a background tab, whose paused animations would all replay on return. */
function stayStill(): boolean {
  return document.visibilityState === 'hidden' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

let layer: HTMLElement | null = null;
function flightLayer(): HTMLElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'flights';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}

/** The transform that puts a `from`-sized box, centred, onto `to`. */
function toward(from: DOMRect, to: DOMRect): string {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.min(1.5, Math.max(0.3, to.width / from.width));
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

/** Puts a lookalike of `source` at `rect` above the page, outside any scrolling container that would clip it. */
function ghost(source: HTMLElement, rect: DOMRect): HTMLElement {
  const g = source.cloneNode(true) as HTMLElement;
  g.classList.remove('is-highlight', 'is-clickable', 'is-dimmed', 'is-selected');
  g.removeAttribute('style');
  Object.assign(g.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  flightLayer().append(g);
  return g;
}

function play(g: HTMLElement, keyframes: Keyframe[], duration: number, delay: number, done?: () => void) {
  const anim = g.animate(keyframes, { duration, delay, easing: EASE, fill: 'both' });
  const end = () => {
    g.remove();
    done?.();
  };
  anim.onfinish = end;
  anim.oncancel = end;
}

function run(root: HTMLElement, motion: CardMotion, prev: Snapshot, view: PlayerView): void {
  const discardOf = (player: number) => rectOf(root, player === view.you ? 'discard' : `seat-${player}`);
  const deck = rectOf(root, 'deck');

  motion.flights.forEach((f, i) => {
    const from = (f.from === 'hand' ? prev.hand : prev.play)[f.index];
    const to = f.to === 'deck' ? deck : discardOf(f.player);
    if (!from || !to || from.rect.width === 0) return;
    const g = ghost(from.el, from.rect);
    play(g, [{ transform: 'none', opacity: 1 }, { transform: toward(from.rect, to), opacity: 0.4 }], FLY_MS, i * (STAGGER_MS / 2));
  });

  const discard = rectOf(root, 'discard');
  const back = root.querySelector<HTMLElement>('[data-motion="deck"] .cardback');
  if (deck && discard && back) {
    for (let i = 0; i < motion.deckToDiscard; i++) {
      const g = ghost(back, deck);
      play(g, [{ transform: 'none' }, { transform: toward(deck, discard), opacity: 0.4 }], FLY_MS, i * STAGGER_MS);
    }
  }

  // Draws follow the discards, so a Clean-up reads as "out with the old, in with the new".
  if (!deck) return;
  const start = motion.flights.length > 0 ? FLY_MS / 2 : 0;
  const hand = cardsIn(root, 'hand');
  motion.drawn.forEach((index, i) => {
    const card = hand[index];
    if (!card || card.rect.width === 0) return;
    const g = ghost(card.el, card.rect);
    // The real card waits, invisible, until its lookalike lands on it.
    card.el.style.visibility = 'hidden';
    play(g, [{ transform: toward(card.rect, deck), opacity: 0 }, { transform: 'none', opacity: 1 }], DRAW_MS, start + i * STAGGER_MS, () => {
      card.el.style.visibility = '';
    });
  });
}

/**
 * Animates cards between your deck, hand, the play area and discard piles whenever the view changes.
 * Elements opt in with `data-motion`: "hand" and "play" wrap cards, "deck", "discard" and "seat-N" are targets.
 */
export function useCardMotion(root: RefObject<HTMLElement | null>, view: PlayerView): void {
  const last = useRef<Snapshot | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const prev = last.current;
    if (prev && prev.view !== view && !stayStill()) run(el, cardMotion(prev.view, view), prev, view);
    last.current = snapshot(el, view);
  }, [view]);

  // Scrolling or resizing moves the cards; keep their last positions current.
  useEffect(() => {
    const refresh = () => {
      if (root.current && last.current) last.current = snapshot(root.current, last.current.view);
    };
    window.addEventListener('scroll', refresh, { capture: true, passive: true });
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('scroll', refresh, { capture: true });
      window.removeEventListener('resize', refresh);
    };
  }, []);
}
