import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from '../src/lib/server/client-ip.ts';

const request = (headers) => ({ headers: new Headers(headers) });
const withMode = (mode, fn) => {
  const original = process.env.OWNBACK_TRUSTED_PROXY_IP_HEADER;
  if (mode === undefined) delete process.env.OWNBACK_TRUSTED_PROXY_IP_HEADER;
  else process.env.OWNBACK_TRUSTED_PROXY_IP_HEADER = mode;
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env.OWNBACK_TRUSTED_PROXY_IP_HEADER;
    else process.env.OWNBACK_TRUSTED_PROXY_IP_HEADER = original;
  }
};

test('adversarial: forged X-Forwarded-For rotation cannot bypass conservative default', () => {
  withMode(undefined, () => {
    for (let i = 0; i < 100; i++) {
      assert.equal(clientIp(request({ 'x-forwarded-for': `198.51.100.${i % 255}` })), 'untrusted');
    }
  });
});

test('adversarial: with append-only trusted ingress, attacker-controlled FIRST entry is ignored', () => {
  withMode('x-forwarded-for-last', () => {
    const source = '203.0.113.17';
    for (let i = 0; i < 100; i++) {
      assert.equal(clientIp(request({ 'x-forwarded-for': `198.51.100.${i % 255}, ${source}` })), source);
    }
  });
});

test('adversarial: invalid and injected IP strings do not create unique limit buckets', () => {
  for (const mode of ['x-real-ip', 'x-forwarded-for-last']) {
    withMode(mode, () => {
      const name = mode === 'x-real-ip' ? 'x-real-ip' : 'x-forwarded-for';
      for (const value of ['anything', '8.8.8.8:8080', 'evil.com', '1.2.3.4\\nother', '999.5.5.5', '']) {
        assert.equal(clientIp(request({ [name]: value })), 'untrusted', `should reject ${value}`);
      }
    });
  }
});

test('a trusted proxy may provide a validated IPv4 or IPv6 identity', () => {
  withMode('x-real-ip', () => {
    assert.equal(clientIp(request({ 'x-real-ip': '192.0.2.1' })), '192.0.2.1');
    assert.equal(clientIp(request({ 'x-real-ip': '2001:DB8::1' })), '2001:db8::1');
    assert.equal(clientIp(request({ 'x-real-ip': '192.0.2.1, 192.0.2.2' })), 'untrusted');
  });
});

test('sensitive commerce routes use the same vetted client identity helper', async () => {
  const { readFileSync } = await import('node:fs');
  const entries = [
    '../src/app/api/commerce/admin/login/route.ts',
    '../src/app/api/shopify/claim/redeem/route.ts',
    '../src/app/api/retention/portfolio/route.ts',
  ];
  for (const filename of entries) {
    const content = readFileSync(new URL(filename, import.meta.url), 'utf8');
    assert.match(content, /clientIp\(req\)/, filename);
    assert.doesNotMatch(content, /headers\.get\('x-forwarded-for'\)/, filename);
  }
});
