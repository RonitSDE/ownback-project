import {
  ChartNoAxesCombined,
 
  Gift,
  ListChecks,
  Megaphone,
  Network,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type Role = 'customer' | 'merchant' | 'proof';

export type NavLink = { href: string; icon: LucideIcon; label: string; hint: string };

/** Every page belongs to exactly one area, so the header always shows who the page is for. */
export const AREAS: Record<Role, { label: string; home: string; blurb: string; links: NavLink[] }> = {
  customer: {
    label: 'Customer',
    home: '/shop',
    blurb: 'Buy, earn a stock reward, settle it to your wallet.',
    links: [
      { href: '/shop', icon: ShoppingBag, label: 'Shop', hint: 'Pay in USDC, then settle your reward' },
      { href: '/commerce', icon: Store, label: 'Store', hint: 'Merchant catalog checkout' },
      { href: '/agentic', icon: Sparkles, label: 'Concierge', hint: 'Shopify stores with rewards' },
      { href: '/ownership', icon: Wallet, label: 'My rewards', hint: 'Rewards you have earned' },
      {
        href: '/allocation',
        icon: SlidersHorizontal,
        label: 'Preferences',
        hint: 'Ask the agent which stock',
      },
      { href: '/claim', icon: Gift, label: 'Claim', hint: 'From a merchant email link' },
    ],
  },
  merchant: {
    label: 'Merchant',
    home: '/growth',
    blurb: 'Fund a campaign and see who came back.',
    links: [
      {
        href: '/growth',
        icon: ChartNoAxesCombined,
        label: 'Dashboard',
        hint: 'Returning customers and reward spend',
      },
      { href: '/merchant', icon: Megaphone, label: 'Campaign', hint: 'Budget, orders, pause' },
      {
        href: '/commerce/admin',
        icon: Settings,
        label: 'Store admin',
        hint: 'Products and orders (sign-in)',
      },
      { href: '/experience', icon: Network, label: 'Network', hint: 'How the network works' },
    ],
  },
  proof: {
    label: 'Proof',
    home: '/judge',
    blurb: 'Verify what happened on-chain.',
    links: [
      { href: '/judge', icon: ListChecks, label: 'Walkthrough', hint: 'The 90-second flow and proofs' },
      { href: '/verify', icon: ShieldCheck, label: 'Verify receipts', hint: 'Independent evidence and limits' },
      { href: '/protocol', icon: ShieldCheck, label: 'Protocol', hint: 'Contract rules and finality' },
    ],
  },
};

export const ROLES = Object.keys(AREAS) as Role[];

export function roleForPath(path: string): Role | undefined {
  let best: { role: Role; len: number } | undefined;
  for (const role of ROLES)
    for (const l of AREAS[role].links)
      if ((path === l.href || path.startsWith(l.href + '/')) && (!best || l.href.length > best.len))
        best = { role, len: l.href.length };
  return best?.role;
}
