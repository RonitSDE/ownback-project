/**
 * Verify OWNBACK's Bankr client against the live API before a demo.
 *   BANKR_API_KEY=bk_... npx tsx scripts/bankr-check.ts
 * Read-only: authenticates and (optionally) asks a position question. Never borrows.
 */
import { BankrClient } from '../src/lib/bankr/client';
import { positionQuestionPrompt } from '../src/lib/bankr/prompts';

const apiKey = process.env.BANKR_API_KEY;
if (!apiKey) {
  console.error('Set BANKR_API_KEY (bk_...) first.');
  process.exit(1);
}

const client = new BankrClient({ apiKey, baseUrl: process.env.BANKR_API_URL });

const me = await client.me();
console.log('Auth OK. Agent wallet:', me.address ?? '(address not returned)');

if (process.argv.includes('--ask')) {
  console.log('Asking a read-only position question (this uses agent credits)…');
  const job = await client.run(positionQuestionPrompt(process.env.STOCK_SYMBOL ?? 'AAPLc'));
  console.log('Job status:', job.status);
  console.log('Result:', JSON.stringify(job.result ?? job, null, 2).slice(0, 1200));
}
console.log('\nBankr client matches the live API.');
