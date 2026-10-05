import { useEffect, useState } from 'react';
import type { LocalClock } from '../../net/guest';
import { useLang } from '../../i18n/LangProvider';
import { LOW_TIME_S, fractionLeft, secondsLeft } from '../clock';
import { Icon } from './Icon';

/** A shrinking bar plus seconds, redrawn every animation frame. */
export function TimerBar({ clock }: { clock: LocalClock }) {
  const { tr } = useLang();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // A fresh clock must never render against a `now` left over from before it arrived.
    setNow(Date.now());
    let frame = requestAnimationFrame(function tick() {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [clock]);
  const secs = secondsLeft(clock, now);
  return (
    <span className={`timer ${secs <= LOW_TIME_S ? 'is-low' : ''}`} role="timer" aria-label={tr.t('timeLeft', { n: secs })}>
      <Icon name="clock" />
      <span className="timer__track">
        <span className="timer__fill" style={{ width: `${fractionLeft(clock, now) * 100}%` }} />
      </span>
      <b>{secs}</b>
    </span>
  );
}
