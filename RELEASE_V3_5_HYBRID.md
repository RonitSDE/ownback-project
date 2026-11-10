# OWNBACK 3.5 — Hybrid Shopify + Base release notes

## Product decision
Keep OWNBACK's existing USDC-native commerce for crypto customers. Add a **single-store Shopify pilot** for mainstream card/Shop Pay customers. Both channels support the same **2% first purchase, 5% seven-day comeback** loyalty concept, but rely on **different proof and payout contracts**, clearly labeled by provenance. Neither channel enables real securities issuance, securities trading, or autonomous Bankr borrowing.

### Main customer experience
- `/experience`: brand-new responsive hybrid landing, illustrated reward moments, shopper/merchant selector, Shopify vs Base channel comparison, demo receipt, merchant connection and channel-scoped analytics.
- `/commerce`: existing USDC-native catalog, cart, inventory reservation, checkout and refund pipeline preserved.
- `/claim`: one-time emailed Shopify claim; wallet message verification with *no USDC charge or approval*.
- `/shop`: existing wallet/rewards experience, native Base rewards.
- `/protocol`: existing source-evidence and Bankr research story, with no automated loans.

### Technical integration
- Shopify app installation via standalone OAuth code grant, state cookie, callback HMAC, encrypted per-shop token. Merchant admin session required to initiate installation.
- Shopify `ORDERS_PAID`, `REFUNDS_CREATE`, `ORDERS_CANCELLED`, `APP_UNINSTALLED` webhooks; verification on raw HTTP bytes, deduplication by webhook ID and by shop+order, refund-before-order protection, guest email fallback hashed with a secret, USD-only eligibility.
- PostgreSQL integration schema, separate from native commerce orders; merchant dashboard never fabricates cross-channel deduplicated customers.
- Server-side live Shopify order verification at issuance and settlement (financial status, cancellations, refunds, USD amount, recipient email).
- Resend backed one-time link email (manually issued or automatic private worker), 7-day expiry and signed wallet binding.
- New isolated ShopifyRewardVault.sol, testnet-only (Anvil / Base Sepolia), merchant-funded USDC, max $10 reward, one initial and one seven-day comeback per pseudonymous customer, unique order hashes, approved executor, atomic synthetic-token delivery proof.
- Dedicated worker with receipt reconciliation and safe idempotent retry behavior. **Not a scale-ready distributed queue.**
- Existing Bankr APIs remain read-only and untouched.

### Verification carried out in this artifact session
- 54 existing and new independent Node.js tests passed in the selected test suites.
- 11/11 new Shopify cryptography, pseudonymity, reward-rules and payout-gate tests passed.
- TypeScript/TSX syntax parsed (91 files) with the locally installed compiler; no syntax errors found.
- Existing release and commerce preflight scripts passed.
- Verified ZIP / integrity manifest during packaging.

### NOT verified
- `npm ci` / Next.js production build / full TypeScript typecheck. npm registry DNS was unavailable; inherited lockfile omits `pg` and `@types/pg`. The first networked developer installation must bootstrap and commit a newly resolved lockfile.
- Forge contracts did not compile in this container (Foundry unavailable). New bridge contract requires a clean Forge compile and security review.
- New `/experience` inside Next.js not rendered in Chromium; this environment blocks local browser navigation. A separate *static, non-connected visual preview* is included.
- No Shopify app credentials, email account, merchant store, database instance, Base Sepolia vault or Bankr key were connected. No real-world purchase or equity transfer is claimed.
- Price-based real-stock execution, KYC, and permissions for tokenized securities are deliberately disabled.

## Required launch gates
1. Run `npm run bootstrap:lock`, commit the regenerated lockfile, restore CI to strict `npm ci`, then run `npm run format && npm run format:check && npm run lint && npm run check && npm run build`.
2. Forge: `./contracts/install-deps.sh && npm run test:contracts`, local Anvil payments plus new ShopifyRewardVault test suite; verify addresses on Base Sepolia.
3. Configure Shopify OAuth/approved data access, HMAC webhooks, and secure SMTP/Resend key, then test a REAL paid order, one duplicate delivery, a refund-before-paid event and a post-payment refund.
4. Test first claim and comeback claim, actual mock stock receipt events on Base Sepolia, cancellation before claim, email failure and worker restart.
5. Confirm mobile Safari, mid-range Android Chrome, wallet signing, reduced-motion, WebGL-independent pages, merchant inventory/fulfillment UI, and payment recovery.
6. Keep real equity and lending disabled pending authorized integrations and a formal security/legal review.
