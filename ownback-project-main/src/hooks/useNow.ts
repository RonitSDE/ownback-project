'use client';

import { useEffect, useState } from 'react';
import { publicClient } from '@/lib/wallet';

const RESYNC_MS = 60_000;

/** Fired after every on-chain data refresh so countdowns stay aligned with chain time. */
export const CLOCK_RESYNC_EVENT = 'ownback:clock-resync';

export function requestClockResync() {
  window.dispatchEvent(new Event(CLOCK_RESYNC_EVENT));
}

/**
 * Unix seconds on the chain's clock, ticking locally. Countdowns (refund hold, comeback window)
 * compare against on-chain timestamps, so a device clock that is off would show wrong timers.
 * The offset is measured from the latest block and re-measured every minute.
 * Starts at 0 on the server to avoid hydration mismatches.
 */
export function useNow(intervalMs = 1000): number {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let live = true;
    const sync = () =>
      publicClient
        .getBlock({ blockTag: 'latest' })
        .then((b) => live && setOffset(Number(b.timestamp) - Math.floor(Date.now() / 1000)))
        .catch(() => undefined); // keep the last known offset
    sync();
    const t = setInterval(sync, RESYNC_MS);
    window.addEventListener(CLOCK_RESYNC_EVENT, sync);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener(CLOCK_RESYNC_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000) + offset);
    tick();
    const t = setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, offset]);

  return now;
}
