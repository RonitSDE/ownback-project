import test from 'node:test';
import assert from 'node:assert/strict';
import { BankrClient, BankrError } from '../src/lib/bankr/client.ts';
import { borrowPrompt, positionQuestionPrompt } from '../src/lib/bankr/prompts.ts';
import { bankrJobToOutcome } from '../src/lib/bankr/agent-actions.ts';

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const { status = 200, body = {} } = handler({ url: String(url), init }) ?? {};
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

test('prompt + poll resolves a completed job', async () => {
  let polls = 0;
  mockFetch(({ url }) => {
    if (url.endsWith('/agent/prompt')) return { body: { jobId: 'job_1', status: 'pending' } };
    if (url.includes('/agent/job/')) {
      polls += 1;
      return {
        body:
          polls < 2
            ? { jobId: 'job_1', status: 'processing' }
            : { jobId: 'job_1', status: 'completed', transactionHash: '0xabc' },
      };
    }
    return { status: 404, body: { error: 'nope' } };
  });
  const client = new BankrClient({ apiKey: 'bk_test' });
  const job = await client.waitForJob((await client.prompt('hi')).jobId, 1, 5);
  assert.equal(job.status, 'completed');
  assert.equal(job.transactionHash, '0xabc');
});

test('normalises snake_case job_id', async () => {
  mockFetch(() => ({ body: { job_id: 'job_snake', status: 'completed' } }));
  const client = new BankrClient({ apiKey: 'bk_test' });
  assert.equal((await client.job('ignored')).jobId, 'job_snake');
});

test('failed job raises BankrError with the reason', async () => {
  mockFetch(({ url }) =>
    url.endsWith('/agent/prompt')
      ? { body: { jobId: 'job_x' } }
      : { body: { jobId: 'job_x', status: 'failed', error: 'insufficient collateral' } },
  );
  const client = new BankrClient({ apiKey: 'bk_test' });
  await assert.rejects(
    client.run('borrow'),
    (e) => e instanceof BankrError && /insufficient collateral/.test(e.message),
  );
});

test('401 is flagged as a key problem', async () => {
  mockFetch(() => ({ status: 401, body: { error: 'Authentication required' } }));
  const client = new BankrClient({ apiKey: 'bk_bad' });
  await assert.rejects(
    client.me(),
    (e) => e instanceof BankrError && e.status === 401 && e.needsKey === true,
  );
});

test('missing key throws before any request', () => {
  assert.throws(
    () => new BankrClient({ apiKey: '' }),
    (e) => e instanceof BankrError && e.needsKey,
  );
});

test('submit posts a Base transaction with confirmation', async () => {
  const calls = mockFetch(() => ({ body: { success: true, transactionHash: '0xdef', status: 'success' } }));
  const client = new BankrClient({ apiKey: 'bk_test' });
  const res = await client.submit(
    { to: '0x0000000000000000000000000000000000000001', chainId: 8453, value: '0' },
    'test',
  );
  assert.equal(res.transactionHash, '0xdef');
  const submitCall = calls.find((c) => c.url.endsWith('/wallet/submit'));
  assert.equal(JSON.parse(submitCall.init.body).waitForConfirmation, true);
  assert.equal(submitCall.init.headers['X-API-Key'], 'bk_test');
});

test('borrow prompt is explicit about collateral, amount and LTV cap', () => {
  const p = borrowPrompt({ stockSymbol: 'AAPLc', collateralUnits: '0.0048', borrowUsdc: 2 });
  assert.match(p, /0\.0048 AAPLc/);
  assert.match(p, /borrow 2 USDC/);
  assert.match(p, /40% loan-to-value/);
  assert.match(positionQuestionPrompt('AAPLc'), /AAPLc/);
});

test('bankrJobToOutcome maps completion', () => {
  const out = bankrJobToOutcome({ jobId: 'j', status: 'completed', transactionHash: '0x1' });
  assert.equal(out.ok, false);
  assert.equal(out.provider, 'bankr');
  assert.equal(out.transactionHash, '0x1');
});
