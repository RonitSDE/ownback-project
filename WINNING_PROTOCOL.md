# OWNBACK 3.4 — Proof-of-Retention + Bankr Research

## Product story
Verified USDC purchase on Base → bounded merchant-funded comeback incentive → recorded mock stock delivery on Sepolia → opt-in read-only Bankr research about eligible collateral markets. **No real securities or customer loan execution** are claimed.

## What is actually integrated
- `/commerce` catalog/cart, server-side reserve, USDC payment against order-bound reference, receipt-based confirmation, merchant fulfillment and refunds. Source merged from commerce V4.
- `Ownback` Solidity checkout with minimum reward, expiry and unique orderRef, mock 8-decimal stock settlement and local-chain suite.
- `/api/agent/research` submits **read-only educational** Bankr prompt and returns a scoped expiring job receipt. Polling never confuses a completed model response with confirmed debt. API key is operator-scoped and must be **read-only**.
- `/api/agent/borrow` always returns 403; no public write access to operator Bankr wallet.

## Main competition proof
1. Merchant creates and funds a campaign (Base Sepolia).
2. Merchant configures a real product and inventory in `/commerce/admin`.
3. Customer signs wallet checkout, order reference and purchase tx.
4. Server confirms onchain amount, customer, campaign, vault and reference (3 confirmations), decrements inventory transactionally.
5. Customer returns in window, earns configured bonus; one orderRef cannot pay twice.
6. Keeper settles mock stock after hold; display contract/event proof.
7. Bankr analyzes market and risks, **but does not execute borrowing**.
8. Demonstrate intentional failures: duplicate order, insufficient budget, refund, paused campaign, stale quote, wrong receipt wallet.

## Bankr partnership next steps
For real user-authorized lending: Bankr partner provisioning with **customer-specific** accounts/keys or wallet-signed actions; clear jurisdiction eligibility; verified allowed token + lending market; enforce collateral market LTV directly and simulate health/liquidation; transaction receipt + debt-position confirmation; debt/interest UX. No borrowing through shared server API key.

## Readiness gates
1. `npm install --package-lock-only` to regenerate lockfile for added PostgreSQL dependency; then `npm ci`.
2. `docker compose -f docker-compose.commerce.yml up -d`, `npm run commerce:migrate`, configure single merchant.
3. `npm test`, `npm run check`, `npm run build`, `npm run test:contracts`, `npm run verify:local`, `npm run test:commerce`.
4. On Sepolia, verify real browser USDC test payment, customer reward reservation and keeper mock-token delivery with BaseScan receipts.
5. Real Bankr key: read-only scoped; run `npm run bankr:check -- --ask` and one analysis job; ensure no trade permission.
6. Sign off shipping/tax/compliance externally before selling physical goods or real securities.

## Constraints
This is a **testnet pilot**. Does not claim live tokenized equity, approved market collateral, a Bankr lending position, mainnet readiness or Shopify integration. The commerce pilot supports pickup/manual digital fulfillment, not complete taxation or shipping.

## Proof of Retention dashboard
`/commerce/admin` presents paid-order volume, distinct customer wallets, repeat wallets and **observed** repeat rate from non-refunded paid orders. It is deliberately not called causal uplift. Future merchant pilots should add randomized holdout cohorts and margin-aware reward cost analysis.
