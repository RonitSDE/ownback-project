'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { chain, isMainnet } from '@/lib/config';

/** Network badge beside the wallet. Opens a small panel so no visitor mistakes the network or the reward asset. */
export function RealityStrip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="ob-net" ref={ref}>
      <button
        className={`ob-net-badge ${isMainnet ? 'main' : 'test'}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Network details"
      >
        <span className="ob-net-dot" aria-hidden />
        {isMainnet ? 'Mainnet' : 'Testnet'}
      </button>
      {open && (
        <div className="ob-net-panel" role="dialog" aria-label="Network details">
          <button className="ob-net-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={15} />
          </button>
          <dl>
            <dt>Network</dt>
            <dd>{chain.name}</dd>
            <dt>Rewards</dt>
            <dd>{isMainnet ? 'Eligible, approved wallets only' : 'MOCK STOCK · demo data, no real shares'}</dd>
            {!isMainnet && (
              <>
                <dt>Mainnet</dt>
                <dd>NOT DEPLOYED</dd>
              </>
            )}
            <dt>Agent</dt>
            <dd>Preferences only, NOT_EXECUTED</dd>
          </dl>
          <Link href="/judge#proofs" onClick={() => setOpen(false)}>
            Proof status →
          </Link>
        </div>
      )}
    </div>
  );
}
