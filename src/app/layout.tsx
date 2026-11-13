import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import { RealityStrip } from '@/components/RealityStrip';
import './globals.css';

export const metadata: Metadata = {
  title: 'OWNBACK · Merchant-Funded Stock-Linked Rewards on Base',
  description:
    'OWNBACK v3.10 is a Base Sepolia mock-stock pilot candidate. A bounded agent refuses unsupported stock preferences; observed merchant rewards do not establish causal lift. Mainnet not deployed.',
  openGraph: {
    title: 'OWNBACK · Agentic Stock Finance Demo Candidate',
    description: 'Merchant-funded stock-linked rewards with explicit agent refusals and observed returners. Base Sepolia mock pilot, not deployed to mainnet.',
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
        <Providers><RealityStrip />{children}</Providers>
      </body>
    </html>
  );
}
