'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { WalletPicker } from './WalletPicker';

/** Shown in place of wallet-specific content until a wallet is connected. */
export function ConnectWalletCard({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-connect">
      <div className="ob-connect-icon" aria-hidden>
        <Wallet size={26} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <Wallet size={15} /> Connect wallet
      </button>
      <WalletPicker open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
