'use client';

import { useState } from 'react';
import { AlertTriangle, LogOut, Wallet } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { chain, isConfigured } from '@/lib/config';
import { shortAddress } from '@/lib/format';
import { explain } from '@/lib/wallet';
import { WalletPicker } from './WalletPicker';

export function WalletButton() {
  const { account, wrongNetwork, switchNetwork, disconnect } = useWallet();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);

  if (!isConfigured) return null;

  if (!account) {
    return (
      <>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Wallet size={15} /> Connect wallet
        </button>
        <WalletPicker open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        className="btn warn"
        onClick={() => switchNetwork().catch((err) => notify({ kind: 'err', message: explain(err) }))}
      >
        <AlertTriangle size={15} /> Switch to {chain.name}
      </button>
    );
  }

  return (
    <div className="account-chip">
      <span className="led" aria-hidden />
      <span className="mono">{shortAddress(account)}</span>
      <button className="icon-btn" onClick={disconnect} aria-label="Disconnect wallet" title="Disconnect">
        <LogOut size={14} />
      </button>
    </div>
  );
}
