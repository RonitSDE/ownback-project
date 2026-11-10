import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// Origins the browser may call: our own API routes plus the configured chain RPC.
// The local anvil RPC is only allowed in development builds.
function connectSources(): string {
  const sources = new Set(["'self'"]);
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
  try {
    sources.add(new URL(rpc).origin);
  } catch {
    /* invalid URL: fall back to self only */
  }
  sources.add('https://sepolia.base.org');
  if (isDev) sources.add('http://127.0.0.1:8545').add('ws://localhost:*');
  return [...sources].join(' ');
}

const csp = [
  "default-src 'self'",
  // Next.js inlines hydration scripts; 'unsafe-eval' only for the dev overlay.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:", // Shopify catalog images are served from HTTPS merchant/CDN domains
  `connect-src ${connectSources()}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Only when the RPC is HTTPS: otherwise a production build pointed at a local chain would break.
  ...(!isDev && (process.env.NEXT_PUBLIC_RPC_URL ?? 'https://').startsWith('https://')
    ? ['upgrade-insecure-requests']
    : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' }, // clickjacking: never render inside another site
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }, // wallet popups still work
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
