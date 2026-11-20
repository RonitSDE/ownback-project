'use client';

import { useId, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { parseUsdcInput, sanitizeUsdcTyping } from '@/lib/amount';
import { usd } from '@/lib/format';
import { fundCampaign, setRewardsPaused, withdrawAvailable } from '@/lib/merchant-actions';
import type { Campaign } from '@/lib/reads';
import { explain } from '@/lib/wallet';

export function BudgetControls({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange: () => Promise<void>;
}) {
  const { account, provider, wrongNetwork } = useWallet();
  const { notify } = useToast();
  const [input, setInput] = useState('500');
  const [busy, setBusy] = useState<string>();
  const id = useId();
  const parsed = useMemo(() => parseUsdcInput(input), [input]);

  async function run(label: string, fn: () => Promise<`0x${string}`>, success: string) {
    setBusy(label);
    try {
      const tx = await fn();
      notify({ kind: 'ok', message: success, tx });
      await onChange();
    } catch (err) {
      notify({ kind: 'err', message: explain(err) });
    } finally {
      setBusy(undefined);
    }
  }

  if (!account || !provider) return null;
  const ctx = { account, provider };
  const disabled = Boolean(busy) || wrongNetwork;

  return (
    <section className="panel" aria-labelledby="budget-title" style={{ marginBottom: 16 }}>
      <h2 id="budget-title">Budget controls</h2>
      <p className="sub">
        Withdraw unreserved budget at any time. Pausing stops new rewards; customers can still check out after
        explicitly accepting no reward, and rewards already promised stay payable.
      </p>
      <div className="btn-row">
        <label htmlFor={id} className="sr-only">
          Amount to fund
        </label>
        <input
          id={id}
          className={`input ${parsed.ok ? '' : 'invalid'}`}
          style={{ maxWidth: 160 }}
          inputMode="decimal"
          value={input}
          aria-invalid={!parsed.ok}
          onChange={(e) => setInput(sanitizeUsdcTyping(e.target.value))}
        />
        <button
          className="btn primary"
          disabled={disabled || !parsed.ok}
          onClick={() => parsed.ok && run('fund', () => fundCampaign(ctx, parsed.units), 'Campaign funded.')}
        >
          {busy === 'fund' ? 'Funding…' : 'Fund campaign'}
        </button>
        <button
          className="btn"
          disabled={disabled || campaign.available === 0n}
          onClick={() =>
            run('withdraw', () => withdrawAvailable(ctx, campaign.available), 'Unreserved budget withdrawn.')
          }
        >
          {busy === 'withdraw' ? 'Withdrawing…' : `Withdraw ${usd(campaign.available)}`}
        </button>
        <button
          className="btn"
          disabled={disabled}
          onClick={() =>
            run(
              'pause',
              () => setRewardsPaused(ctx, !campaign.paused),
              campaign.paused ? 'Rewards resumed.' : 'Rewards paused. Promised rewards stay payable.',
            )
          }
        >
          {campaign.paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
          {campaign.paused ? 'Resume rewards' : 'Pause rewards'}
        </button>
      </div>
      {!parsed.ok && <p className="field-hint error">{parsed.reason}</p>}
    </section>
  );
}
