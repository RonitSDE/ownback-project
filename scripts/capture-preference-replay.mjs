/** Run only against a controlled OWNBACK deployment. Sends the same wallet-signed preference twice. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((x) => x.startsWith('--') && x.includes('='))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(2, i), x.slice(i + 1)];
    }),
);
if (!args.url || !args.bodyFile || !['ANVIL', 'BASE_SEPOLIA', 'BASE_MAINNET'].includes(args.environment)) {
  console.error(
    'Usage: node scripts/capture-preference-replay.mjs --url=https://OWNBACK_HOST --bodyFile=/tmp/ownback-signed-preference.json --environment=BASE_SEPOLIA',
  );
  process.exit(1);
}
const server = new URL(args.url);
if (
  server.protocol !== 'https:' &&
  !(server.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(server.hostname))
)
  throw Error('Must use HTTPS or localhost');
const body = readFileSync(args.bodyFile, 'utf8');
const parsed = JSON.parse(body);
if (!parsed.wallet || !parsed.signature || !parsed.nonce || !parsed.input)
  throw Error('Input must be an actual wallet-signed approval request; no mock signature');
const endpoint = new URL('/api/allocation/approve', server);
const send = async () => {
  const ctrl = new AbortController(),
    t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.origin },
      body,
      signal: ctrl.signal,
    });
    const json = await res.json();
    return { requestId: randomUUID(), status: res.status, response: json };
  } finally {
    clearTimeout(t);
  }
};
const first = await send();
if (first.status !== 200)
  throw Error(
    `First request returned HTTP ${first.status} — ${first.response?.error || 'unknown error'}. No proof captured.`,
  );
const replay = await send();
if (replay.status !== 409)
  throw Error(`Replay returned HTTP ${replay.status}, expected 409. No proof captured.`);
if (!/^[a-f\d]{64}$/i.test(first.response?.digest || ''))
  throw Error('First approval response has no 64-character signed preference digest');
const file = 'evidence/logs/preference-replay.json';
mkdirSync('evidence/logs', { recursive: true });
const captured = {
  kind: 'preference_replay',
  environment: args.environment,
  capturedAt: new Date().toISOString(),
  url: endpoint.origin + endpoint.pathname,
  payloadDigest: '0x' + first.response.digest,
  requestBodyHash: '0x' + createHash('sha256').update(body).digest('hex'),
  sameSignedPayload: true,
  first: { requestId: first.requestId, status: first.status, responseStatus: first.response?.status },
  replay: { requestId: replay.requestId, status: replay.status, responseError: replay.response?.error },
  disclosure: 'API RESPONSE PROOF ONLY — preference cannot trade, claim, or authorize custody',
};
writeFileSync(file, JSON.stringify(captured, null, 2) + '\n');
const proofs = JSON.parse(readFileSync('evidence/proofs.json', 'utf8'));
const row = proofs.proofs.find((x) => x.id === 'preference_replay');
Object.assign(row, {
  environment: args.environment,
  evidenceFile: file,
  transactionHash: null,
  url: null,
  status: 'VERIFIED',
});
writeFileSync('evidence/proofs.json', JSON.stringify(proofs, null, 2) + '\n');
console.log(
  'Saved redacted HTTP 200 → 409 replay evidence. Raw wallet signature and request body were not saved. Re-run strict proof gate.',
);
