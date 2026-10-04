import { useCallback, useSyncExternalStore } from 'react';
import type { GuestSession, GuestState } from '../net/guest';

export function useGuestState(session: GuestSession | null): GuestState | null {
  const subscribe = useCallback((onChange: () => void) => (session ? session.subscribe(onChange) : () => {}), [session]);
  return useSyncExternalStore(subscribe, () => session?.current ?? null);
}
