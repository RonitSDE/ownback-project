import type { Metadata, Viewport } from 'next';
import { MiniAppReady } from '@/components/MiniAppReady';
import { Providers } from '@/components/Providers';
import { RealityStrip } from '@/components/RealityStrip';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SideNav } from '@/components/site/SideNav';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--ob-font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--ob-font-mono', display: 'swap' });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ownback-project.onrender.com';

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
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: `${APP_URL}/miniapp/embed.png`,
      button: {
        title: 'Open OWNBACK',
        action: {
          type: 'launch_miniapp',
          name: 'OWNBACK',
          url: APP_URL,
          splashImageUrl: `${APP_URL}/miniapp/icon.png`,
          splashBackgroundColor: '#fbfaf8',
        },
      },
    }),
  },
};

export const viewport: Viewport = { themeColor: '#fbfaf8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <MiniAppReady />
        <Providers>
          <SiteHeader badge={<RealityStrip />} />
          <div className="ob-layout">
            <SideNav />
            <div className="ob-content">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
