# OWNBACK v3.7 — The Ownership Retention Protocol

## The product decision

This release deliberately **adds depth to the merchant-retention wedge instead of extending the surface area**. Existing Shopify authenticated webhook rewards, UCP Catalog/Cart checkout handoff, native Base USDC checkout, claim outbox, settlement recovery, and Bankr read-only research remain intact.

### New live code

1. **Balanced premium UI**: rebuilt `/` landing, `/growth`, `/ownership`, and `/protocol` using warm-off-white, charcoal, pale sage and selective Base blue. Five local, self-contained illustrative product visuals in `public/visuals`. The previous agentic and hybrid experience pages have matching neutral/blue styles, with their real flows preserved.
2. **Merchant Growth Studio (`/growth`)**: interactive, pure deterministic economics model with 4 editable category Loop presets. Inputs are assumed average order value, gross margin, customer count, first and comeback rewards, treatment and control repeat rates. Calculates incremental repeat revenue, gross contribution, total incentive cost, net campaign contribution, cost per incremental returning customer, and mathematical break-even rate. **Inputs do not modify onchain campaign terms**.
3. **Authenticated observed Proof of Retention** (`GET /api/retention/overview`): Shopify and native commerce verified purchase counts, distinct channel-specific buyers, observed returners, gross settled sales and Shopify finality/refund aggregates. Returns `experimentalLift:null` until a genuine pre-exposure assigned control exists. Denies unauthenticated access and never substitutes fabricated metrics.
4. **Simple shopper Ownership Portfolio (`/ownership`)**: reads native Sepolia positions and purchases directly from current contracts; a time-limited read-only wallet signature unlocks claimed Shopify orders using `POST /api/retention/portfolio`. A public wallet address alone does not expose Shopify order history. Displays reserved, eligible, settling, delivered, reversed and **refund-after-delivery liability** distinctly. No pending claims are counted as delivered stock.
5. **Updated protocol story**: payment proof, reserved funds, refund-aware eligibility and confirmed delivery; late refunds create a merchant liability rather than magically reversing a transferred token. B20 real equity remains a **proposed integration subject to compliance and partner approval**, not a feature claimed live.
6. **Standalone offline UX preview**: `public/preview/v3.7.html` and separate `OWNBACK_v3.7_Balanced_Interactive_Experience.html`. Explicit demo controls for first purchase, comeback, refund, and four settlement stages. **No real payment or blockchain requests in preview**.

### Not implemented / not proven

- Real B20 issuance, stock transfer, voting or economic rights, or corporate actions; synthetic stock rewards on Base Sepolia only.
- A causal measured retention-lift study; correctly assigned buyer holdout requires pre-exposure treatment assignments and merchant consent. Slider inputs are not measured proof.
- Co-funded brand campaigns, cross-merchant onchain passport, real lending or autonomous Bankr trades.
- Clean `npm ci`, `next build`, typecheck or Foundry recompilation on this offline machine. The inherited lockfile omits `pg` and `@types/pg` and this environment cannot reach npm registry. **Must regenerate and verify lockfile on a network-enabled machine.**
- Real Shopify staging credentials, a connected pilot merchant, database/Resend, authenticated B20 provider or public Sepolia receipts. Existing E2E logic was simulated in v3.6.2; this release is not a verified live deployment.

### Deployment gates

```bash
# Network-enabled Node/npm machine with full dependencies available
npm install --package-lock-only --no-audit --no-fund
npm ci
npm run verify:manifest  # must regenerate manifest after intentional changes to package-lock.json
npm test
npm run test:recovery
npm run simulate:recovery
npm run check
npm run lint
npm run build
npm run test:contracts
npm run commerce:migrate
npm run agentic:preflight
```

**Do not use a placeholder price/asset as an eligible real stock; never state that a signed Shopify order is the same as a settled onchain reward.** The shopper portfolio uses an `APP_ORIGIN`-bound signature. Configure `APP_ORIGIN` to the exact HTTPS origin shown to the user; otherwise their signature will not verify. In multi-tenant production, bind queries to the authenticated tenant, not only a single-store pilot session.

### Judge demo

Show: shopper discovers merchant item → merchant Shopify checkout handoff → signed paid-order verification → reward hold → customer claim → confirmed Sepolia synthetic-stock delivery → a second eligible purchase → merchant observed return and economics screen. Distinguish actual evidence from preview simulations. A control comparison is only meaningful with valid assigned holdout data and adequate follow-up.
