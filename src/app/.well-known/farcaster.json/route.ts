const URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ownback-project.onrender.com';

export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    // Paste the values from the Base Build / Farcaster account-association tool into these env vars.
    accountAssociation: {
      header: process.env.FARCASTER_HEADER ?? '',
      payload: process.env.FARCASTER_PAYLOAD ?? '',
      signature: process.env.FARCASTER_SIGNATURE ?? '',
    },
    miniapp: {
      version: '1',
      name: 'OWNBACK',
      subtitle: 'Stock-linked rewards on Base',
      description: 'Merchant-funded stock-linked rewards on Base. Base Sepolia mock pilot; not deployed to mainnet.',
      homeUrl: URL,
      iconUrl: `${URL}/miniapp/icon.png`,
      splashImageUrl: `${URL}/miniapp/icon.png`,
      splashBackgroundColor: '#fbfaf8',
      heroImageUrl: `${URL}/miniapp/hero.png`,
      ogTitle: 'OWNBACK',
      ogDescription: 'Merchant-funded stock-linked rewards on Base.',
      ogImageUrl: `${URL}/miniapp/embed.png`,
      primaryCategory: 'finance',
      tags: ['rewards', 'base', 'commerce', 'onchain'],
      requiredChains: ['eip155:84532'],
      noindex: true,
    },
  });
}
