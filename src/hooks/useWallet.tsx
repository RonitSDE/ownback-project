'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Address, EIP1193Provider } from 'viem';
import { chain } from '@/lib/config';
import {
  authorisedAccount,
  discoverWallets,
  ensureChain,
  readChainId,
  requestAccount,
  type WalletDetail,
} from '@/lib/wallet';

const LAST_WALLET_KEY = 'ownback:last-wallet';

type WalletState = {
  wallets: WalletDetail[];
  active?: WalletDetail;
  account?: Address;
  chainId?: number;
  wrongNetwork: boolean;
  connecting: boolean;
  connect: (wallet: WalletDetail) => Promise<void>;
  switchNetwork: () => Promise<void>;
  disconnect: () => void;
  provider?: EIP1193Provider;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletDetail[]>([]);
  const [active, setActive] = useState<WalletDetail>();
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const triedRestore = useRef(false);

  useEffect(() => discoverWallets(setWallets), []);

  // Silently restore the last wallet if the site is still authorised (no prompt).
  useEffect(() => {
    if (triedRestore.current || wallets.length === 0) return;
    const last = localStorage.getItem(LAST_WALLET_KEY);
    const match = wallets.find((w) => w.info.rdns === last);
    if (!match) return;
    triedRestore.current = true;
    (async () => {
      try {
        const acct = await authorisedAccount(match.provider);
        if (!acct) return;
        setActive(match);
        setAccount(acct);
        setChainId(await readChainId(match.provider));
      } catch {
        /* wallet locked or unavailable: stay disconnected */
      }
    })();
  }, [wallets]);

  // Follow account and network changes made inside the wallet.
  useEffect(() => {
    const provider = active?.provider;
    if (!provider?.on) return;
    const onAccounts = (accounts: readonly string[]) => {
      if (accounts.length === 0) {
        setAccount(undefined);
        setActive(undefined);
        localStorage.removeItem(LAST_WALLET_KEY);
      } else {
        setAccount(accounts[0] as Address);
      }
    };
    const onChain = (id: string) => setChainId(Number(id));
    provider.on('accountsChanged', onAccounts);
    provider.on('chainChanged', onChain);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, [active]);

  const connect = useCallback(async (wallet: WalletDetail) => {
    setConnecting(true);
    try {
      const acct = await requestAccount(wallet.provider);
      await ensureChain(wallet.provider);
      setActive(wallet);
      setAccount(acct);
      setChainId(await readChainId(wallet.provider));
      localStorage.setItem(LAST_WALLET_KEY, wallet.info.rdns);
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!active) return;
    await ensureChain(active.provider);
    setChainId(await readChainId(active.provider));
  }, [active]);

  const disconnect = useCallback(() => {
    setActive(undefined);
    setAccount(undefined);
    setChainId(undefined);
    localStorage.removeItem(LAST_WALLET_KEY);
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      wallets,
      active,
      account,
      chainId,
      wrongNetwork: Boolean(account && chainId !== undefined && chainId !== chain.id),
      connecting,
      connect,
      switchNetwork,
      disconnect,
      provider: active?.provider,
    }),
    [wallets, active, account, chainId, connecting, connect, switchNetwork, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
