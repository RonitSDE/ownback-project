import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'OWNBACK · Buy again. Build ownership.',
  description:
    'A merchant retention protocol on Base: programmable comeback rewards, merchant economics, and customer ownership. Mock equity rewards on Base Sepolia only.',
  openGraph: {
    title: 'OWNBACK · The Ownership Retention Protocol',
    description:
      'Make customer retention measurable and reward everyday purchases with stock-linked ownership. Base Sepolia testnet pilot.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#fbfaf8', width: 'device-width', initialScale: 1 };

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
