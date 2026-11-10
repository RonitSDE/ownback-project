# OWNBACK 3.5 — Hybrid Commerce / Shopify Connect + Base USDC

**Delivery status:** developer deployment candidate. Not yet installed on a real Shopify store, deployed on Base Sepolia, or approved to distribute actual securities. Shopify and Bankr do not authorize securities transfers. No real equity is issued by this repository.

## Product scope
- **Native OWNBACK store `/commerce`:** existing merchant catalog, inventory, USDC payments to merchant, refund management, Base proof and reward reservations. Inventory data is kept in PostgreSQL.
- **Shopify `/experience`:** Web2 card/Shop Pay commerce is processed solely by Shopify. OWNBACK requests read-only access to paid orders, records idempotent paid/refund events, waits for the configured refund hold, sends a one-time email link, verifies the claim wallet, and pays a *synthetic* testnet stock reward from a separate merchant-funded vault. It does **not** replace Shopify's checkout or charge the customer USDC again.
- **Bankr:** read-only analysis, never automatic user borrowing. `/protocol` remains evidence-first.
- One pilot Shopify store and USD-denominated paid orders only. Shopify supports more regions/currencies, but explicit FX and legal eligibility have not been implemented here.

## Pre-requisites
1. Node 22 and npm 10; PostgreSQL 15+, Foundry (Forge/Anvil), an accessible Shopify development store, and an OWNBACK merchant account with a single pilot configuration.
2. Register a **standalone Shopify app** (external auth code flow), allowlist the pilot shop, request `read_orders` and configure callback `https://YOUR_HOST/api/shopify/callback`. Merchant installation uses the logged-in `/commerce/admin` cookie; do not open the installation link from another browser.
3. Shopify app credentials with approved order/customer data access. Access to buyer emails may require Shopify protected customer-data approval. If unavailable, wallet-claim email issuance safely blocks.
4. A verified transactional-email sender and working `RESEND_API_KEY` for claim emails. One pilot merchant with a funded testnet wallet and a separate keeper/executor wallet.
5. Confirm app-distribution and token/financial-product policies with Shopify before offering real equity rewards or listing publicly. Mainnet stock transfers remain disabled.

## Configuration
Copy `.env.example` to `.env.local` and `.env`, do not commit either. Set `DATABASE_URL`, merchant auth, `APP_ORIGIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_ALLOWED_SHOP`, random 32-byte `SHOPIFY_TOKEN_ENCRYPTION_KEY`, random `SHOPIFY_CUSTOMER_SECRET`, and `RESEND_API_KEY` plus `SHOPIFY_CLAIM_FROM_EMAIL`. Use HTTPS in staging. For local demos, `SHOPIFY_PILOT_DEMO=true` may return a claim URL **only** on localhost and testnet; never enable it in production.

### Create fresh secrets
```
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```
Generate separate values for each secret; do not reuse encryption and HMAC secrets.

### Install and migrate
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

### Deploy the Base Sepolia demo
```
./contracts/install-deps.sh
npm run test:contracts
# Set DEPLOYER_PRIVATE_KEY / KEEPER_ADDRESS in the shell (not in source).
cd contracts
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url https://sepolia.base.org --broadcast
cd ..
```

The deployment JSON contains `shopifyRewardVault`, `shopifyRewardAdapter`, the existing OWNBACK vault, mock USDC, and mock stock. Set `SHOPIFY_REWARD_VAULT_ADDRESS`, `SHOPIFY_REWARD_DEPLOY_BLOCK`, `SHOPIFY_REWARD_EXECUTOR_KEY` (the exact deployed `KEEPER_ADDRESS` key), `SHOPIFY_REWARD_RPC_URL`, `SHOPIFY_MOCK_PRICE_USDC` equal to `INITIAL_PRICE_USDC`, and existing `COMMERCE_*` variables. The Shopify vault is funded by the demo merchant during deploy. Tokens are **synthetic and have no economic value**.

### Connect Shopify
1. Start `npm run dev` with a tunneled HTTPS callback or deploy staging.
2. Log in at `/commerce/admin` and navigate to `/experience`, merchant tab.
3. Enter the allowlisted `your-store.myshopify.com` domain. Shopify authorization requests read-only order scope; token is AES-256-GCM encrypted in PostgreSQL.
4. The OAuth callback registers `ORDERS_PAID`, `REFUNDS_CREATE`, `ORDERS_CANCELLED`, and `APP_UNINSTALLED` subscriptions. `webhook_ready` must become true; if false, correct Shopify app configuration and verify subscriptions before processing orders.
5. Complete a real paid USD order with a pilot test account. The signed webhook records a `HOLD` record. Duplicate webhook IDs and duplicate `(shop, order)` records never double-credit. Refunds and cancellations block claims—even if received before the paid event.
6. After `SHOPIFY_REFUND_HOLD_HOURS` (24 by default, also reflected by vault deployment for Sepolia), a merchant can click **Send claim** or a private worker can run `npm run shopify:claims` with `SHOPIFY_AUTO_EMAIL_CLAIMS=true` to email eligible orders automatically. OWNBACK re-queries Shopify's current paid/refund state and sends a one-time link to the buyer email via the configured email provider.
7. Buyer visits `/claim`, connects their Base Sepolia wallet, and signs a *message only*. No customer USDC payment or allowance is requested.
8. Execute `npm run shopify:settle` from a **single dedicated private worker**, with its own secure executor key. It fetches Shopify's live order again, verifies the hold, checks history and onchain merchant budget, executes the mock reward, and requires a Base transaction receipt + RewardDelivered event before reporting success.
9. Make a second Shopify purchase within 7 days with the *same customer identity*. The first delivered reward is a prerequisite; a third order is ineligible for a comeback reward. Confirm the repeat bonus, refund and double-webhook cases.

## Production deployment gaps
- Shopify API OAuth token refresh/rotation and public app distribution review need to be integrated using the official Shopify app framework before supporting multiple outside merchants. Single pilot token storage is implemented; this is not a public-marketplace Shopify app.
- Customer eligibility for actual securities, KYC/geofencing, approved distribution rails, lending rules, and full refund-after-delivery workflows are not implemented. This package is testnet-only; none of these should be bypassed.
- The Shopify reward worker is intended for a **single** process; add a durable queue, distributed lock, nonce management and reorg/finality handling before scale.
- Merchant cross-channel unique-customer counts cannot automatically be deduplicated when one person buys through Shopify and a different Base wallet. Dashboard metrics remain channel-scoped.
- For normal Shopify checkout, OWNBACK should add an official Thank you/Order Status UI extension through Shopify CLI after the custom app is approved; the secure email claim works as the pilot fallback. Don't inject checkout scripts or assume payment-page customization permissions.
- Real provider tests, PostgreSQL migration against a populated DB, Next.js production build, Foundry, local-chain lifecycle, and live Shopify webhooks must pass on the developer machine before production sign-off.

## Acceptance tests
- Clean `npm ci`, `npm run build`, `npm run check`, 11 hybrid tests, existing tests, Forge suite and a local E2E run all pass.
- Shopify install callback HMAC and CSRF reject tampering; webhook HMAC rejects modified payloads; duplicate webhooks and refunded-before-paid are safe.
- No testnet reward is reported delivered without a confirmed vault event; no reward is charged to a Shopify customer. First reward = 2%, comeback = 5% within seven days, per-order cap = $10, duplicate attempts blocked.
- Both mobile and desktop `/experience`, `/commerce`, and `/claim` pass manual touch, keyboard and wallet QA with no blocking issues. Test checkout with a guest buyer and registered Shopify customer.

**Source grounding:** Shopify OAuth, webhook topics, and Thank You / Order Status UI extension limitations follow Shopify's published developer docs; review them again at implementation time.

## Build reproducibility warning
The uploaded 3.4 lockfile omitted `pg` and `@types/pg` even though the app used them. No npm-registry access was available during this packaging run. CI now performs `npm run bootstrap:lock` before `npm ci` to make a clean connected machine runnable, **but deterministic dependency pinning is not fully restored**. Before production handoff, generate/commit the resolved lockfile in a networked environment, change CI back to plain `npm ci`, and run `npm run format && npm run format:check` once. This is an explicit deployment gate; do not describe this source ZIP as independently production-build verified.

Configure `SHOPIFY_REWARD_ACTIVE_FROM` to the Shopify vault deployment timestamp in ISO 8601 form. Orders paid before the campaign launched are excluded, rather than sending unfulfillable claim emails.
