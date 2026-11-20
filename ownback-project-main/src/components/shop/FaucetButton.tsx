'use client';

import { useState } from 'react';
import { usdcAbi } from '@/lib/abi';
import { addresses } from '@/lib/config';
import { explain, send } from '@/lib/wallet';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';

export function FaucetButton({ onDone }: { onDone: () => Promise<void> }) {
  const { account, provider, wrongNetwork } = useWallet();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  async function mint() {
    if (!account || !provider) return;
    setBusy(true);
    try {
      const hash = await send({
        provider,
        account,
        address: addresses.usdc!,
        abi: usdcAbi,
        functionName: 'faucet',
        args: [account, 100_000_000n],
      });
      notify({ kind: 'ok', message: 'Added 100 test USDC to your wallet.', tx: hash });
      await onDone();
    } catch (err) {
      notify({ kind: 'err', message: explain(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn" onClick={mint} disabled={busy || wrongNetwork}>
      {busy ? 'Minting…' : 'Get 100 test USDC'}
    </button>
  );
}
