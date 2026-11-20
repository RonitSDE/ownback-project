'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Check, Coffee, Footprints, Headphones, Loader2 } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { useCheckout, type CheckoutStep } from '@/hooks/useCheckout';
import type { Balances } from '@/hooks/useShopData';
import { parseUsdcInput, sanitizeUsdcTyping } from '@/lib/amount';
import { duration, KIND, usd } from '@/lib/format';
import { previewReward, type Campaign, type PurchaseRow } from '@/lib/reads';
import { explain } from '@/lib/wallet';

// The demo store's own catalog. These are shop prices, not market data.
const PRODUCTS = [
  { name: 'Cold brew', price: '6', icon: Coffee },
  { name: 'Running shoes', price: '48', icon: Footprints },
  { name: 'Headphones', price: '120', icon: Headphones },
];

type Props = {
  campaign: Campaign;
  balances?: Balances;
  purchases: PurchaseRow[];
  stockSymbol?: string;
  now: number;
  onPaid: () => Promise<void>;
};

export function CheckoutPanel({ campaign, balances, purchases, stockSymbol, now, onPaid }: Props) {
  const { account, provider, wrongNetwork } = useWallet();
  const { notify } = useToast();
  const { step, pay, reset } = useCheckout();
  const inputId = useId();

  const [amountInput, setAmountInput] = useState('48');
  const [preview, setPreview] = useState<{ kind: number; reward: bigint }>();
  const [acceptNoReward, setAcceptNoReward] = useState(false);

  const parsed = useMemo(() => parseUsdcInput(amountInput), [amountInput]);
  const amount = parsed.ok ? parsed.units : 0n;

  // Live on-chain quote; re-run when the amount or the customer's history changes.
  useEffect(() => {
    setAcceptNoReward(false);
    if (!account || amount === 0n) {
      setPreview(undefined);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      previewReward(account, amount)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(undefined));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [account, amount, purchases]);

  const first = purchases.find((p) => p.kind === 1);
  const hasComeback = purchases.some((p) => p.kind === 2);
  const windowEnds = first ? first.paidAt + campaign.returnWindow : 0;
  const comebackOpen = Boolean(first && !hasComeback && now > 0 && now < windowEnds);

  const rewarded = preview !== undefined && preview.reward > 0n;
  const insufficient = balances !== undefined && balances.usdcBalance < amount;
  const busy = step !== 'idle' && step !== 'done';

  function noRewardReason(): string {
    if (campaign.paused) return 'The store has paused rewards.';
    if (amount < campaign.minOrder) return `Orders under ${usd(campaign.minOrder)} don’t earn a reward.`;
    if (hasComeback) return 'You’ve earned both rewards from this store.';
    if (first && now >= windowEnds) return 'Your comeback window has closed.';
    if (first && now <= first.paidAt + 2) return 'A comeback order has to land in a later block.';
    return 'The store’s reward budget is used up.';
  }

  async function onPay() {
    if (!account || !provider || !preview) return;
    try {
      const { hash, alreadyPaid } = await pay({
        provider,
        account,
        amount,
        minReward: rewarded ? preview.reward : 0n,
      });
      notify({
        kind: 'ok',
        tx: hash,
        message: alreadyPaid
          ? 'That order was already paid. Nothing was charged twice.'
          : rewarded
            ? `Paid. ${usd(preview.reward)} in ${stockSymbol ?? 'stock'} is reserved for you.`
            : 'Paid. This order has no reward.',
      });
      await onPaid();
    } catch (err) {
      notify({ kind: 'err', message: explain(err) });
    } finally {
      setTimeout(reset, 2500);
    }
  }

  const canPay =
    Boolean(account) &&
    !wrongNetwork &&
    parsed.ok &&
    preview !== undefined &&
    !insufficient &&
    !busy &&
    (rewarded || acceptNoReward);

  return (
    <section className="panel" aria-labelledby="checkout-title">
      <h2 id="checkout-title">Checkout</h2>
      <p className="sub">Pick an item or enter any amount. The store is paid in full the moment you pay.</p>

      {comebackOpen && (
        <div className="banner-note ok" role="status" style={{ marginBottom: 14 }}>
          <strong>Comeback bonus is live.</strong> Order again within {duration(windowEnds - now)} to earn{' '}
          {campaign.comebackBps / 100}% back.
        </div>
      )}

      <div className="products" role="group" aria-label="Products">
        {PRODUCTS.map(({ name, price, icon: Icon }) => (
          <button
            key={name}
            type="button"
            className={`product ${amountInput === price ? 'selected' : ''}`}
            aria-pressed={amountInput === price}
            onClick={() => setAmountInput(price)}
          >
            <Icon size={18} color="var(--blue)" aria-hidden />
            <strong>{name}</strong>
            <span>${price}.00</span>
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor={inputId}>
        Amount (test USDC)
      </label>
      <input
        id={inputId}
        className={`input ${!parsed.ok && amountInput !== '' ? 'invalid' : ''}`}
        inputMode="decimal"
        autoComplete="off"
        value={amountInput}
        aria-invalid={!parsed.ok}
        aria-describedby={`${inputId}-hint`}
        onChange={(e) => setAmountInput(sanitizeUsdcTyping(e.target.value))}
      />
      <p id={`${inputId}-hint`} className={`field-hint ${parsed.ok ? '' : 'error'}`}>
        {parsed.ok
          ? `Wallet balance: ${balances ? usd(balances.usdcBalance) : '—'} test USDC`
          : parsed.reason}
      </p>

      {parsed.ok && account && preview && (
        <div className={`reward-preview ${rewarded ? 'on' : 'off'}`} aria-live="polite">
          {rewarded ? (
            <>
              Earns <strong>{usd(preview.reward)}</strong> in {stockSymbol ?? 'stock'} · {KIND[preview.kind]}{' '}
              ({(preview.kind === 2 ? campaign.comebackBps : campaign.firstBps) / 100}%
              {preview.reward === campaign.maxReward ? ', capped' : ''}). It&apos;s reserved the moment you
              pay, and the payment only goes through if this exact reward is still available.
            </>
          ) : (
            <>
              <strong>No stock reward on this order.</strong> {noRewardReason()}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={acceptNoReward}
                  onChange={(e) => setAcceptNoReward(e.target.checked)}
                />
                Pay anyway, without a reward
              </label>
            </>
          )}
        </div>
      )}

      <button className="btn primary block lg" onClick={onPay} disabled={!canPay} aria-busy={busy}>
        {busy ? (
          <>
            <Loader2 size={16} className="spin" aria-hidden /> {STEP_LABEL[step]}
          </>
        ) : insufficient ? (
          'Not enough test USDC'
        ) : (
          `Pay ${parsed.ok ? usd(amount) : ''}`
        )}
      </button>

      {busy && <PayProgress step={step} />}

      <p className="fine" style={{ marginTop: 10 }}>
        Rewards settle after a {duration(campaign.holdSeconds)} refund hold. You approve only the exact
        amount, never an unlimited allowance.
      </p>
    </section>
  );
}

const STEP_LABEL: Record<CheckoutStep, string> = {
  idle: '',
  approve: 'Approve USDC in your wallet…',
  sign: 'Confirm payment in your wallet…',
  confirming: 'Confirming on Base…',
  done: 'Done',
};

function PayProgress({ step }: { step: CheckoutStep }) {
  const order: CheckoutStep[] = ['approve', 'sign', 'confirming'];
  const at = order.indexOf(step);
  return (
    <ol className="pay-progress" aria-label="Payment progress">
      {['Approve amount', 'Sign payment', 'Confirm on Base'].map((label, i) => (
        <li key={label} className={i < at ? 'done' : i === at ? 'active' : ''}>
          <span className="dot" aria-hidden>
            {i < at ? <Check size={11} /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
