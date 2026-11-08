import type { ReactNode } from 'react';

type Tone = 'green' | 'blue' | 'orange' | 'grey' | 'red';

export function Tag({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function KV({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="panel">
      <div className="metric-label">{label}</div>
      <div className="metric">{value}</div>
      {note && <div className="fine">{note}</div>}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16 }: { width?: number | string; height?: number }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden />;
}

export function ExternalLink({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="ext-link">
      {children}
    </a>
  );
}
