# OWNBACK Commerce v4 — deployment and verification

## Scope

This adds an **actual single-merchant catalog, inventory reservations, cart, USDC onchain payment reconciliation, customer receipts, fulfillment operations and merchant-initiated onchain refunds** to OWNBACK v3.1.2. It is **not Shopify**. It runs on Base Sepolia with the existing stock mock and onchain loyalty vault. Product payments are USDC; stock rewards remain **mock tokenized equities** until a regulated execution partner is onboarded.

First release allows merchant pickup or digital fulfillment only. No shipping, tax computation, VAT collection, fiat payment processing, automatic digital-entitlement delivery, or real-security settlement. Do not accept taxable real-money merchant sales without suitable tax and consumer-law handling.

## Requirements

- Node.js 22, PostgreSQL 15+, merchant wallet on Base Sepolia, a working RPC, deployed OWNBACK v3.1.2 contracts with the correct merchant campaign and funded stock-reward budget.
- A persistent Node.js hosting service for Next.js (not static export). Set `APP_ORIGIN` to the exact public HTTPS origin; secure cookies will be enabled in production.
- A scheduled call every minute to `POST /api/commerce/admin/reconcile` with `Authorization: Bearer $COMMERCE_CRON_SECRET`. This first indexes confirmed `Purchased` logs, then checks **onchain orderRefUsed** before releasing expired inventory. Do not use a blind database-only expiry job.
- Rate limiting at the reverse proxy/WAF in addition to database-based endpoint limits. For serious volume, use Redis-backed shared limits and queues.

## Start locally

```bash
cp .env.example .env.local
# Set UNIQUE secrets, real deployed contract addresses, and RPC values.
# Store DATABASE_URL also in .env for the standalone migration script.
docker compose -f docker-compose.commerce.yml up -d
npm install
npm run commerce:migrate
psql "$DATABASE_URL" -f commerce/seed-demo.sql   # optional
npm run dev
```

- Customer store: `http://localhost:3000/commerce`
- Merchant admin: `http://localhost:3000/commerce/admin`
- Existing OWNBACK campaign controls: `/merchant`
- Existing onchain demo: `/shop`

*Important*: `npm ci` needs a freshly generated and committed lockfile after adding `pg` and `@types/pg`: `npm install --package-lock-only && npm ci`. This package retains the previous lockfile as a baseline, but the **new dependencies have not been resolved here**, due to unavailable npm registry DNS. Use `npm install` first; commit its generated lockfile for reproducible deployments.

## Customer purchase workflow

1. Merchant publishes products and sets inventory, prices, and fulfillment type.
2. Customer selects products of the same fulfillment type and connects an injected Base Sepolia wallet.
3. Backend checks stock in a PostgreSQL transaction, locks product rows, reserves units, issues a unique order reference and a 15-minute quote deadline. The customer gets a secret receipt token held in local storage.
4. The wallet approves the **exact cart USDC amount** if needed and calls the existing `Ownback.pay(campaignId, amount, orderRef, minReward, quoteDeadline)`.
5. Contract reverts if reward cannot be reserved. Otherwise payment goes directly to the merchant; onchain `Purchased` is the payment proof.
6. Browser sends its transaction hash. Backend verifies a successful receipt **from the expected vault**, matching campaign ID, order reference, customer wallet and USDC amount; then it atomically deducts stock and marks order paid.
7. Merchant fulfills the order manually, or invokes a real onchain refund from the merchant wallet, verified before the DB status changes.
8. Keeper delivers mock-stock reward after configured hold. The commerce payment proof and stock reward settlement are separate processes.

## Critical acceptance tests before launch

1. One available item: reserve → wallet approve → USDC pay → receipt → merchant fulfillment. Match order value to onchain event and merchant USDC balance change.
2. Two customers race for the final item: at most one reservation succeeds.
3. Duplicate order confirm: the second call returns the same payment; another transaction hash cannot replace it.
4. Wrong wallet, wrong campaign, wrong amount, incorrect orderRef, reverted transaction: reject verification and do not decrement stock.
5. Interrupted payment: recover from saved hash; if no hash, only expire after deadline and onchain `orderRefUsed` is false.
6. Onchain payment mined but HTTP confirmation lost: `orderRefUsed` remains true, so the reconciler **must not release inventory**. Merchant must reconcile using the chain transaction before canceling.
7. Expired unpaid reservation: release stock, never count as sale.
8. Fulfillment cannot occur on an unpaid order.
9. Refund must originate from the merchant vault transaction and match purchase ID and amount.
10. Confirm twice concurrently; stock quantity is deducted exactly once. Production additionally needs RPC finality monitoring and reorg detection.
11. Test admin auth, invalid origin, rate limiting, stock underflow, out-of-stock cart, digital/pickup separation and data retention/backup.
12. Run `npm test`, `npm run test:commerce`, `npm run check`, `npm run build`, `npm run test:contracts`, `npm run verify:local` on a network-enabled machine.

## Operational caveats

- **This release has not passed a live chain checkout in this environment.** The source was authored and its syntax inspected; npm, Foundry, PostgreSQL, and Base RPC are needed for the full suite. Do not label it production certified.
- Use a dedicated restricted single-store merchant credential, never reuse the executor or owner private key in the website.
- Server-side stock reservations may be abused by wallet rotation; deploy anti-bot/WAF controls and monitor reservation rates.
- Use a single canonical, trustworthy RPC provider for payment receipt confirmation and inventory expiry; validate confirmations before physical fulfillment.
- A built-in payment indexer replays `Purchased` logs and reconciles paid orders even if the buyer closed the browser. Configure `COMMERCE_DEPLOY_BLOCK` correctly, run the reconciler every minute, monitor cursor lag and errors, and use a reliable archive-capable RPC. The cron indexes a bounded number of blocks per invocation; initial catch-up may require repeated invocations. Payment logging failures halt cursor advancement.
- Add independent order email notifications, digital file delivery, refund policy and any local VAT rules before real commercial operation.
- The refunds flow changes ownership reward state onchain; it does not automatically restock physical goods. Merchant must inspect returned goods and restock intentionally.
- `COMMERCE_ADMIN_PASSWORD` is a single-merchant pilot login. Multi-merchant roles, passkeys and third-party merchant authorization are later milestones.

## Release classification

**Engineering candidate only.** The project is packaged with the previous v3.1.2 app, and the commerce code has passed TypeScript syntax parsing and dependency-free core tests; it has **not** passed the complete `npm run build`, live PostgreSQL/HTTP test, Foundry, or actual Base Sepolia transaction flow in this environment. These must pass on a network-enabled machine before serving real users. Never advertise test USDC or mock stock as redeemable money or a regulated security.

## Required runtime variables

`COMMERCE_VAULT_ADDRESS`, `COMMERCE_CAMPAIGN_ID` and `COMMERCE_CHAIN_ID` must exactly match `NEXT_PUBLIC_OWNBACK_ADDRESS`, `NEXT_PUBLIC_CAMPAIGN_ID` and `NEXT_PUBLIC_CHAIN_ID`. Set `COMMERCE_DEPLOY_BLOCK` to the first contract deployment block. Cron should run `POST /api/commerce/admin/reconcile` at least once per minute with the bearer secret, reprocessing until `more` is false. Newly paid orders require at least three chain confirmations before the backend marks them paid.
