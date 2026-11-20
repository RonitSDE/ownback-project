'use client';
import { useState } from 'react';
import { Bot, ArrowUpRight, Loader2, ShieldCheck } from 'lucide-react';
import { LENDING_LINKS } from '@/lib/lending';
type Props = { stockSymbol: string; collateralUnits: string; borrowUsdc: number; disabled?: boolean };
export function BorrowAction({ stockSymbol, collateralUnits, disabled }: Props) {
  const [busy, setBusy] = useState(false),
    [job, setJob] = useState(''),
    [token, setToken] = useState(''),
    [analysis, setAnalysis] = useState(''),
    [error, setError] = useState('');
  async function research() {
    setBusy(true);
    setError('');
    setAnalysis('');
    try {
      const r = await fetch('/api/agent/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockSymbol }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Research unavailable');
      setJob(d.jobId);
      setToken(d.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    try {
      const r = await fetch(
        '/api/agent/research?jobId=' + encodeURIComponent(job) + '&token=' + encodeURIComponent(token),
        { cache: 'no-store' },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Unable to get result');
      if (d.status === 'completed') {
        setAnalysis(d.analysis || 'Bankr completed without explanatory data.');
        setJob('');
      } else if (d.status === 'failed' || d.status === 'cancelled') {
        setError(d.message || 'Research failed');
        setJob('');
      } else {
        setError('Bankr is still researching. Check again shortly.');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="borrow-action">
      <div className="fine" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <ShieldCheck size={15} /> Bankr research is read-only. It cannot borrow from your wallet or use the
        operator wallet on your behalf.
      </div>
      <div className="btn-row">
        <button className="btn agent" onClick={research} disabled={busy || disabled}>
          {busy ? <Loader2 size={14} className="spin" /> : <Bot size={14} />}{' '}
          {busy ? 'Asking Bankr…' : 'Analyze stock collateral with Bankr'}
        </button>
        <a className="btn lime" href={LENDING_LINKS.morpho} target="_blank" rel="noopener noreferrer">
          Explore lending in your own wallet <ArrowUpRight size={14} />
        </a>
      </div>
      {job && (
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={refresh}>
          Check Bankr research result
        </button>
      )}
      {analysis && (
        <div role="status" className="fine" style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
          {analysis}
        </div>
      )}
      {error && (
        <p role="status" className="fine" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      <p className="fine" style={{ marginTop: 8 }}>
        This {stockSymbol} reward is testnet stock, not eligible collateral. Real lending requires an approved
        token, market, and your own authorization. Balance shown: {collateralUnits} mock units.
      </p>
    </div>
  );
}
