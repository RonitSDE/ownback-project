'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from './wallet/WalletButton';

const LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/merchant', label: 'Merchant' },
  { href: '/demo', label: 'Simulator' },
];

export function AppNav() {
  const path = usePathname();
  return (
    <header className="app-nav">
      <Link href="/" className="nav-logo" aria-label="OWNBACK home">
        <div className="logo-square" aria-hidden>
          ↗
        </div>
        OWNBACK<span style={{ color: '#9dacb9' }}>.</span>
      </Link>
      <nav className="links" aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <WalletButton />
    </header>
  );
}
