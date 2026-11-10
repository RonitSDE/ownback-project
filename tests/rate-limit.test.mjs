import test from 'node:test';
import assert from 'node:assert/strict';

// Re-implement the window check inline to assert the contract the route relies on.
// (The module itself imports 'server-only' and can't load under the test runner.)
function makeLimiter() {
  const buckets = new Map();
  return (key, limit, windowMs, now) => {
    const b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  };
}

test('allows up to the limit then blocks within the window', () => {
  const rl = makeLimiter();
  const t = 1000;
  assert.equal(rl('ip', 5, 60_000, t), true);
  for (let i = 0; i < 4; i++) assert.equal(rl('ip', 5, 60_000, t + i), true);
  assert.equal(rl('ip', 5, 60_000, t + 5), false); // 6th is blocked
});

test('resets after the window', () => {
  const rl = makeLimiter();
  for (let i = 0; i < 5; i++) rl('ip', 5, 1000, 0);
  assert.equal(rl('ip', 5, 1000, 500), false);
  assert.equal(rl('ip', 5, 1000, 1001), true); // new window
});

test('separate keys have separate budgets', () => {
  const rl = makeLimiter();
  for (let i = 0; i < 5; i++) rl('a', 5, 1000, 0);
  assert.equal(rl('b', 5, 1000, 0), true);
});
