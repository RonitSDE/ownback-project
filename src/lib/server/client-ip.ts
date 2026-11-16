/**
 * Security boundary for client IP rate-limit keys.
 *
 * HTTP clients control arbitrary request headers unless a trusted ingress *overwrites*
 * them. Never treat the first X-Forwarded-For entry as authenticated.
 *
 * At an ingress that strips spoofed incoming headers:
 *   OWNBACK_TRUSTED_PROXY_IP_HEADER=x-real-ip
 * or with a proxy that appends the observed peer to X-Forwarded-For:
 *   OWNBACK_TRUSTED_PROXY_IP_HEADER=x-forwarded-for-last
 *
 * Without explicit ingress configuration all callers share the conservative
 * `untrusted` bucket; this prevents forged headers bypassing application limits,
 * but needs edge/WAF per-client rate limiting for production availability.
 */
import { isIP } from 'node:net';

export function clientIp(req: Pick<Request, 'headers'>): string {
  const source = process.env.OWNBACK_TRUSTED_PROXY_IP_HEADER;
  let value: string | null = null;
  if (source === 'x-real-ip') {
    value = req.headers.get('x-real-ip');
    if (value?.includes(',')) return 'untrusted';
  } else if (source === 'x-forwarded-for-last') {
    const header = req.headers.get('x-forwarded-for');
    // The nearest peer *appended by the trusted ingress* is the last entry.
    value = header?.split(',').at(-1)?.trim() ?? null;
  } else {
    return 'untrusted';
  }
  if (!value) return 'untrusted';
  const ip = value.trim().toLowerCase();
  if (ip.length > 45 || !isIP(ip)) return 'untrusted';
  return ip;
}
