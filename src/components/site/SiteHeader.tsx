'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { WalletButton } from '@/components/wallet/WalletButton';
import { AREAS, ROLES, roleForPath, type Role } from './roles';

/** A role is selected only on pages that belong to it; neutral pages (home) select none. */
export function useRole(): Role | undefined {
  return roleForPath(usePathname() || '/');
}

export function SiteHeader({ badge }: { badge?: React.ReactNode }) {
  const role = useRole();
  const router = useRouter();
  return (
    <header className="ob-header">
      <Link href="/" className="ob-header-logo" aria-label="OWNBACK home">
        <span aria-hidden>↗</span> OWNBACK<b>.</b>
      </Link>
      <div className="ob-role" role="tablist" aria-label="I am a">
        <span className="ob-role-label">I am a</span>
        {ROLES.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={role === r}
            className={role === r ? 'on' : ''}
            onClick={() => router.push(AREAS[r].home)}
          >
            {AREAS[r].label}
          </button>
        ))}
      </div>
      <div className="ob-header-wallet">
        {badge}
        <WalletButton />
      </div>
    </header>
  );
}
