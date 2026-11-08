import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'OWNBACK · Pay in USDC, get paid back in stock',
  description:
    'A checkout on Base that pays customers back in tokenized stock: more for the first order, more again when they come back.',
  openGraph: {
    title: 'OWNBACK · Spend. Earn stock. Borrow on it.',
    description: 'A stock-back checkout on Base. Testnet build.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#f5f7fa', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
