'use client';

import { useEffect, useRef } from 'react';

/** Run `fn` now and every `ms` while the tab is visible. Skips overlapping runs. */
export function usePoll(fn: () => Promise<void>, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const tick = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        await fnRef.current();
      } finally {
        running = false;
      }
    };
    tick();
    const t = setInterval(tick, ms);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, enabled]);
}
