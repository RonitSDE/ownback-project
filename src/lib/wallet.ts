'use client';

import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Abi,
  type Address,
  type EIP1193Provider,
  type Hash,
  type Hex,
} from 'viem';
import { builderDataSuffix, chain, rpcUrl } from './config';

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
  batch: { multicall: false },
});

// ------------------------------------------------------------------ EIP-6963 discovery

export type WalletInfo = { uuid: string; name: string; icon: string; rdns: string };
export type WalletDetail = { info: WalletInfo; provider: EIP1193Provider };

type AnnounceEvent = CustomEvent<WalletDetail>;

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
  interface WindowEventMap {
    'eip6963:announceProvider': AnnounceEvent;
  }
}

const ICON_RE = /^data:image\/(png|svg\+xml|webp|jpeg|gif);base64,[A-Za-z0-9+/=]+$/;

/** Only render icons that are inline data URIs of an image type; anything else is dropped. */
export function safeIcon(icon: string): string | undefined {
  return ICON_RE.test(icon) ? icon : undefined;
}

/**
 * Discover every installed wallet via EIP-6963 instead of trusting whichever extension
 * won the race for `window.ethereum`. Falls back to `window.ethereum` for older wallets.
 */
export function discoverWallets(onChange: (wallets: WalletDetail[]) => void): () => void {
  const found = new Map<string, WalletDetail>();
  const emit = () => onChange([...found.values()]);
  const onAnnounce = (event: AnnounceEvent) => {
    const { info, provider } = event.detail ?? {};
    if (!info?.uuid || !info.name || !provider?.request) return;
    found.set(info.uuid, { info, provider });
    emit();
  };
  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  const fallback = setTimeout(() => {
    if (found.size === 0 && window.ethereum) {
      found.set('legacy', {
        info: { uuid: 'legacy', name: 'Browser wallet', icon: '', rdns: 'legacy.injected' },
        provider: window.ethereum,
      });
      emit();
    }
  }, 400);

  return () => {
    clearTimeout(fallback);
    window.removeEventListener('eip6963:announceProvider', onAnnounce);
  };
}

// ------------------------------------------------------------------ network + account

/** Active provider for the standalone commerce checkout. Wallet picker flows may pass a provider explicitly. */
let commerceProvider: EIP1193Provider | undefined;
export async function connectWallet(): Promise<Address> {
  const provider=commerceProvider ?? window.ethereum;
  if (!provider) throw new Error('Install or open a compatible Base wallet to continue.');
  await ensureChain(provider);
  const account=await requestAccount(provider);
  commerceProvider=provider;
  return account;
}

export class WrongNetworkError extends Error {
  constructor() {
    super(`Switch your wallet to ${chain.name} to continue.`);
  }
}

export async function readChainId(provider: EIP1193Provider): Promise<number> {
  return Number(await provider.request({ method: 'eth_chainId' }));
}

/** Ask the wallet to switch (or add) the network, then verify it actually did. */
export async function ensureChain(provider: EIP1193Provider) {
  if ((await readChainId(provider)) === chain.id) return;
  const hexId = `0x${chain.id.toString(16)}` as const;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
  } catch (err) {
    if ((err as { code?: number }).code !== 4902) throw err;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [rpcUrl],
          blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
        },
      ],
    });
  }
  if ((await readChainId(provider)) !== chain.id) throw new WrongNetworkError();
}

export async function requestAccount(provider: EIP1193Provider): Promise<Address> {
  // Ask for permissions explicitly so the wallet shows its account picker even when the
  // site is still authorised. Fall back for wallets that don't support EIP-2255.
  try {
    await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] } as never);
  } catch (err) {
    if ((err as { code?: number })?.code === 4001) throw err; // user rejected: stop here
  }
  const [account] = await provider.request({ method: 'eth_requestAccounts' });
  if (!account) throw new Error('Your wallet did not share an account.');
  return getAddress(account);
}

/** Accounts already authorised for this site, without prompting. */
export async function authorisedAccount(provider: EIP1193Provider): Promise<Address | undefined> {
  const [account] = await provider.request({ method: 'eth_accounts' });
  return account ? getAddress(account) : undefined;
}

// ------------------------------------------------------------------ transactions

/** Sign a claim using the same provider and wallet account used by OWNBACK's checkout.
 * Never silently switch to window.ethereum when the user selected another provider. */
export async function signWithConnectedWallet(account:Address,message:string):Promise<Hex>{
  const provider=commerceProvider ?? window.ethereum;
  if(!provider)throw new Error('Connect a compatible Base wallet first.');
  await ensureChain(provider);
  const signer=await authorisedAccount(provider);
  if(!signer||signer!==getAddress(account))throw new Error('Wallet account changed. Reconnect before signing.');
  const wallet=createWalletClient({chain,transport:custom(provider),account});
  return wallet.signMessage({account,message});
}

const RECEIPT_TIMEOUT_MS = 120_000;

export class StillPendingError extends Error {
  constructor(public hash: Hash) {
    super('Your transaction is still confirming. It will show up in your orders once it lands.');
  }
}

/**
 * Simulate, verify network and signer, send with the Builder Code suffix, then wait for the receipt.
 * Simulation first means a transaction that would revert never reaches the wallet prompt.
 */
export async function send(params: {
  provider?: EIP1193Provider;
  account?: Address;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  onSubmitted?: (hash: Hash) => void;
}): Promise<Hash> {
  const provider = params.provider ?? commerceProvider ?? window.ethereum;
  if (!provider) throw new Error('Connect a Base wallet first.');
  const account = params.account ?? await authorisedAccount(provider);
  if (!account) throw new Error('Connect your wallet first.');
  await ensureChain(provider);
  const signer = await authorisedAccount(provider);
  if (!signer || signer !== getAddress(account)) {
    throw new Error('The account in your wallet changed. Reconnect and try again.');
  }

  const { request } = await publicClient.simulateContract({
    account,
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  });

  const wallet = createWalletClient({ chain, transport: custom(provider), account });
  const hash = await wallet.writeContract({ ...request, dataSuffix: builderDataSuffix });
  params.onSubmitted?.(hash);

  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
    if (receipt.status !== 'success') throw new Error('The transaction reverted on-chain.');
    return hash;
  } catch (err) {
    if ((err as Error).name === 'WaitForTransactionReceiptTimeoutError') throw new StillPendingError(hash);
    throw err;
  }
}

// ------------------------------------------------------------------ errors

/** One short, human sentence for any wallet, RPC or contract error. */
export function explain(err: unknown): string {
  if (err instanceof WrongNetworkError || err instanceof StillPendingError) return err.message;
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return 'You cancelled in your wallet.';
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? revert.reason ?? '';
      return REVERT_COPY[name] ?? 'The contract rejected this transaction. Nothing was charged.';
    }
    if (/insufficient funds/i.test(err.message))
      return 'Not enough ETH for gas. Grab some from a Base Sepolia faucet.';
    return err.shortMessage;
  }
  if ((err as { code?: number })?.code === 4001) return 'You cancelled in your wallet.';
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

const REVERT_COPY: Record<string, string> = {
  RefundHold: 'Still inside the refund hold. Try again when the timer ends.',
  FirstNotSettled: 'Settle your first-purchase reward before the comeback reward.',
  WrongStatus: 'This order was already settled or refunded.',
  NoReward: 'This order did not earn a reward.',
  NotAuthorized: 'Only the customer or the OWNBACK keeper can settle this reward.',
  MerchantOnly: 'Only the campaign merchant can do that.',
  Paused: 'Rewards are paused right now. Your reward stays reserved.',
  OrderRefUsed: 'This checkout was already paid. Refresh your orders before buying again.',
  InvalidOrderRef: 'Checkout reference missing. Reload the store.',
  QuoteExpired: 'Your checkout quote expired. Nothing was charged. Try again.',
  RewardBelowMinimum:
    'The reward you were shown is no longer available. Nothing was charged. Refresh for a new quote.',
  InsufficientBudget: 'The store’s reward budget is used up.',
  STALE_PRICE: 'Settlement is paused until the stock price refreshes. Your reward stays reserved.',
  SLIPPAGE: 'Price moved. Refresh and try again.',
  FAUCET_LIMIT: 'Faucet limit is 10,000 test USDC per request.',
};
