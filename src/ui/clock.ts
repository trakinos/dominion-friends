import type { LocalClock } from '../net/guest';

/** The bar turns red and pulses from here down. */
export const LOW_TIME_S = 10;

export function secondsLeft(clock: LocalClock, now: number): number {
  const total = Math.ceil(clock.totalMs / 1000);
  return Math.min(total, Math.max(0, Math.ceil((clock.deadline - now) / 1000)));
}

export function fractionLeft(clock: LocalClock, now: number): number {
  return Math.min(1, Math.max(0, (clock.deadline - now) / clock.totalMs));
}
