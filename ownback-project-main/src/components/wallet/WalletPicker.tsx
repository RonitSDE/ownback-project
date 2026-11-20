'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { explain, safeIcon, type WalletDetail } from '@/lib/wallet';

const INSTALL = [
  { name: 'Coinbase Wallet', href: 'https://www.coinbase.com/wallet/downloads' },
  { name: 'MetaMask', href: 'https://metamask.io/download/' },
  { name: 'Rabby', href: 'https://rabby.io/' },
];

export function WalletPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { wallets, connect, connecting } = useWallet();
  const { notify } = useToast();
  const [pending, setPending] = useState<string>();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function choose(wallet: WalletDetail) {
    setPending(wallet.info.uuid);
    try {
      await connect(wallet);
      onClose();
    } catch (err) {
      notify({ kind: 'err', message: explain(err) });
    } finally {
      setPending(undefined);
    }
  }

  return (
    <dialog
      ref={ref}
      className="wallet-dialog"
      aria-labelledby="wallet-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="wallet-dialog-body">
        <div className="wallet-dialog-head">
          <h2 id="wallet-dialog-title">Connect a wallet</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {wallets.length > 0 ? (
          <ul className="wallet-list">
            {wallets.map((w) => {
              const icon = safeIcon(w.info.icon);
              return (
                <li key={w.info.uuid}>
                  <button className="wallet-option" onClick={() => choose(w)} disabled={connecting}>
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- validated data: URI from EIP-6963
                      <img src={icon} alt="" width={28} height={28} />
                    ) : (
                      <span className="wallet-fallback-icon" aria-hidden>
                        <Wallet size={16} />
                      </span>
                    )}
                    <span>{w.info.name}</span>
                    {pending === w.info.uuid && <span className="muted-inline">Check your wallet…</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="wallet-empty">
            <p>No wallet found in this browser. Install one, then reload this page:</p>
            <ul>
              {INSTALL.map((w) => (
                <li key={w.name}>
                  <a href={w.href} target="_blank" rel="noopener noreferrer">
                    {w.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="fine">OWNBACK never asks for your seed phrase and never holds your funds.</p>
      </div>
    </dialog>
  );
}
