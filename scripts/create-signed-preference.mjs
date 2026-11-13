/** Creates a fresh personal_sign-compatible preference payload with a locally held *dev* wallet.
 * Never sends a blockchain transaction. Raw signature is written only outside this repository.
 * RUN ONLY AGAINST YOUR CONTROLLED LOCAL/STAGING APP. Do not use a funded production key.
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { privateKeyToAccount } from 'viem/accounts';
import { buildAllocationProposal, allocationApprovalMessage } from '../src/lib/allocation/policy.ts';
import { allocationCapabilities } from '../src/lib/allocation/capabilities.ts';
const key = process.env.OWNBACK_DEMO_SIGNER_KEY;
const origin = process.env.APP_ORIGIN;
const output = process.env.OWNBACK_SIGNED_BODY_FILE || '/tmp/ownback-signed-preference.json';
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key))
  throw Error('Set OWNBACK_DEMO_SIGNER_KEY to a throwaway test wallet; NEVER a funded real wallet');
if (!origin || (!/^http:\/\/localhost(?::\d+)?$/.test(origin) && !/^https:\/\//.test(origin)))
  throw Error('Set APP_ORIGIN to localhost or controlled HTTPS server');
if (!output.startsWith('/tmp/') && !output.startsWith('/private/tmp/'))
  throw Error('Signed body must be written to a temporary location outside the repository');
const account = privateKeyToAccount(key);
const input = {
  rewardUsd: 2,
  theme: 'technology',
  preferredStock: 'AUTO',
  excludedSymbols: [],
  maxSingleWeightPercent: 100,
  cashReservePercent: 0,
};
const capabilities = allocationCapabilities();
const proposal = buildAllocationProposal(input, capabilities);
if (proposal.status !== 'proposed' || !proposal.stock)
  throw Error(
    `Policy refused: ${proposal.reasons.join('; ')}. Configure the correct single-stock pilot lane.`,
  );
const nonce = randomUUID(),
  expiresAt = Date.now() + 5 * 60_000;
const message = allocationApprovalMessage({
  origin,
  wallet: account.address,
  nonce,
  expiresAt,
  proposal,
  input,
});
const signature = await account.signMessage({ message });
writeFileSync(
  output,
  JSON.stringify({ input, wallet: account.address, signature, nonce, expiresAt }) + '\n',
  { mode: 0o600, flag: 'w' },
);
console.log(
  `Preference signed with throwaway wallet ${account.address}; request written to ${output}. NOT_EXECUTED. Expires in five minutes.`,
);
