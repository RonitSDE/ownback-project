# OwnBack — setup and deployment

Every setup, deployment and verification guide, combined into one file.

---

## Base Sepolia deployment (core)

_Formerly `DEPLOY.md`._

## OWNBACK v3.2 — Base Sepolia deployment runbook

**Allowed networks:** Anvil 31337 and Base Sepolia 84532. The `DeployTestnet` script rejects Base mainnet. This release **cannot settle actual tokenized stocks**.

### 1. Developer preflight

Install Node 22+, npm, Git, Foundry (`forge`, `anvil`) and dependencies on a network-enabled machine.

```bash
npm ci
./contracts/install-deps.sh
npm test
npm run release:preflight
npm run check
npm run build
npm run test:contracts
```

If any command fails, STOP and fix before broadcasting. For local-chain verification run Anvil and the commands in README; separately run `npm run test:e2e` with the Next.js server available.

### 2. Deploy the mock stack to Base Sepolia

Get test ETH for deployer and keeper. Use separate keys; neither must be hardcoded, committed, or sent to a browser. **Do not reuse the Anvil development keys on public chains.**

```bash
cp .env.example .env.local
## Set DEPLOYER_PRIVATE_KEY and KEEPER_ADDRESS securely in your shell/secret store.
cd contracts
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url https://sepolia.base.org --broadcast
cd ..
```

The script writes `contracts/deployments/84532.json`. Commit only the PUBLIC deployment JSON (never `.env`, private keys, or local Anvil deployment output). Verify the contract bytecode/source on a Base Sepolia explorer using your preferred Foundry/explorer API setup.

The deployment creates a funded campaign: **2% first purchase, 5% comeback within seven days, $10 maximum reward, $5 minimum checkout, ten-minute refund hold.** These are mock USDC and mock stock, both without monetary value.

### 3. Verify the external reference feed

```bash
npm run prices:check
```

Check the quote for `STOCK_SYMBOL` includes a recent `nav_price` **and `nav_price_updated_at`**. If the source is older than `MAX_SOURCE_AGE_SECONDS` or onchain `maxPriceAge`, the keeper will not publish the price. Source-time validation intentionally makes stock settlement unavailable during long market closures; alert on this condition and let customers know the reward remains reserved pending resumption. Static pricing is for local Anvil simulations only by default.

### 4. Configure keeper

Server environment (never expose `KEEPER_PRIVATE_KEY` as `NEXT_PUBLIC_*`):

```dotenv
RPC_URL=https://sepolia.base.org
KEEPER_PRIVATE_KEY=0xYOUR_KEEPER_PRIVATE_KEY
DEPLOYMENT_FILE=contracts/deployments/84532.json
PRICE_SOURCE=coinbase
STOCK_SYMBOL=AAPLc
MAX_SOURCE_AGE_SECONDS=172800
KEEPER_MAX_PURCHASES=10000
KEEPER_INTERVAL_MS=60000
```

```bash
npm run keeper:once
## Or use npm run keeper for a continuous worker
```

The included GitHub Actions keeper runs every five minutes with a concurrency group. Add `KEEPER_PRIVATE_KEY` as a GitHub secret. For a recorded live demo, a dedicated worker process is more predictable. The keeper scans **all onchain purchases** to avoid losing work on restart, so stop and replace it with a durable indexed queue before exceeding `KEEPER_MAX_PURCHASES` or running commercial volumes. Use only ONE active keeper instance per key to avoid nonce races.

### 5. Deploy frontend on Vercel or equivalent

Set `NEXT_PUBLIC_CHAIN_ID=84532`, dedicated `NEXT_PUBLIC_RPC_URL`, and fill the following from your deployment JSON:

```dotenv
NEXT_PUBLIC_OWNBACK_ADDRESS=...
NEXT_PUBLIC_USDC_ADDRESS=...
NEXT_PUBLIC_STOCK_ADDRESS=...
NEXT_PUBLIC_ADAPTER_ADDRESS=...
NEXT_PUBLIC_CAMPAIGN_ID=1
NEXT_PUBLIC_DEPLOY_BLOCK=...
NEXT_PUBLIC_STOCK_SYMBOL=AAPLc
```

Optional `NEXT_PUBLIC_BUILDER_CODE` is your ERC-8021 Base Builder Code. Build with `npm run build` and deploy with a provider supporting the Next.js App Router; set the above variables **at build time**.

```bash
SMOKE_URL=https://your-preview-domain.example npm run smoke
```

Check `/api/health` returns 200 with `priceFresh: true` before asking judges to test live self-settlement. A stale source response is intentionally degraded, not silently replaced with sample data.

The testnet adapter accepts a source price up to **5 days** old (`PRICE_MAX_AGE` in the deploy script), which
covers weekends and US market holidays, when Coinbase's NAV stops updating. Checkout never depends on price
freshness: rewards are reserved in USD. Only settlement pauses when the price is older than that, and the shop
labels a closed market as "Market closed · last NAV" rather than "stale".

### 6. Final real-transaction checklist

1. Fresh customer wallet on Base Sepolia gets mock USDC from test faucet.
2. Checkout page displays positive eligible reward and readable policy. Buyer approves mock USDC.
3. Buy $48: merchant balance increases by $48 mock USDC; reward reservation equals $0.96; view the transaction hash.
4. Wait ten minutes; keeper or customer calls settle. Confirm `RewardDelivered` event and stock balance +0.0048 when price is $200.
5. Buy again in the seven-day window: reward $2.40, settlement +0.012 at $200 reference.
6. Attempt third reward checkout: blocked WITHOUT payment. Replay the same orderRef: blocked WITHOUT payment.
7. Merchant pauses or drains available budget between preview and pay: tx reverts, buyer retains USDC.
8. Run keeper twice and restart it: no duplicate mint; create and fund a second campaign using same mock stock and confirm its payments settle too.
9. Take one refund before settlement and observe release; inspect a post-settlement refund as flagged exception.
10. Record browser/mobile walkthrough and save explorer receipts. Never call these mock stock tokens real shares.

**Security before commercial use:** independent audits, eligibility verification, real permitted execution provider, independent price/quote checks, seller/fulfillment identity, privacy/compliance controls, persistent indexed worker and alerting, treasury controls, fraud/chargeback policy and disclosures. Mainnet security and securities compliance are **NOT implemented** in this package.

---

## Hybrid developer setup (v3.5)

_Formerly `HYBRID_V3_5_DEPLOY.md`._

## OWNBACK 3.5 — Hybrid Commerce / Shopify Connect + Base USDC

**Delivery status:** developer deployment candidate. Not yet installed on a real Shopify store, deployed on Base Sepolia, or approved to distribute actual securities. Shopify and Bankr do not authorize securities transfers. No real equity is issued by this repository.

### Product scope
- **Native OWNBACK store `/commerce`:** existing merchant catalog, inventory, USDC payments to merchant, refund management, Base proof and reward reservations. Inventory data is kept in PostgreSQL.
- **Shopify `/experience`:** Web2 card/Shop Pay commerce is processed solely by Shopify. OWNBACK requests read-only access to paid orders, records idempotent paid/refund events, waits for the configured refund hold, sends a one-time email link, verifies the claim wallet, and pays a *synthetic* testnet stock reward from a separate merchant-funded vault. It does **not** replace Shopify's checkout or charge the customer USDC again.
- **Bankr:** read-only analysis, never automatic user borrowing. `/protocol` remains evidence-first.
- One pilot Shopify store and USD-denominated paid orders only. Shopify supports more regions/currencies, but explicit FX and legal eligibility have not been implemented here.

### Pre-requisites
1. Node 22 and npm 10; PostgreSQL 15+, Foundry (Forge/Anvil), an accessible Shopify development store, and an OWNBACK merchant account with a single pilot configuration.
2. Register a **standalone Shopify app** (external auth code flow), allowlist the pilot shop, request `read_orders` and configure callback `https://YOUR_HOST/api/shopify/callback`. Merchant installation uses the logged-in `/commerce/admin` cookie; do not open the installation link from another browser.
3. Shopify app credentials with approved order/customer data access. Access to buyer emails may require Shopify protected customer-data approval. If unavailable, wallet-claim email issuance safely blocks.
4. A verified transactional-email sender and working `RESEND_API_KEY` for claim emails. One pilot merchant with a funded testnet wallet and a separate keeper/executor wallet.
5. Confirm app-distribution and token/financial-product policies with Shopify before offering real equity rewards or listing publicly. Mainnet stock transfers remain disabled.

### Configuration
Copy `.env.example` to `.env.local` and `.env`, do not commit either. Set `DATABASE_URL`, merchant auth, `APP_ORIGIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_ALLOWED_SHOP`, random 32-byte `SHOPIFY_TOKEN_ENCRYPTION_KEY`, random `SHOPIFY_CUSTOMER_SECRET`, and `RESEND_API_KEY` plus `SHOPIFY_CLAIM_FROM_EMAIL`. Use HTTPS in staging. For local demos, `SHOPIFY_PILOT_DEMO=true` may return a claim URL **only** on localhost and testnet; never enable it in production.

#### Create fresh secrets
```
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```
Generate separate values for each secret; do not reuse encryption and HMAC secrets.

#### Install and migrate
```
npm run bootstrap:lock    # missing pg and @types/pg entries are resolved with network access
npm ci
npm run commerce:migrate
npm run test:hybrid
npm run test:commerce
npm test
npm run check
npm run build
```

#### Deploy the Base Sepolia demo
```
./contracts/install-deps.sh
npm run test:contracts
## Set DEPLOYER_PRIVATE_KEY / KEEPER_ADDRESS in the shell (not in source).
cd contracts
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url https://sepolia.base.org --broadcast
cd ..
```

The deployment JSON contains `shopifyRewardVault`, `shopifyRewardAdapter`, the existing OWNBACK vault, mock USDC, and mock stock. Set `SHOPIFY_REWARD_VAULT_ADDRESS`, `SHOPIFY_REWARD_DEPLOY_BLOCK`, `SHOPIFY_REWARD_EXECUTOR_KEY` (the exact deployed `KEEPER_ADDRESS` key), `SHOPIFY_REWARD_RPC_URL`, `SHOPIFY_MOCK_PRICE_USDC` equal to `INITIAL_PRICE_USDC`, and existing `COMMERCE_*` variables. The Shopify vault is funded by the demo merchant during deploy. Tokens are **synthetic and have no economic value**.

#### Connect Shopify
1. Start `npm run dev` with a tunneled HTTPS callback or deploy staging.
2. Log in at `/commerce/admin` and navigate to `/experience`, merchant tab.
3. Enter the allowlisted `your-store.myshopify.com` domain. Shopify authorization requests read-only order scope; token is AES-256-GCM encrypted in PostgreSQL.
4. The OAuth callback registers `ORDERS_PAID`, `REFUNDS_CREATE`, `ORDERS_CANCELLED`, and `APP_UNINSTALLED` subscriptions. `webhook_ready` must become true; if false, correct Shopify app configuration and verify subscriptions before processing orders.
5. Complete a real paid USD order with a pilot test account. The signed webhook records a `HOLD` record. Duplicate webhook IDs and duplicate `(shop, order)` records never double-credit. Refunds and cancellations block claims—even if received before the paid event.
6. After `SHOPIFY_REFUND_HOLD_HOURS` (24 by default, also reflected by vault deployment for Sepolia), a merchant can click **Send claim** or a private worker can run `npm run shopify:claims` with `SHOPIFY_AUTO_EMAIL_CLAIMS=true` to email eligible orders automatically. OWNBACK re-queries Shopify's current paid/refund state and sends a one-time link to the buyer email via the configured email provider.
7. Buyer visits `/claim`, connects their Base Sepolia wallet, and signs a *message only*. No customer USDC payment or allowance is requested.
8. Execute `npm run shopify:settle` from a **single dedicated private worker**, with its own secure executor key. It fetches Shopify's live order again, verifies the hold, checks history and onchain merchant budget, executes the mock reward, and requires a Base transaction receipt + RewardDelivered event before reporting success.
9. Make a second Shopify purchase within 7 days with the *same customer identity*. The first delivered reward is a prerequisite; a third order is ineligible for a comeback reward. Confirm the repeat bonus, refund and double-webhook cases.

### Production deployment gaps
- Shopify API OAuth token refresh/rotation and public app distribution review need to be integrated using the official Shopify app framework before supporting multiple outside merchants. Single pilot token storage is implemented; this is not a public-marketplace Shopify app.
- Customer eligibility for actual securities, KYC/geofencing, approved distribution rails, lending rules, and full refund-after-delivery workflows are not implemented. This package is testnet-only; none of these should be bypassed.
- The Shopify reward worker is intended for a **single** process; add a durable queue, distributed lock, nonce management and reorg/finality handling before scale.
- Merchant cross-channel unique-customer counts cannot automatically be deduplicated when one person buys through Shopify and a different Base wallet. Dashboard metrics remain channel-scoped.
- For normal Shopify checkout, OWNBACK should add an official Thank you/Order Status UI extension through Shopify CLI after the custom app is approved; the secure email claim works as the pilot fallback. Don't inject checkout scripts or assume payment-page customization permissions.
- Real provider tests, PostgreSQL migration against a populated DB, Next.js production build, Foundry, local-chain lifecycle, and live Shopify webhooks must pass on the developer machine before production sign-off.

### Acceptance tests
- Clean `npm ci`, `npm run build`, `npm run check`, 11 hybrid tests, existing tests, Forge suite and a local E2E run all pass.
- Shopify install callback HMAC and CSRF reject tampering; webhook HMAC rejects modified payloads; duplicate webhooks and refunded-before-paid are safe.
- No testnet reward is reported delivered without a confirmed vault event; no reward is charged to a Shopify customer. First reward = 2%, comeback = 5% within seven days, per-order cap = $10, duplicate attempts blocked.
- Both mobile and desktop `/experience`, `/commerce`, and `/claim` pass manual touch, keyboard and wallet QA with no blocking issues. Test checkout with a guest buyer and registered Shopify customer.

**Source grounding:** Shopify OAuth, webhook topics, and Thank You / Order Status UI extension limitations follow Shopify's published developer docs; review them again at implementation time.

### Build reproducibility warning
The uploaded 3.4 lockfile omitted `pg` and `@types/pg` even though the app used them. No npm-registry access was available during this packaging run. CI now performs `npm run bootstrap:lock` before `npm ci` to make a clean connected machine runnable, **but deterministic dependency pinning is not fully restored**. Before production handoff, generate/commit the resolved lockfile in a networked environment, change CI back to plain `npm ci`, and run `npm run format && npm run format:check` once. This is an explicit deployment gate; do not describe this source ZIP as independently production-build verified.

Configure `SHOPIFY_REWARD_ACTIVE_FROM` to the Shopify vault deployment timestamp in ISO 8601 form. Orders paid before the campaign launched are excluded, rather than sending unfulfillable claim emails.

---

## Agentic commerce setup (v3.6)

_Formerly `AGENTIC_COMMERCE_V3_6_DEPLOY.md`._

## OWNBACK v3.6 — Agentic Commerce developer handoff

### What v3.6 actually adds

- `/agentic`: premium mobile-responsive product discovery with live Shopify UCP Catalog search, real variant selection, Shopify Cart MCP creation, and a user-controlled merchant checkout handoff.
- `/api/agentic/merchants`: lists *installed and active* Shopify pilot stores only, constrained by optional merchant allowlist.
- `/api/agentic/search`: sends `search_catalog` JSON-RPC to the store's `/api/ucp/mcp`; refuses to invent offers or claim unverified stock rewards.
- `/api/agentic/cart`: uses `lookup_catalog` to revalidate variant availability before `create_cart`; returns only vetted merchant-origin HTTPS checkout URLs.
- `public/profiles/ownback-ucp.json`: publicly hosted 2026-08-25 agent profile declaring catalog search/lookup and cart capabilities.
- A transparent **preview mode** operates without live credentials, displays *sample products only*, and never accepts payment or marks a reward delivered.
- Shopify Connect, normal Shopify checkout, authenticated order/refund webhooks, separate testnet reward vault, customer wallet claim, native USDC commerce, and read-only Bankr research remain unchanged.

**Not built:** autonomous card payment, Global Catalog discovery, AI-provider personalized reasoning, production tokenized-equity issuance, Bankr-managed customer borrowing, or Shopify App Store distribution approval. The conversational interface uses Shopify's natural-language catalog search with grounded templates; it is not a model-generated shopping advisor.

### Local setup

```bash
cd ownback
## IMPORTANT: v3.5 inherited a lockfile missing the PostgreSQL packages.
## On a network-connected machine, regenerate and COMMIT the corrected lockfile:
npm install --package-lock-only
npm ci

cp .env.example .env.local
## Configure existing commerce PostgreSQL, Shopify app, Base contracts and Bankr keys as needed
## Existing migrations and contracts are unchanged in v3.6
npm run commerce:migrate
npm run test:agentic
npm run agentic:preflight
npm test
npm run check
npm run build
npm run dev
```

Go to http://localhost:3000/agentic. Preview mode is functional immediately without merchant data; it is explicitly illustrative. All live-mode actions require a real installed Shopify merchant and a publicly reachable UCP agent profile.

### Shopify UCP configuration

1. Register the Shopify app and connect the merchant through the existing `/commerce/admin` or `/experience` OAuth flow; verify that `shopify_installations.active=true` and webhooks are registered.
2. Publish `public/profiles/ownback-ucp.json` on a **public HTTPS domain** (e.g., `https://ownback.example.com/profiles/ownback-ucp.json`). Set `UCP_AGENT_PROFILE_URL` to that URL. **Do not** use `localhost` as the profile URL for live Shopify UCP; Shopify fetches the agent's profile.
3. Set `SHOPIFY_AGENT_ALLOWED_SHOPS=your-store.myshopify.com`. Only installed stores appear to customers. For pilot scope, keep the allowlist restricted.
4. If the store's `cart.continue_url` uses an independently verified custom primary domain, put just that hostname in `SHOPIFY_AGENT_ALLOWED_CHECKOUT_HOSTS`. If Shopify UCP redirects `/api/ucp/mcp` from `myshopify.com` to that primary storefront, also set `SHOPIFY_AGENT_STOREFRONT_HOST` to the same verified host. Arbitrary redirects are rejected. Do not wildcard the setting.
5. Confirm storefront UCP support via Shopify's `https://{shopDomain}/.well-known/ucp` profile and `https://{shopDomain}/api/ucp/mcp`. The app uses `search_catalog`, `lookup_catalog`, and `create_cart`; it uses **no bearer token and no autonomous Checkout MCP payment**.
6. Shopify returns live product prices in **minor currency units** (e.g., USD 1899 = $18.99). OWNBACK's reward preview uses 2% first / 5% comeback, capped at $10, but must remain marked *illustrative* until purchase, campaign funding, customer identity, holds, jurisdiction and refund checks are verified.
7. Keep Shopify checkout as merchant-of-record. Payment cards, tax and shipping information are entered only on Shopify. The original authenticated `orders/paid`/refund webhook processing controls eligibility after checkout.

Reference: https://shopify.dev/docs/agents , https://shopify.dev/docs/agents/catalog/storefront-catalog , https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp

### Acceptance checklist (must actually run)

- [ ] Preview mode on `/agentic` renders on midrange Android and iPhone; cart quantities and reward estimates recompute; no actual purchase is claimed.
- [ ] Connected Shopify store appears after OAuth, with public HTTPS agent profile accepted by UCP.
- [ ] Search in live mode returns real products, valid variants, images and accurate minor-unit prices.
- [ ] A selectable variant becomes a Shopify cart, returns verified HTTPS `continue_url`, and opens merchant checkout. Incorrect hosts/invalid variants are refused.
- [ ] After a real **test** Shopify payment, merchant webhook is HMAC verified, order is deduplicated, and refund-before-payment is handled correctly.
- [ ] After the configured hold, customer receives a claim invitation, signs wallet claim, and receives a **confirmed mock-token transaction on Base Sepolia** from a funded vault; explorer proof is shown.
- [ ] A return order within seven days earns the higher rate once; invalid/duplicate/late/refunded orders never pay.
- [ ] Independent native USDC store still passes inventory reservation, payment receipt, fulfillment and refund tests.
- [ ] Bankr research remains read-only; no operator wallet loan execution is exposed.
- [ ] `npm ci`, full TypeScript check, `next build`, Foundry tests, local-chain E2E, Shopify staging and cross-device UX pass.
- [ ] Rate limits are moved to a shared store and deployment-level WAF protection is configured before public traffic; current server limiter is best effort per process.
- [ ] Production LCP target <2.5s p75 on a mid-range Android under 4G conditions; measure before claiming success.

### Unsupported or blocked here

The source uses the correct Shopify UCP shapes per the 2026-08-25 documentation, but we do not have a live pilot store, customer test accounts, public profile domain, merchant credentials or Base Sepolia wallet access in this environment. New UCP boundary tests are executable offline; an authenticated real-world checkout, confirmation webhook and stock settlement must be tested on staging before claiming production readiness.

**Compliance**: live securities transfers and collateralized loans remain disabled. Stock-delivery claims in this build refer to synthetic testnet tokens only. A Shopify merchant's UCP support is not authorization to distribute regulated securities.

---

## Commerce v4 deployment

_Formerly `COMMERCE_V4_DEPLOY.md`._

## OWNBACK Commerce v4 — deployment and verification

### Scope

This adds an **actual single-merchant catalog, inventory reservations, cart, USDC onchain payment reconciliation, customer receipts, fulfillment operations and merchant-initiated onchain refunds** to OWNBACK v3.1.2. It is **not Shopify**. It runs on Base Sepolia with the existing stock mock and onchain loyalty vault. Product payments are USDC; stock rewards remain **mock tokenized equities** until a regulated execution partner is onboarded.

First release allows merchant pickup or digital fulfillment only. No shipping, tax computation, VAT collection, fiat payment processing, automatic digital-entitlement delivery, or real-security settlement. Do not accept taxable real-money merchant sales without suitable tax and consumer-law handling.

### Requirements

- Node.js 22, PostgreSQL 15+, merchant wallet on Base Sepolia, a working RPC, deployed OWNBACK v3.1.2 contracts with the correct merchant campaign and funded stock-reward budget.
- A persistent Node.js hosting service for Next.js (not static export). Set `APP_ORIGIN` to the exact public HTTPS origin; secure cookies will be enabled in production.
- A scheduled call every minute to `POST /api/commerce/admin/reconcile` with `Authorization: Bearer $COMMERCE_CRON_SECRET`. This first indexes confirmed `Purchased` logs, then checks **onchain orderRefUsed** before releasing expired inventory. Do not use a blind database-only expiry job.
- Rate limiting at the reverse proxy/WAF in addition to database-based endpoint limits. For serious volume, use Redis-backed shared limits and queues.

### Start locally

```bash
cp .env.example .env.local
## Set UNIQUE secrets, real deployed contract addresses, and RPC values.
## Store DATABASE_URL also in .env for the standalone migration script.
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

### Customer purchase workflow

1. Merchant publishes products and sets inventory, prices, and fulfillment type.
2. Customer selects products of the same fulfillment type and connects an injected Base Sepolia wallet.
3. Backend checks stock in a PostgreSQL transaction, locks product rows, reserves units, issues a unique order reference and a 15-minute quote deadline. The customer gets a secret receipt token held in local storage.
4. The wallet approves the **exact cart USDC amount** if needed and calls the existing `Ownback.pay(campaignId, amount, orderRef, minReward, quoteDeadline)`.
5. Contract reverts if reward cannot be reserved. Otherwise payment goes directly to the merchant; onchain `Purchased` is the payment proof.
6. Browser sends its transaction hash. Backend verifies a successful receipt **from the expected vault**, matching campaign ID, order reference, customer wallet and USDC amount; then it atomically deducts stock and marks order paid.
7. Merchant fulfills the order manually, or invokes a real onchain refund from the merchant wallet, verified before the DB status changes.
8. Keeper delivers mock-stock reward after configured hold. The commerce payment proof and stock reward settlement are separate processes.

### Critical acceptance tests before launch

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

### Operational caveats

- **This release has not passed a live chain checkout in this environment.** The source was authored and its syntax inspected; npm, Foundry, PostgreSQL, and Base RPC are needed for the full suite. Do not label it production certified.
- Use a dedicated restricted single-store merchant credential, never reuse the executor or owner private key in the website.
- Server-side stock reservations may be abused by wallet rotation; deploy anti-bot/WAF controls and monitor reservation rates.
- Use a single canonical, trustworthy RPC provider for payment receipt confirmation and inventory expiry; validate confirmations before physical fulfillment.
- A built-in payment indexer replays `Purchased` logs and reconciles paid orders even if the buyer closed the browser. Configure `COMMERCE_DEPLOY_BLOCK` correctly, run the reconciler every minute, monitor cursor lag and errors, and use a reliable archive-capable RPC. The cron indexes a bounded number of blocks per invocation; initial catch-up may require repeated invocations. Payment logging failures halt cursor advancement.
- Add independent order email notifications, digital file delivery, refund policy and any local VAT rules before real commercial operation.
- The refunds flow changes ownership reward state onchain; it does not automatically restock physical goods. Merchant must inspect returned goods and restock intentionally.
- `COMMERCE_ADMIN_PASSWORD` is a single-merchant pilot login. Multi-merchant roles, passkeys and third-party merchant authorization are later milestones.

### Release classification

**Engineering candidate only.** The project is packaged with the previous v3.1.2 app, and the commerce code has passed TypeScript syntax parsing and dependency-free core tests; it has **not** passed the complete `npm run build`, live PostgreSQL/HTTP test, Foundry, or actual Base Sepolia transaction flow in this environment. These must pass on a network-enabled machine before serving real users. Never advertise test USDC or mock stock as redeemable money or a regulated security.

### Required runtime variables

`COMMERCE_VAULT_ADDRESS`, `COMMERCE_CAMPAIGN_ID` and `COMMERCE_CHAIN_ID` must exactly match `NEXT_PUBLIC_OWNBACK_ADDRESS`, `NEXT_PUBLIC_CAMPAIGN_ID` and `NEXT_PUBLIC_CHAIN_ID`. Set `COMMERCE_DEPLOY_BLOCK` to the first contract deployment block. Cron should run `POST /api/commerce/admin/reconcile` at least once per minute with the bearer secret, reprocessing until `more` is false. Newly paid orders require at least three chain confirmations before the backend marks them paid.

---

## Bankr integration

_Formerly `BANKR.md`._

## Bankr: read-only research integration — v3.4

The v3.3 publicly accessible Bankr borrow path was unsafe because it used a single operator API key, not the connected customer's Bankr wallet. It is now disabled at `/api/agent/borrow` (403), irrespective of old flags.

Use a dedicated Bankr API key with **read-only** permissions and optional IP restrictions (verify at bankr.bot/api-keys), `BANKR_RESEARCH_ENABLED=true`, `BANKR_API_KEY` and a random `BANKR_JOB_TOKEN_SECRET` (32+ chars). Bankr docs: GET `/wallet/me`, POST `/agent/prompt`, GET `/agent/job/:id`. The prompt is educational, requests no account balances or transaction execution, and is constrained by an allowlist. Job access uses a signed 10-minute receipt. Verify the account key is read-only: the application cannot infer this from a successful authentication probe.

The result screen shows the Bankr **response**, never claims a completed job means a real loan. This integration does not authorize or execute lending. A future production loan feature needs customer-specific provisioning, permitted real assets, validated market position, independent LTV/health checks, a user-approved transaction and verified debt state.

`npm run bankr:check -- --ask` requires a funded or subscribed Bankr account; do not paste keys into browser or public logs.

---

## Smoke test

_Formerly `SMOKE_TEST.md`._

## Staging test plan (must be executed, not asserted)

### Tools & setup
Node >=22, PostgreSQL 16, Foundry and a configured Base Sepolia RPC. Configure a merchant wallet and an independent buyer wallet. Set `DATABASE_URL` for the Postgres container (localhost port 5433). Deploy mock contracts, create a campaign with the correct configured merchant; ensure all public and private contract addresses refer to the same deployment.

### Checkout → inventory → receipt
- Create product with stock 2, price 48 USDC. Two separate customers buy at the same moment; only 2 units can be reserved. A third request must be rejected.
- Reserve one and leave without paying. Wait for quote expiry; reconciliation must prove no `Purchased` event and return inventory.
- Pay a reserved order; close browser immediately. Run the indexer; it should verify 3 Base confirmations and mark exactly one `PAID` order, with a matching wallet, orderRef, campaign, vault and amount.
- Retry with the same transaction: no extra inventory deduction; second reference using the same tx fails.
- Attempt wrong payer, wrong ref, insufficient reward budget, paused campaign, expired quote. They must not collect customer USDC.
- Merchant marks pickup fulfilled; refund a paid order. Onchain purchase state/merchant refund state must reconcile.

### Loyalty / stock proof
- Valid first purchase earns 2%, then eligible repeat earns 5% within seven days and cannot repeat the comeback bonus. Test at the 7-day boundary and just after.
- Keeper restarts halfway through settlement; repeat receipt processing must not duplicate delivery.
- Stock adapter must emit mock token transfer, not simply mark USDC payment as stock delivery.

### Bankr
- Configure dedicated **read-only** key and Agent API credits; `GET /wallet/me` responds. Trigger one allowlisted research job, follow signed polling link to terminal state.
- Invalid symbols, forged/expired research receipt and repeated prompts fail; `/api/agent/borrow` always returns 403 even if legacy `BANKR_BORROW_ENABLED=true`.
- Verify operator key cannot transfer or borrow. A job `completed` must never show “Loan opened.”

### Release gates
- `npm install --package-lock-only` on a network-enabled machine to update lock (pg dependency); commit it; `npm ci` on a clean clone.
- `npm test && npm run test:commerce && npm run check && npm run build && npm run test:contracts && npm run verify:local` all pass.
- Rehearse the browser checkout on mobile, merchant refund, keeper crash/restart, database backup and recovery.
- Block real-money customer access pending legal/issuer review, financial integration approval and independent contract security review.

---

## Release checklist

_Formerly `RELEASE_CHECKLIST.md`._

## OWNBACK v3.2 release acceptance — developer sign-off

### Safety blockers fixed in source

- [x] Mandatory nonzero unique orderRef (per campaign)
- [x] Atomic USDC-denominated minimum reward floor, never silently rewardless
- [x] Short user quote deadline; expired/changed preview reverts before transfer
- [x] Local browser checkout intent and transaction hash survive reloads / prevent automatic duplicate submit
- [x] Onchain reward reservations cannot be withdrawn before settling
- [x] Testnet adapter preserves _source_ observation timestamp and rejects stale, future and regressing values
- [x] Order references scoped per payer (anti-griefing); explicit no-reward opt-in; two-step ownership
- [x] Slither: no medium or higher findings outstanding (see SECURITY.md)
- [x] Real-browser wallet journey passes (`npm run test:ui`)
- [ ] Manual pass with real Coinbase Wallet, MetaMask and Rabby extensions on Base Sepolia
- [x] Mock stock and frontend use 8 base-unit decimals + separate 18dp multiplier
- [x] Keeper checks all configured-stock campaigns, recovers after process restart from onchain state
- [x] Mock testnet deployment script refuses mainnet

### Tests executed in this environment

- [x] `npm test`: **22/22 pass** (JS engine, time validation, ABI signature checks)
- [x] `npm run release:preflight`: PASS
- [x] TS/TSX **syntax parse**: 20 files, zero errors (this is not typecheck)
- [x] JS syntax checks: scripts parse cleanly

### Developer MUST execute before release (not yet verified)

- [ ] `npm ci` online (offline registry cache lacked `zod`)
- [ ] `npm run check` TypeScript typecheck
- [ ] `npm run build` Next.js production build
- [ ] `./contracts/install-deps.sh` and `npm run test:contracts` Foundry tests
- [ ] Start Anvil, deploy to local chain, `npm run e2e:local`
- [ ] `npm run dev` plus `npm run test:e2e` Playwright browser flows
- [ ] `npm run prices:check` verify Coinbase response date on a live network
- [ ] Base Sepolia deploy/contract verification and funded checkout/settlement tx receipts
- [ ] Browser account switch / mobile wallet recovery / retry after RPC timeout
- [ ] Chaos tests: stale price, provider outage, refunded order, restart, simultaneous campaigns, nonce collision, gas limits

### Limitations and NOT production-ready

- No Shopify/offchain merchant connector (this product uses its own onchain checkout).
- No regulated stock issuer/provider execution, KYC/eligibility or real tokenized equities.
- Current mock adapter mints synthetic test assets; reference NAV is not an executable quote.
- Stateless keeper is capped at 10,000 historical purchases and must be replaced by an indexed durable service for commercial traffic.
- Browser log scans are not indexed/paginated for large volumes; external markets and loan paths are links only.
- Merchant refund depends on merchant initiating refund and having USDC allowance; reserved rewards can be released after 30 days past hold as disclosed by the contract.
- No independent security audit or real commercial compliance review.

**Release definition:** "Deployable Base Sepolia testnet candidate pending developer E2E execution". Do not describe as production audited, enterprise scale, live stock buyback, or verified mainnet.

**Shortcut:** `npm run verify:local` orchestrates dependency installation, Foundry tests, local deployment, deterministic E2E, typecheck and frontend production build; _not yet executed here_.
