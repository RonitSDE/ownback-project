# OWNBACK v3.6.2 — Simulation-driven recovery hardening

## What changed

**Claim email outbox** (`commerce/shopify.sql`, `src/lib/shopify/claim-outbox.ts`, `scripts/shopify-claims.ts`, admin claim route):
- The reward order's redeemable token digest and an encrypted, durable email intent commit in **one PostgreSQL transaction**, before Resend is contacted. The outbox stores encrypted email and token and reuses a fixed provider idempotency key across retries.
- Dispatcher uses an atomic lease (2 minutes), rechecks the Shopify paid state/refunds, and sends only afterward. Worker retries use the original token, not a new link.
- Merchant-triggered claims queue emails; they no longer make external HTTP requests inside the request handler.
- Refund webhooks cancel unsent intents and invalidate existing claim links. No live securities are delivered.

**Settlement reconciliation** (`scripts/shopify-settle.ts`):
- On restart, reads the vault's `paidOrder` flag and validates `RewardDelivered` receipt/event for **SETTLING**, a refunded in-flight order, and even a previously CLAIMED order before an attempt.
- An ambiguous submission no longer resets SETTLING to CLAIMED, even when the database lost the transaction hash. A reverted receipt requires manual operator review.
- Validates the emitted customer hash, recipient wallet, positive amounts, vault address, success receipt and exact order hash before declaring delivery.

## Reproduction

After installing dependencies on a network-connected machine:

```bash
npm ci
npm run shopify:migrate
npm run test:recovery
npm run simulate:recovery
npm test
npm run check
npm run build
npm run test:contracts
```

On this offline review machine, the actual worker functions were transpiled using an available TypeScript installation and executed against in-memory substitutes:

```bash
TS_COMPILER_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript npm run simulate:recovery
```

**The fault-injection test is not a live checkout or chain transaction.** The mock email service accepted an email then its DB status update failed; the claim had already been stored and the retried email reused the same link/idempotency key. A simulated chain accepted a delivery then storing the tx hash failed; the next worker run recovered by verified chain event without a second write.

## Known limits / pilot blockers

1. `package-lock.json` inherited from v3.6.1 still lacks `pg` and `@types/pg`, and a clean npm install requires regenerating the lockfile on a network-enabled machine. Run `npm install --package-lock-only --no-audit --no-fund`, commit it, and verify with `npm ci` on a clean machine. The source manifest must then be regenerated.
2. The test environment has **no live Shopify store, PostgreSQL, Resend, Base Sepolia RPC/contract or Bankr credentials**, so no externally verified end-to-end transaction is claimed. Foundry and Next production build are unverified here.
3. Resend's documented idempotency window is 24 hours. The dispatcher halts automatic retries for previously attempted emails after 20 hours and requests manual review. The outbox prevents unusable links after a post-send DB crash, but **cannot guarantee exactly-once email delivery indefinitely**. Any provider retry must reuse an identical payload, so keep `APP_ORIGIN`, sender, and email template stable during that window.
4. Refund between final Shopify verification and broadcast is possible without an onchain refund oracle; the current contract is testnet-only and the hold/reverification controls reduce but do not eliminate the race. For real funds, define a settlement finality and refund liability policy.
5. A submitted tx with missing hash and no delivery receipt stays SETTLING for **manual recovery**, rather than risking a duplicate. This is deliberately conservative and may leave an order pending if the worker crashes before broadcasting. Operator tooling/nonce tracking is the next reliability enhancement.
6. Stock assets remain synthetic Sepolia tokens, not actual equity. Bankr supports read-only analysis, not customer borrowing.

## Deployment order

1. Run database migration before enabling claim workers or Shopify webhooks.
2. Configure required env vars (`DATABASE_URL`, `SHOPIFY_TOKEN_ENCRYPTION_KEY`, Shopify OAuth/admin/HMAC secrets, Resend keys, `APP_ORIGIN`, Base Sepolia executor and vault address). Never expose these to frontend.
3. Enable `SHOPIFY_AUTO_EMAIL_CLAIMS=true` on the **private** claim worker; start exactly one settlement worker for the testnet vault.
4. Validate first and comeback orders, expired claim, refund-before-email, crashed email worker, refund-mid-flight, underfunded vault, pending/reverted tx, and successful event-backed settlement against actual staging systems.
5. Produce authenticated Base Sepolia explorer receipts before any public claims of onchain payout or full production-readiness.
