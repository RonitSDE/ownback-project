# OwnBack — project history

All release notes, changelogs, audits and submission notes, oldest first.

---

## v3 → v3.1

_Formerly `CHANGES_v3_to_v3.1.md`._

## Source change summary — v3 -> v3.1

1. `contracts/src/Ownback.sol`: payment requires nonzero order reference, positive minimum reward, bounded quote deadline; no rewardless downgrade.
2. `contracts/src/mocks/PricedMockStockAdapter.sol`: `setPrice(stock, price, sourceTimestamp)` and source-time age/monotonicity checks.
3. `contracts/src/mocks/MockB20Stock.sol`: now eight decimals; keeps 18dp multiplier.
4. `contracts/script/DeployTestnet.s.sol`: guarded to Anvil/Base Sepolia and timestamp-aware adapter initialization.
5. `contracts/test/Ownback.t.sol`: old success-with-no-reward cases switched to reverts; added replay, quote expiry, pause/budget races, stale source and multiplier precision tests.
6. `src/app/shop/page.tsx` & `src/lib/wallet.ts`: hashed random checkout reference, persisted hash, submission recovery, minimum reward and expiry, stale-source disabled checkout, updated stock units, more accurate mock-stock/collateral copy.
7. `src/lib/prices.ts`: `requireFreshObservation()` with deterministic unit tests.
8. `scripts/keeper.ts`: stateless onchain purchase reconciliation for all campaigns using configured mock stock, stale source validation; one confirmation on Anvil and two on Sepolia.
9. `scripts/e2e-local.mjs`: new ABI and negative paths, repeated keeper run, second campaign E2E, 8dp stock assertions.
10. `src/lib/abi/index.ts`: committed ABI matches changed checkout and adapter. Developer should regenerate after `forge build`: `npm run abi`.
11. `src/lib/engine.ts`: judge-demo stock base units now 8dp and mock pricing aligned to $200 reference used in local E2E.
12. Tests, preflight, CI guard, concurrency-limited keeper workflow, docs, and explicit deploy sign-off checklist.

The uploaded v3 remains unchanged. This release has only been **partially tested**; run the release checklist with Node/npm/Foundry on a networked machine. 13. `scripts/verify-local.sh` / `write-local-env.mjs`: reproducible local Anvil verification and generated frontend config; requires developer toolchain to execute.

---

## v3.1.1 patches

_Formerly `PATCHES_v3.1.1.md`._

## v3.1 -> v3.1.1 review patches

Applied on top of the v3.1 deployment candidate after running the full toolchain.

| #   | File                           | Fix                                                                             | Why                                                                                                                                                 |
| --- | ------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `contracts/test/Ownback.t.sol` | Renamed variable `promise` to `promised`                                        | `promise` is a reserved Solidity keyword. The suite did not compile.                                                                                |
| 2   | `src/app/shop/page.tsx`        | Captured `intent.hash` / `intent.deadline` before `try`                         | TS18047 null-narrowing error blocked `next build`.                                                                                                  |
| 3   | `src/app/shop/page.tsx`        | A pending or dropped payment intent is discarded once its quote deadline passes | Before: the customer was locked out of checkout for that amount on that browser. Safe because the contract rejects any `pay` after `quoteDeadline`. |
| 4   | `src/app/merchant/page.tsx`    | Pause copy now says OWNBACK checkout closes                                     | v3.1 reverts payments while paused. The old copy said "payments still go through".                                                                  |
| 5   | `SUBMISSION.md`                | Video beat 7 matches v3.1 behaviour                                             | A third order now reverts before charging, rather than earning nothing.                                                                             |
| 6   | `.github/workflows/ci.yml`     | Restored `format:check` (kept `release:preflight`)                              | It was replaced instead of fixing formatting.                                                                                                       |
| 7   | 13 files                       | Prettier                                                                        | Needed for `format:check`.                                                                                                                          |

Verified after patching: Foundry 35/35 (incl. 512-run fuzz), unit 22/22, TypeScript clean, Next production build OK,
Prettier clean, release preflight PASS, local-chain E2E all checks passed (deploy + real keeper + second campaign).

Not changed (team decisions, see review): `maxPriceAge` weekend window, price-gated checkout, revert-on-no-reward policy.

---

## v3.1 → v3.2

_Formerly `CHANGES_v3.1_to_v3.2.md`._

## v3.1 → v3.2

### Contracts

- **Explicit no-reward opt-in.** `pay` now reverts only when the live reward is below the floor the customer was
  shown. Passing `minRewardUsdc = 0` is an explicit "pay without a reward", so repeat customers, small orders and
  paused campaigns no longer lock people out of checkout. Silent downgrades remain impossible.
- **Per-payer order references.** `orderRefUsed[campaign][payer][ref]`. Previously anyone could burn another
  customer's pending reference with a dust payment and make their checkout revert.
- **`Ownable2Step`** on `Ownback` and the adapter.
- `refund` pulls from `msg.sender` (equal to the merchant) for clarity; `MaxPriceAgeSet` event; indexed admin
  events; documented zero-address keeper semantics.
- Testnet `maxPriceAge` 2 → **5 days** so weekends and US holidays don't stop settlement.
- Tests: 35 → **43** (griefing, opt-in, no-reward refund, two-step ownership, timestamp regression and future).

### Frontend

- Rebuilt into components and hooks: wallet and toast contexts, data hooks with visibility-aware polling,
  checkout hook over a pure, unit-tested intent state machine.
- **EIP-6963 wallet discovery** with a native `<dialog>` picker; silent reconnect; follows account and network
  changes; verifies chain and signer before every transaction.
- **Chain-time deadlines and countdowns.** v3.1 used the device clock, so any clock skew made payments revert as
  expired (found by the browser test).
- **Log scans bypass viem's block-number cache.** v3.1 could hide the newest orders and delivery links (found by
  the browser test).
- Checkout no longer blocked by price age; "Market closed · last NAV" status instead of "stale".
- Exact-amount approvals only; strict amount parsing; step-by-step payment progress; skeletons, empty states,
  error boundary, 404, skip link, focus styles, reduced-motion support, responsive two-column grid.
- Security headers: CSP, `X-Frame-Options: DENY`, HSTS, `nosniff`, referrer and permissions policies.

### Tooling

- ESLint (Next core-web-vitals + TypeScript) and Prettier enforced in CI.
- `npm run test:ui`: real Chromium with an injected EIP-6963 wallet sending genuine transactions; runs in CI with
  screenshots uploaded as artifacts.
- Slither static analysis; findings in SECURITY.md.

---

## v3.2 → v3.3

_Formerly `CHANGES_v3.2_to_v3.3.md`._

## v3.2 → v3.3

### Bankr integration (Agentic Stock Finance)

- **Real Bankr Agent API client** (`src/lib/bankr/client.ts`) built from Bankr's public docs: async
  `/agent/prompt` → `/agent/job/{id}` polling, synchronous `/wallet/submit`, `X-API-Key` auth, typed errors.
- **"Borrow against your reward" now has two paths**: your own wallet (always on) or your Bankr agent
  (one tap, when a key is configured). The stock does real work either way.
- Server-only key handling: `BANKR_API_KEY` never reaches the browser; `/api/agent/status` and
  `/api/agent/borrow` routes.
- `npm run bankr:check` verifies the client against the live Bankr API before a demo.
- 8 Bankr unit tests (job lifecycle, snake_case normalisation, auth/timeout errors, submit, prompts).
- Graceful degradation: no key → the Bankr button is hidden, the wallet path is unchanged.
- Docs: BANKR.md.

### Agent borrow security

- **Off by default.** The borrow action and route stay disabled until `BANKR_BORROW_ENABLED=true`.
- Per-IP rate limiting (5/min, 429 + Retry-After), a per-borrow USDC cap, 2 KB body limit, and strict
  pattern validation of symbol/collateral/amount before any prompt is built.
- Server-only key access; `no-store` on agent routes. 8 new security unit tests.

### Frontend polish

- **New landing hero**: product receipt visual (pay → earn stock → borrowable), visible nav buttons
  (the old dark-on-dark buttons were invisible), trust row, agent-native pillar. The dead hero gap is gone.
- Agent action styling; four-pillar value row; tightened section headings.

### Verified

- 43 Foundry tests, 50 unit tests, lint/types/format/build clean, full real-browser journey passes with
  zero console errors, agent status + health routes confirmed serving.

### Not verified here

- The live Bankr API (run `npm run bankr:check` with a real key) and the live Coinbase price API.
- Base Sepolia deployment; independent audit.

---

## Build audit

_Formerly `BUILD_AUDIT.md`._

## OWNBACK v3.3 build and verification audit (2026-11-06)

Every result below was executed in the build environment, not inferred.

| Check                                                             | Result                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Solidity compile (solc 0.8.24, via-IR)                            | PASS                                                       |
| Foundry suite                                                     | **43 passed, 0 failed** (incl. 512-run fuzz)               |
| Slither static analysis (102 detectors)                           | No medium or higher findings outstanding (see SECURITY.md) |
| Node unit tests                                                   | **34 passed, 0 failed**                                    |
| ESLint (next/core-web-vitals + typescript)                        | Clean                                                      |
| TypeScript `tsc --noEmit`                                         | Clean                                                      |
| Prettier                                                          | Clean                                                      |
| Next.js production build                                          | PASS (8 routes)                                            |
| Release preflight                                                 | PASS                                                       |
| Local-chain lifecycle (anvil + real keeper)                       | **15/15 checks passed**                                    |
| Real-browser wallet journey (Chromium + injected EIP-6963 wallet) | **8/8 steps passed, zero unexpected console errors**       |
| Served app: routes, 404, `/api/health`, security headers          | PASS                                                       |

Expected in the sandbox and tolerated by the browser test: Google Fonts and `/api/prices` were unreachable (no
outbound network).

### Not verified here

- Live Coinbase Tokenized Stocks API response (`npm run prices:check`)
- Live Bankr Agent API (`npm run bankr:check` with a real bk_ key)
- Base Sepolia deployment and contract verification
- Real wallet extensions (Coinbase Wallet, MetaMask, Rabby) by hand
- Independent security audit

---

## v3.4 release

_Formerly `RELEASE_V3_4.md`._

## OWNBACK v3.4 integrated release — developer handoff

This is a **Base Sepolia deployment candidate** rather than a certified mainnet protocol. It merges the previously separate single-merchant USDC commerce code with v3.3 reward checkout and replaces the unsafe Bankr shared-wallet loan endpoint with a customer-safe read-only educational research flow.

### Setup

1. Node >=22, npm, PostgreSQL 16, Foundry/Anvil. Configure `.env` from `.env.example`.
2. `npm install` (updates lockfile for the new `pg` dependency); commit generated `package-lock.json`, then `npm ci` on a clean checkout.
3. `docker compose -f docker-compose.commerce.yml up -d`, set `DATABASE_URL` to the local container on port **5433**, then `npm run commerce:migrate`.
4. Follow `DEPLOY.md` for Base Sepolia mock contracts; copy matching contract addresses, chain ID, campaign ID, and deployment block into commerce and Next.js variables.
5. `npm test && npm run test:commerce && npm run check && npm run build && npm run test:contracts && npm run verify:local`. All must pass before public deployment.
6. Start Next.js: `npm run dev`; `/` overview, `/commerce` real sample catalog, `/commerce/admin` pilot merchant, `/shop` reward wallet, `/protocol` evidence walk-through, `/demo` simulator.
7. Schedule authenticated `/api/commerce/admin/reconcile` with `COMMERCE_CRON_SECRET` and supervise indexer/keeper.
8. Configure a separate Bankr read-only API key; enable research only after confirming wallet permissions, Agent API credits, `/wallet/me` and a successful no-write prompt.

### Acceptance test

Paid real product with correct inventory; reload before receipt; retry duplicate tx; 3 confirmations; first and repeat reward contract events; malicious/wrong wallet or orderRef rejected; keeper settles mock stock; pause and refund; merchant fulfillment; Bankr job response appears without claiming a loan.

### Remaining blockers

No live contract deployment, independent audit, real stock-issuer permission, customer-specific Bankr authorization, card payments, generalized shipping/tax, bankr credentials or full CI build is supplied. The project is _not_ real-tokenized-equity or lending production ready. Some third-party behavior may change.

---

## v3.5 hybrid release

_Formerly `RELEASE_V3_5_HYBRID.md`._

## OWNBACK 3.5 — Hybrid Shopify + Base release notes

### Product decision

Keep OWNBACK's existing USDC-native commerce for crypto customers. Add a **single-store Shopify pilot** for mainstream card/Shop Pay customers. Both channels support the same **2% first purchase, 5% seven-day comeback** loyalty concept, but rely on **different proof and payout contracts**, clearly labeled by provenance. Neither channel enables real securities issuance, securities trading, or autonomous Bankr borrowing.

#### Main customer experience

- `/experience`: brand-new responsive hybrid landing, illustrated reward moments, shopper/merchant selector, Shopify vs Base channel comparison, demo receipt, merchant connection and channel-scoped analytics.
- `/commerce`: existing USDC-native catalog, cart, inventory reservation, checkout and refund pipeline preserved.
- `/claim`: one-time emailed Shopify claim; wallet message verification with _no USDC charge or approval_.
- `/shop`: existing wallet/rewards experience, native Base rewards.
- `/protocol`: existing source-evidence and Bankr research story, with no automated loans.

#### Technical integration

- Shopify app installation via standalone OAuth code grant, state cookie, callback HMAC, encrypted per-shop token. Merchant admin session required to initiate installation.
- Shopify `ORDERS_PAID`, `REFUNDS_CREATE`, `ORDERS_CANCELLED`, `APP_UNINSTALLED` webhooks; verification on raw HTTP bytes, deduplication by webhook ID and by shop+order, refund-before-order protection, guest email fallback hashed with a secret, USD-only eligibility.
- PostgreSQL integration schema, separate from native commerce orders; merchant dashboard never fabricates cross-channel deduplicated customers.
- Server-side live Shopify order verification at issuance and settlement (financial status, cancellations, refunds, USD amount, recipient email).
- Resend backed one-time link email (manually issued or automatic private worker), 7-day expiry and signed wallet binding.
- New isolated ShopifyRewardVault.sol, testnet-only (Anvil / Base Sepolia), merchant-funded USDC, max $10 reward, one initial and one seven-day comeback per pseudonymous customer, unique order hashes, approved executor, atomic synthetic-token delivery proof.
- Dedicated worker with receipt reconciliation and safe idempotent retry behavior. **Not a scale-ready distributed queue.**
- Existing Bankr APIs remain read-only and untouched.

#### Verification carried out in this artifact session

- 54 existing and new independent Node.js tests passed in the selected test suites.
- 11/11 new Shopify cryptography, pseudonymity, reward-rules and payout-gate tests passed.
- TypeScript/TSX syntax parsed (91 files) with the locally installed compiler; no syntax errors found.
- Existing release and commerce preflight scripts passed.
- Verified ZIP / integrity manifest during packaging.

#### NOT verified

- `npm ci` / Next.js production build / full TypeScript typecheck. npm registry DNS was unavailable; inherited lockfile omits `pg` and `@types/pg`. The first networked developer installation must bootstrap and commit a newly resolved lockfile.
- Forge contracts did not compile in this container (Foundry unavailable). New bridge contract requires a clean Forge compile and security review.
- New `/experience` inside Next.js not rendered in Chromium; this environment blocks local browser navigation. A separate _static, non-connected visual preview_ is included.
- No Shopify app credentials, email account, merchant store, database instance, Base Sepolia vault or Bankr key were connected. No real-world purchase or equity transfer is claimed.
- Price-based real-stock execution, KYC, and permissions for tokenized securities are deliberately disabled.

### Required launch gates

1. Run `npm run bootstrap:lock`, commit the regenerated lockfile, restore CI to strict `npm ci`, then run `npm run format && npm run format:check && npm run lint && npm run check && npm run build`.
2. Forge: `./contracts/install-deps.sh && npm run test:contracts`, local Anvil payments plus new ShopifyRewardVault test suite; verify addresses on Base Sepolia.
3. Configure Shopify OAuth/approved data access, HMAC webhooks, and secure SMTP/Resend key, then test a REAL paid order, one duplicate delivery, a refund-before-paid event and a post-payment refund.
4. Test first claim and comeback claim, actual mock stock receipt events on Base Sepolia, cancellation before claim, email failure and worker restart.
5. Confirm mobile Safari, mid-range Android Chrome, wallet signing, reduced-motion, WebGL-independent pages, merchant inventory/fulfillment UI, and payment recovery.
6. Keep real equity and lending disabled pending authorized integrations and a formal security/legal review.

---

## v3.5 build audit

_Formerly `BUILD_AUDIT_V3_5.md`._

## OWNBACK 3.5 — Reproducible Build Audit

**2026-11-10** · Hybrid Shopify + Base USDC commerce · Developer release candidate

### Independently run in this environment

- Source layout and ZIP inputs inspected from uploaded v3.4 artifact.
- 54/54 targeted Node.js business/security tests passed, including 11/11 new Shopify cryptography, identity, claim-rule and payout-gate tests.
- 91 TypeScript/TSX files passed **syntax transpilation**, but this is not a full dependency-aware `tsc --noEmit` typecheck.
- Existing `release-preflight` and `commerce-preflight` scripts passed.
- `SOURCE_MANIFEST.sha256` is generated from the final artifact files and verified before packaging. ZIP CRC integrity verified after packaging.
- Static UX preview is bundled; browser screenshots/tests could **not** be executed here because the browser blocks local file and localhost access. Preview is illustrative, not the running Next.js app.

### P0 remaining deployment gates

1. The old v3.4 lockfile omitted `pg` and `@types/pg`. We could not reach npm registry from this container. On a networked machine run `npm run bootstrap:lock`, commit the resolved lockfile, change CI back to `npm ci`, then verify `npm ci && npm run check && npm run build`.
2. Run `npm run format` and `npm run format:check` and resolve lint warnings before merging; Prettier was not available in this container.
3. `./contracts/install-deps.sh && npm run test:contracts` has not been run; Foundry unavailable. This includes the new ShopifyRewardVault and ShopifyTestnetAdapter tests.
4. Start PostgreSQL, apply `commerce/schema.sql` and `commerce/shopify.sql` via `npm run commerce:migrate`, test upgrade on snapshot, and verify no duplicate/refund issues.
5. Deploy/verify contracts on Base Sepolia. No live Base receipts were produced here.
6. Verify real Shopify OAuth installation, approved order/email scopes, webhook subscriptions, webhook-HMAC retries, confirmed order re-query, email issuance/redeem, wallet signature, automated claim worker and stock delivery with a real shop and test accounts.
7. Mobile Safari + Android Chrome touch, 44px targets, reduced motion, loading performance and accessibility QA on `/experience`, `/claim`, `/commerce`, `/commerce/admin`, `/shop`, `/protocol`.

### Security / scope caveats

- Shopify customer checkout is processed by Shopify; the Shopify reward vault **does not** charge the buyer. The merchant funds synthetic stock rewards in separate test USDC.
- All securities, portfolio execution and Bankr borrowing are disabled. Bankr read-only research is retained.
- Shopify pilot supports one allowlisted store and USD-only orders; no multi-merchant OAuth token rotation or public app marketplace submission is claimed.
- Merchant/consumer identities are hashed; anonymous shoppers without usable email or customer ID can't earn rewards. Real delivery depends on approved email access.
- The dedicated Shopify worker must be run singly and reconciles chain events; no distributed queue/KMS production deployment is claimed.
- Refunds after stock settlement are marked, not clawed back. Commercial merchant risk remains.

**Assessment:** a substantial integrated developer handoff and runnable source candidate, not a certified live production or securities platform.

---

## v3.6 build audit

_Formerly `BUILD_AUDIT_V3_6.md`._

## OWNBACK v3.6 — Source and integration audit

Audit date: November 10, 2026. Baseline: `OWNBACK-v3.5-Hybrid-Shopify-Base-Source.zip`.

### Delivered code

- `/agentic` consumer experience: responsive mobile-first UI with conversational search, verified live results, selected variants, cart summary, illustrative reward preview, buyer-controlled checkout handoff and unambiguous preview/live states.
- UCP JSON-RPC adapter uses Shopify 2026-08-25 `search_catalog`, `lookup_catalog`, `create_cart` interface and `result.structuredContent`, with hosted agent profile.
- API: merchant discovery uses only installed Shopify merchants; UCP calls use fixed merchant origins, URL allowlists, strict variant IDs, resource caps and timeout/redirect protection.
- Source web2/web3 stack preserved: Shopify connect/HMAC webhooks and refund holds, USDC native checkout, merchant rewards, customer claim, Bankr read-only research.
- Source manifest and CI strict `npm ci` (CI no longer mutates the lockfile before installing).

### Verification performed in this environment

- 11/11 agentic unit/integration tests PASS (mocked Shopify UCP; no merchant was contacted).
- 72/72 selected tests PASS (existing backend/business logic and agentic tests combined).
- `npm run release:preflight` PASS.
- `npm run commerce:preflight` PASS.
- `npm run agentic:preflight` PASS.
- All new TypeScript/TSX files parsed with TypeScript parser: zero syntax errors.
- Standalone HTML UX preview has JavaScript syntax verified by Node; **not** a live Next.js rendering.
- Source manifest checked with `scripts/verify-manifest.mjs` after source freeze.

### Not verified / blockers

- `npm ci` remains unverified because npm package registry is unavailable here. The **inherited** lockfile lacks `pg`/`@types/pg`, which causes a clean install failure until `npm install --package-lock-only` is run and committed on a network-connected machine.
- `npm run check` fails with missing dependencies/types. It cannot serve as an app typecheck until installation finishes; do not infer product errors from these missing modules or mark the check passed.
- Next.js production build, Playwright device testing, Foundry compilation and testnet deployments were not executed in this environment.
- No live Shopify UCP connected store, paid-order webhook, customer claim delivery, tokenized-stock execution or Bankr credential was available to verify remotely.
- In-process API rate limits are single-instance only; use distributed rate limiting/WAF prior to public traffic.
- The Shopify Cart MCP endpoint may live on a merchant's custom storefront domain, which must be explicitly approved in environment variables.

### Release decision

**Agentic UI and UCP adapter source candidate; staging validation required.** Do not advertise real tokenized stock ownership or customer-controlled Bankr borrowing. Synthetic testnet stock and research-only Bankr stay correctly labelled.

---

## v3.6.1 audit and handoff

_Formerly `V3_6_1_AUDIT_AND_HANDOFF.md`._

## OWNBACK v3.6.1 — source audit, functional fixes and developer handoff

**Baseline:** User-provided v3.6 source archive. **Review date:** November 10, 2026.

### What was actually fixed

1. **Native USDC order reconciliation:** `orderRefUsed(campaignId, payer, orderRef)` requires three arguments, but the inherited commerce helper passed only two. It now checks the right customer's order reference. Previously, that check could not execute as intended and reconciliation could fail, jeopardizing safe expiry handling.
2. **Real Shopify product imagery:** The production Content-Security-Policy blocked all remote HTTPS product images. `img-src` now permits HTTPS catalog images. Product images explicitly use `referrerPolicy="no-referrer"`; active HTML content remains disallowed as imagery.
3. **Checkout consistency when merchants change:** Changing the selected store now clears search results, selected variants, previous cart, and any old merchant handoff URL. Invalidated search/cart requests cannot reinstate stale offers or checkout links. Cart modification also cancels a pending handoff state.
4. **Connected wallet used consistently for reward claims:** Claim signatures use OWNBACK's selected connected EIP-1193 provider, verify network/account continuity, and no longer silently fall back to a different extension's `window.ethereum` provider.
5. **Fail-closed catalog validation:** Shopify UCP variants without an explicit `availability.available===true` are not purchasable; missing, null, boolean or whitespace prices are rejected rather than displayed as accidental zero-dollar products.
6. **Merchant reward readiness:** A store must be installed, active, and webhook-ready before shoppers can discover it in the participating merchant directory. The frontend also respects whether a public UCP profile has been configured.
7. **Source-integrity coverage:** The source manifest verifier now checks for unlisted source files and duplicate paths as well as changed/missing files.
8. **Typed webhook payload / UCP parser:** Replaced loose `any` definitions in the touched modules with explicit or unknown-safe types. Existing security controls for Shopify webhook signature verification, refund holds, and mock-token delivery are preserved.

### What has NOT been changed

- No real securities issuance, live stock transfers or live collateralized borrowing were enabled. Bankr remains read-only; POST /api/agent/borrow remains HTTP 403.
- Shopify card, shipping and tax flows stay on the merchant's checkout. OWNBACK does **not** charge card shoppers again.
- USDC native checkout, synthetic Base Sepolia Shopify reward vault, merchant funding, refund holds and signed claim flow remain in the source.
- **Customer hashing was deliberately NOT migrated.** V3.6 prefers normalized email when present, otherwise Shopify customer ID. Changing to customer-ID-first without reconciling existing hash histories would break return-purchase loyalty continuity. Design and test that migration separately before any real-data rollout.

### Verification performed in this session

- User ZIP safely extracted; original source manifest verified **185/185**.
- Shopify UCP agentic tests passed; Shopify hybrid security tests passed; additional regression tests passed.
- Dependency-independent unit suite passed (excluding `tests/frontend-logic.test.mjs`, which imports the unavailable `viem` dependency). The precise final total is in the command log; do not treat this as a full `npm test` pass.
- TypeScript **syntax parsing** completed across 97 TS/TSX source files with zero parse errors. This is NOT a semantic TypeScript typecheck.
- Release and commerce source preflight scripts passed.

### Environment and launch blockers

- The **original lockfile does not contain the `pg` and `@types/pg` package lock entries** needed for a clean `npm ci`; attempts to fetch them from npm failed because `registry.npmjs.org` was unavailable in this environment. Do NOT claim clean install or production build success. On a networked developer machine, regenerate the lockfile, commit it and run `npm ci` from scratch.
- Full ESLint, Prettier, TypeScript semantic checking, Next.js production build, Foundry compilation/test, Playwright device tests and deployed Base Sepolia integration were not run here. The CI `format:check` gate must also be verified with the complete dependency install. If reformatting changes source files, regenerate the manifest **after** formatting.
- No active Shopify test merchant, published HTTPS UCP profile, real signed paid-order/refund webhook, SMTP, Base Sepolia deployment credentials, or live Bankr key were supplied. The purchase-to-claim journey is NOT proven in production or staging.
- The API's per-process rate limiter depends on trusted proxy headers; add a distributed limiter and WAF before real users.

### Competition readiness: required demonstration

1. Install a pilot Shopify store and verify all order/refund webhooks are actually registered; publish OWNBACK's HTTPS UCP agent profile.
2. In **live mode**: real catalog search → select an explicitly available variant → merchant cart → merchant checkout. Show product images and verified source pricing.
3. Complete a Shopify test payment; verify the HMAC order event, deferred reward, a customer wallet-claim signature and a **real Base Sepolia mock-token delivery transaction receipt**.
4. Repeat a purchase for the same pseudonymous customer inside seven days and verify a higher eligible reward once. Demonstrate cancelled/refunded/duplicate orders do not pay.
5. Independently demonstrate native USDC checkout, wallet payment proof, inventory update and merchant analytics. Show Bankr as research only.
6. Obtain screenshots/receipts plus a **clean green CI** run after correcting the dependency lockfile. Keep promotional language explicit: synthetic stock testnet, not legally held equity.

**Release recommendation:** Use as a **v3.6.1 audit/fix candidate**, not as a production-ready release. Design and product direction are strong; launch eligibility still depends on real integration evidence.

---

## v3.6.2 recovery release

_Formerly `OWNBACK_V3_6_2_RECOVERY_RELEASE.md`._

## OWNBACK v3.6.2 — Simulation-driven recovery hardening

### What changed

**Claim email outbox** (`commerce/shopify.sql`, `src/lib/shopify/claim-outbox.ts`, `scripts/shopify-claims.ts`, admin claim route):

- The reward order's redeemable token digest and an encrypted, durable email intent commit in **one PostgreSQL transaction**, before Resend is contacted. The outbox stores encrypted email and token and reuses a fixed provider idempotency key across retries.
- Dispatcher uses an atomic lease (2 minutes), rechecks the Shopify paid state/refunds, and sends only afterward. Worker retries use the original token, not a new link.
- Merchant-triggered claims queue emails; they no longer make external HTTP requests inside the request handler.
- Refund webhooks cancel unsent intents and invalidate existing claim links. No live securities are delivered.

**Settlement reconciliation** (`scripts/shopify-settle.ts`):

- On restart, reads the vault's `paidOrder` flag and validates `RewardDelivered` receipt/event for **SETTLING**, a refunded in-flight order, and even a previously CLAIMED order before an attempt.
- An ambiguous submission no longer resets SETTLING to CLAIMED, even when the database lost the transaction hash. A reverted receipt requires manual operator review.
- Validates the emitted customer hash, recipient wallet, positive amounts, vault address, success receipt and exact order hash before declaring delivery.

### Reproduction

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

### Known limits / pilot blockers

1. `package-lock.json` inherited from v3.6.1 still lacks `pg` and `@types/pg`, and a clean npm install requires regenerating the lockfile on a network-enabled machine. Run `npm install --package-lock-only --no-audit --no-fund`, commit it, and verify with `npm ci` on a clean machine. The source manifest must then be regenerated.
2. The test environment has **no live Shopify store, PostgreSQL, Resend, Base Sepolia RPC/contract or Bankr credentials**, so no externally verified end-to-end transaction is claimed. Foundry and Next production build are unverified here.
3. Resend's documented idempotency window is 24 hours. The dispatcher halts automatic retries for previously attempted emails after 20 hours and requests manual review. The outbox prevents unusable links after a post-send DB crash, but **cannot guarantee exactly-once email delivery indefinitely**. Any provider retry must reuse an identical payload, so keep `APP_ORIGIN`, sender, and email template stable during that window.
4. Refund between final Shopify verification and broadcast is possible without an onchain refund oracle; the current contract is testnet-only and the hold/reverification controls reduce but do not eliminate the race. For real funds, define a settlement finality and refund liability policy.
5. A submitted tx with missing hash and no delivery receipt stays SETTLING for **manual recovery**, rather than risking a duplicate. This is deliberately conservative and may leave an order pending if the worker crashes before broadcasting. Operator tooling/nonce tracking is the next reliability enhancement.
6. Stock assets remain synthetic Sepolia tokens, not actual equity. Bankr supports read-only analysis, not customer borrowing.

### Deployment order

1. Run database migration before enabling claim workers or Shopify webhooks.
2. Configure required env vars (`DATABASE_URL`, `SHOPIFY_TOKEN_ENCRYPTION_KEY`, Shopify OAuth/admin/HMAC secrets, Resend keys, `APP_ORIGIN`, Base Sepolia executor and vault address). Never expose these to frontend.
3. Enable `SHOPIFY_AUTO_EMAIL_CLAIMS=true` on the **private** claim worker; start exactly one settlement worker for the testnet vault.
4. Validate first and comeback orders, expired claim, refund-before-email, crashed email worker, refund-mid-flight, underfunded vault, pending/reverted tx, and successful event-backed settlement against actual staging systems.
5. Produce authenticated Base Sepolia explorer receipts before any public claims of onchain payout or full production-readiness.

---

## v3.7 release

_Formerly `OWNBACK_V3_7_RELEASE.md`._

## OWNBACK v3.7 — The Ownership Retention Protocol

### The product decision

This release deliberately **adds depth to the merchant-retention wedge instead of extending the surface area**. Existing Shopify authenticated webhook rewards, UCP Catalog/Cart checkout handoff, native Base USDC checkout, claim outbox, settlement recovery, and Bankr read-only research remain intact.

#### New live code

1. **Balanced premium UI**: rebuilt `/` landing, `/growth`, `/ownership`, and `/protocol` using warm-off-white, charcoal, pale sage and selective Base blue. Five local, self-contained illustrative product visuals in `public/visuals`. The previous agentic and hybrid experience pages have matching neutral/blue styles, with their real flows preserved.
2. **Merchant Growth Studio (`/growth`)**: interactive, pure deterministic economics model with 4 editable category Loop presets. Inputs are assumed average order value, gross margin, customer count, first and comeback rewards, treatment and control repeat rates. Calculates incremental repeat revenue, gross contribution, total incentive cost, net campaign contribution, cost per incremental returning customer, and mathematical break-even rate. **Inputs do not modify onchain campaign terms**.
3. **Authenticated observed Proof of Retention** (`GET /api/retention/overview`): Shopify and native commerce verified purchase counts, distinct channel-specific buyers, observed returners, gross settled sales and Shopify finality/refund aggregates. Returns `experimentalLift:null` until a genuine pre-exposure assigned control exists. Denies unauthenticated access and never substitutes fabricated metrics.
4. **Simple shopper Ownership Portfolio (`/ownership`)**: reads native Sepolia positions and purchases directly from current contracts; a time-limited read-only wallet signature unlocks claimed Shopify orders using `POST /api/retention/portfolio`. A public wallet address alone does not expose Shopify order history. Displays reserved, eligible, settling, delivered, reversed and **refund-after-delivery liability** distinctly. No pending claims are counted as delivered stock.
5. **Updated protocol story**: payment proof, reserved funds, refund-aware eligibility and confirmed delivery; late refunds create a merchant liability rather than magically reversing a transferred token. B20 real equity remains a **proposed integration subject to compliance and partner approval**, not a feature claimed live.
6. **Standalone offline UX preview**: `public/preview/v3.7.html` and separate `OWNBACK_v3.7_Balanced_Interactive_Experience.html`. Explicit demo controls for first purchase, comeback, refund, and four settlement stages. **No real payment or blockchain requests in preview**.

#### Not implemented / not proven

- Real B20 issuance, stock transfer, voting or economic rights, or corporate actions; synthetic stock rewards on Base Sepolia only.
- A causal measured retention-lift study; correctly assigned buyer holdout requires pre-exposure treatment assignments and merchant consent. Slider inputs are not measured proof.
- Co-funded brand campaigns, cross-merchant onchain passport, real lending or autonomous Bankr trades.
- Clean `npm ci`, `next build`, typecheck or Foundry recompilation on this offline machine. The inherited lockfile omits `pg` and `@types/pg` and this environment cannot reach npm registry. **Must regenerate and verify lockfile on a network-enabled machine.**
- Real Shopify staging credentials, a connected pilot merchant, database/Resend, authenticated B20 provider or public Sepolia receipts. Existing E2E logic was simulated in v3.6.2; this release is not a verified live deployment.

#### Deployment gates

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

#### Judge demo

Show: shopper discovers merchant item → merchant Shopify checkout handoff → signed paid-order verification → reward hold → customer claim → confirmed Sepolia synthetic-stock delivery → a second eligible purchase → merchant observed return and economics screen. Distinguish actual evidence from preview simulations. A control comparison is only meaningful with valid assigned holdout data and adequate follow-up.

---

## Release integrity

_Formerly `RELEASE_INTEGRITY.md`._

## Package status and audit

Base: user-provided `OWNBACK-v3_3-final.zip`. Commerce backend: prior OWNBACK V4 Commerce source merged into v3.3 rather than replacing reward contracts.

Implemented: merged `/commerce` and `/commerce/admin` plus `/api/commerce/*`, Postgres SQL and reconciliation, updated Bankr `/wallet/me`, new allowlisted read-only `/api/agent/research` with expiring HMAC job retrieval, permanently disabled shared-key `/api/agent/borrow`, corrected public copy, authenticated observed-retention analytics, and new `/protocol` showcase.

**Important:** the source dependency lock is inherited from v3.3 and does NOT yet include the merged `pg` dependency. This environment cannot access the npm registry. The first step on a networked developer machine is `npm install --package-lock-only` and commit the regenerated package-lock before running `npm ci`. The package is NOT clean-install verified until then.

No live Bankr account, external model credits, PostgreSQL service, full Next.js production compilation, real chain receipt, or Solidity tests were run in this session. Do not treat absence of errors in source review as validation of these services.

Bankr's Agent API reports completed jobs in `response` and `richData`; job completion is not onchain execution. The public write path remains blocked.

---

## Winning protocol notes

_Formerly `WINNING_PROTOCOL.md`._

## OWNBACK 3.4 — Proof-of-Retention + Bankr Research

### Product story

Verified USDC purchase on Base → bounded merchant-funded comeback incentive → recorded mock stock delivery on Sepolia → opt-in read-only Bankr research about eligible collateral markets. **No real securities or customer loan execution** are claimed.

### What is actually integrated

- `/commerce` catalog/cart, server-side reserve, USDC payment against order-bound reference, receipt-based confirmation, merchant fulfillment and refunds. Source merged from commerce V4.
- `Ownback` Solidity checkout with minimum reward, expiry and unique orderRef, mock 8-decimal stock settlement and local-chain suite.
- `/api/agent/research` submits **read-only educational** Bankr prompt and returns a scoped expiring job receipt. Polling never confuses a completed model response with confirmed debt. API key is operator-scoped and must be **read-only**.
- `/api/agent/borrow` always returns 403; no public write access to operator Bankr wallet.

### Main competition proof

1. Merchant creates and funds a campaign (Base Sepolia).
2. Merchant configures a real product and inventory in `/commerce/admin`.
3. Customer signs wallet checkout, order reference and purchase tx.
4. Server confirms onchain amount, customer, campaign, vault and reference (3 confirmations), decrements inventory transactionally.
5. Customer returns in window, earns configured bonus; one orderRef cannot pay twice.
6. Keeper settles mock stock after hold; display contract/event proof.
7. Bankr analyzes market and risks, **but does not execute borrowing**.
8. Demonstrate intentional failures: duplicate order, insufficient budget, refund, paused campaign, stale quote, wrong receipt wallet.

### Bankr partnership next steps

For real user-authorized lending: Bankr partner provisioning with **customer-specific** accounts/keys or wallet-signed actions; clear jurisdiction eligibility; verified allowed token + lending market; enforce collateral market LTV directly and simulate health/liquidation; transaction receipt + debt-position confirmation; debt/interest UX. No borrowing through shared server API key.

### Readiness gates

1. `npm install --package-lock-only` to regenerate lockfile for added PostgreSQL dependency; then `npm ci`.
2. `docker compose -f docker-compose.commerce.yml up -d`, `npm run commerce:migrate`, configure single merchant.
3. `npm test`, `npm run check`, `npm run build`, `npm run test:contracts`, `npm run verify:local`, `npm run test:commerce`.
4. On Sepolia, verify real browser USDC test payment, customer reward reservation and keeper mock-token delivery with BaseScan receipts.
5. Real Bankr key: read-only scoped; run `npm run bankr:check -- --ask` and one analysis job; ensure no trade permission.
6. Sign off shipping/tax/compliance externally before selling physical goods or real securities.

### Constraints

This is a **testnet pilot**. Does not claim live tokenized equity, approved market collateral, a Bankr lending position, mainnet readiness or Shopify integration. The commerce pilot supports pickup/manual digital fulfillment, not complete taxation or shipping.

### Proof of Retention dashboard

`/commerce/admin` presents paid-order volume, distinct customer wallets, repeat wallets and **observed** repeat rate from non-refunded paid orders. It is deliberately not called causal uplift. Future merchant pilots should add randomized holdout cohorts and margin-aware reward cost analysis.

---

## Hackathon submission

_Formerly `SUBMISSION.md` (v3.10.2 version)._

## OWNBACK — canonical Base Stocks Maxxing submission (v3.10)

**Competition:** Base Stocks Maxxing · **Track:** Agentic Stock Finance · **Deadline:** December 5, 2026 (verify official application timezone).

**Current disclosure (first 10 seconds):** **BASE SEPOLIA / MOCK STOCK; MAINNET CANDIDATE — NOT DEPLOYED.** The one-click agent preview is offline/deterministic; real campaign/payment transaction evidence is **not attached to this release**. We do not claim stock ownership, issued equity, trading or live merchant traction.

## Pitch

> OWNBACK gives merchants a measurable way to reward a second purchase with stock-linked incentives on Base. Its bounded agent proposes only what the configured reward vault can pay and refuses unsupported allocations. Customers never confuse preference with a trade; merchants see observed repeat purchases and reward costs, not invented retention lift.

## One hero path, 90 seconds

| Time   | One-screen action                                                                                | Honest statement                                                                                                        | Required proof                                      |
| ------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 0–10s  | OWNBACK homepage and status strip                                                                | A single-token vault lane, Sepolia mock; not a live stock platform                                                      | Chain label in frame                                |
| 10–30s | One native Base USDC campaign: 2% first, 5% comeback, strict cap and orderRef; Paid → Hold       | Campaign terms and checkout receipts are only real if their contract and tx are shown                                   | Campaign fund tx, paid orderRef tx                  |
| 30–50s | `/allocation`: supported brief → proposal; then robotics / 50% cap / exclude stock → hard refuse | Deterministic policy, source references; NOT_EXECUTED                                                                   | Local policy demo or real backend response, labeled |
| 50–65s | Optional signed preference, then identical nonce replay returning 409                            | Preference only — cannot trade or claim; no wallet spending approval                                                    | Two distinct API logs/screenshots, actual 409       |
| 65–85s | `/growth`: onchain USDC spent/available, paid customers and 7/30-day observed returners          | Observed wallet repeats, not causal lift; empty if no data                                                              | Explorer receipts matching wallet and campaign      |
| 85–90s | Close                                                                                            | “A bounded agent proposes only what the vault can pay. Merchants see who came back.” Real B20 settlement is gated next. | No unverified claims                                |

**Video must be postponed or shortened if proof is unavailable; never record synthetic balances as real metrics.** If a demo is local Anvil only, state **ANVIL ONLY** in the first ten seconds and on all evidence frames.

## Reviewer links (working application only after install/deployment)

`/` → `/judge` → `/growth` → `/allocation` → `/judge#proofs`.

Optional Shopify and Bankr research are under “Also in source.” Borrow/Morpho, multi-stock portfolio trades, x402 earnings and unverified Bankr results are excluded from this submission.

## Evidence completeness — release currently 0/4

- [ ] Fund campaign: transaction hash, exact chain, event, explorer link or Anvil log.
- [ ] Customer pay: transaction hash with unique `orderRef` and exact campaign/recipient.
- [ ] Settle: delivered event & recipient balance; refusal on overspend or duplication recorded with exact revert reason.
- [ ] Preference: signed message with exact nonce and first 2xx record, replay same nonce returning HTTP 409.

Evidence must be written into `evidence/proofs.json`, with real receipt or logs under `evidence/receipts` or `evidence/logs`. `npm run verify:proofs:strict` checks the local record's _structure_, not actual public chain history; the reviewers must verify explorer receipts independently.

## Actual deployment state

Not deployed to Base mainnet. Pilot source has single-token vaults and unreviewed eligibility conditions. A signed preference does not alter settlement assets. Mainnet B20 delivery, audited contracts, legal permissions, approved wallet recipients and issuer-compliant settlement remain separately gated.

**Build status:** local policy tests run; `npm install --package-lock-only --offline` rebuilt lock structure, but `npm ci` and the Next production build have not passed due to npm registry DNS failures here. CI gate is defined, **not green**. A tagged git SHA is required before submitting.

---

## Stocks Maxxing submission

_Formerly `STOCKS_MAXXING_SUBMISSION.md`._

## Stocks Maxxing — canonical v3.10 submission pointer

**Single track: Agentic Stock Finance.** Use [`SUBMISSION.md`](SUBMISSION.md) exclusively for the narrative, demo steps, launch status, proof register and missing blockers. Previous loan, multi-stock and agent revenue language is historical and excluded from the v3.10 submission. No mainnet deployment, proven retention lift or live security ownership is claimed.

---

## v3.9 release

_Formerly `OWNBACK_V3_9_RELEASE.md`._

## OWNBACK v3.9 — Base Stocks Maxxing · Agentic Stock Finance

**Handoff date:** November 12, 2026  
**Status:** Updated full-source candidate, **NOT** a deployed, audited or functional live-mainnet service.  
**Primary track:** Agentic Stock Finance. **This is not a multi-stock investment portfolio product yet.**

## Release changes (actual source, not concept mockups)

1. `/allocation`: interactive customer stock-reward Allocation Studio with theme, exclusions, preferred B20 token, illustrative reward size, concentration ceiling and desired cash reserve.
2. **Refusal-first policy** (`src/lib/allocation/policy.ts`): narrow allowlist of AAPLc/NVDAc; supports just one configured vault token. Explicitly refuses unavailable themes (robotics/energy), token exclusions, incompatible stocks, cash-reserve instructions and weight caps below 100%. No fake multi-asset execution.
3. **Explainability:** architecture facts, editorial assumptions, risks, relevant primary Base documentation, explicit NOT_EXECUTED state. No firm stock price, claimed inventory, live trade or eligibility proof is fabricated.
4. **Bankr research optional** (`/api/allocation/research`): read-only constrained prompt, rate limiting and HMAC-gated job polling. Unverified AI output never drives financial execution. No Bankr key means the research button returns a clearly described unavailable state.
5. **Wallet-signed preference receipt** (`/api/allocation/approve`): exact policy preferences, wallet address, origin, chain ID, random nonce and five-minute expiry are signed and verified server-side. Recompute policies on server; store the checked wallet signature and one-time intent privately in Postgres with replay guard. The receipt grants **zero authority to trade, transfer, borrow, claim or spend funds**. Feature off until operator enables it.
6. **Merchant Proof of Retention:** merchant-authenticated `/api/retention/cohorts` shows shop-separated first/repeat purchase revenue, return customers and 7/30-day repeat activity from eligible, non-refunded Shopify records. It does **not** assert incremental lift; recent cohorts are not mature.
7. **Bounded Retention Agent:** interactive deterministic merchant campaign recommendation based on hypothetical budgets and gross margin. Refuses unfunded scenarios or reduces proposed cashback within specified caps. Merchant must separately approve/execute real contract changes.
8. **Single submission story:** `SUBMISSION.md` + `STOCKS_MAXXING_SUBMISSION.md` replace the contradictory older Programmable Stock Markets narrative. v3.8 Base mainnet vaults/adapters remain intact, unchanged by this release.
9. Added new allocation-policy, approval-security, and merchant-retention tests; source manifest covers all new files.

## Start the web app on an internet-connected development machine

```sh
# From the ZIP root. Node 22.16+, npm 10, full registry access required.
npm install --package-lock-only --no-audit --no-fund
npm ci
cp .env.example .env
# Configure APP_ORIGIN exactly (e.g. http://localhost:3000)
# Configure OWNBACK_PILOT_SETTLEMENT_STOCK=AAPLc ONLY when your configured
# reward vault actually settles AAPLc. This controls proposal matching,
# NOT whether there is inventory, KYC or executable market liquidity.
npm run test:allocation
npm run test:retention
npm run test:mainnet
npm run check
npm run build
npm run dev
# Open /allocation and /growth.
```

**Important:** the inherited npm lockfile is still incomplete (`pg`, `@types/pg`) in this handoff because the npm registry could not be resolved in the execution environment. Regenerate it, commit it, and repeat `npm ci`/build/tests on CI. Do not bypass this gate.

## To test persistent wallet-signed _preference_ receipts

```sh
# Only in staging; requires real Postgres and an exact application origin.
npm run commerce:migrate
# Configure in .env:
# APP_ORIGIN=http://localhost:3000
# DATABASE_URL=postgresql://...
# NEXT_PUBLIC_CHAIN_ID=84532
# OWNBACK_PILOT_SETTLEMENT_STOCK=AAPLc
# OWNBACK_PREFERENCE_RECEIPTS_ENABLED=true
npm run dev
```

Connect a wallet on the correct chain; propose an allowed one-token allocation; check consent; sign EIP-191 message. A receipt ID and SHA-256 digest confirm the **preference entry only**. Replay of the same `(wallet, nonce)` must return HTTP 409. Try changing the preference, chain, origin, wallet, expiry or signature and confirm rejection. The application does not read actual investment suitability, funded rewards or ownership from this receipt.

### Production safety / architecture boundary

- Mainnet token and oracle addresses in the original v3.8 adapter require issuer and security review. A Chainlink total-return price is reference data, not a firm execution quote. Actual rewards require independently screened recipients, merchant escrowed USDC, separately prefunded B20 inventory, refund holds, confirmed onchain balance delta and real receipts.
- A customer's preferred stock **cannot** redirect an immutable single-stock reward vault. A multi-asset portfolio requires new reviewed contract lanes, real liquidity/settlement, explicit customer authorization and separate tests. In v3.9, an incompatible preference always refuses.
- Persistent preferences are _not yet connected_ to a stock-delivery executor; that connection must not be advertised as built. This source does not implement x402 agent revenue, stock-backed credit or multi-stock rebalancing. Borrowing remains research-only.
- Live signed Shopify orders are not present in the handoff. A storefront preview may demonstrate UX but is **not** evidence of a customer conversion or retention result.
- The authentication is a shared merchant admin cookie rather than per-store IAM; migrate to strict shop-level access control before multi-merchant production.

## What to validate on CI, Anvil and Base

1. `npm ci`, `npm run check`, `npm run lint`, `npm run build`, `npm run test:allocation`, `npm test`, `npm run test:mainnet`, `npm run simulate:recovery`.
2. `cd contracts && forge test`; run `npm run e2e:local` with Anvil + deployed mock contracts; verify browser flows on actual app. Neither Foundry nor dependencies were available in this environment.
3. Verify secure Postgres approvals: unauthorized origin, invalid chain, expired signature, replayed nonce, wrong signer, modified concentration limit, blocked theme. Verify shop-scoped privacy before any multi-store use.
4. Test a real staging Shopify checkout/refund/claim and first/comeback cohort; compare SQL aggregates to source orders. Do not call a model projection empirical uplift.
5. Only after contract audit/legal eligibility and independent production ops sign-off, consider a funded Base-mainnet canary as described in `BASE_MAINNET_LAUNCH.md`.

## Public demonstration sequence (truthful)

**Brief → constrained proposal → impossible constraint refusal → read-only Bankr analysis (if configured) → user preference signature → separate merchant funding/reward finality evidence → merchant observed return rate.**

Publish actual wallet, order and transaction proof only when it exists. Label local-chain and scenario data conspicuously.

---

## v3.9 validation

_Formerly `OWNBACK_V3_9_VALIDATION.md`._

## OWNBACK v3.9 — What actually passed

**Checked:** 2026-11-12  
**Status:** source-update validation, **not** a verified deployed product.

| Check executed                                                                         | Result                      | Evidence / limits                                                                                                                                    |
| -------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| New allocation policy + security + merchant retention tests                            | **PASS 16/16**              | `npm run test:allocation`; deterministic unit and static security checks, not wallet integration                                                     |
| Retention economics + merchant agent tests                                             | **PASS 15/15**              | `npm run test:retention`                                                                                                                             |
| Base mainnet static guard tests                                                        | **PASS 7/7**                | `npm run test:mainnet`                                                                                                                               |
| Shopify recovery unit tests                                                            | **PASS 6/6**                | `npm run test:recovery`                                                                                                                              |
| Hybrid Shopify security tests                                                          | **PASS 11/11**              | `npm run test:hybrid`                                                                                                                                |
| All JS test modules                                                                    | **119 pass / 120 reported** | One test module could not import `viem` (`tests/frontend-logic.test.mjs`) because `node_modules` could not be installed; **not a passed full suite** |
| Shopify fault-injection simulation                                                     | **PASS 17 assertions**      | `npm run simulate:recovery`; simulated email, database, chain and broadcast reconciliation, NOT actual Base transactions                             |
| Legacy offline release preflight                                                       | **PASS**                    | `node scripts/release-preflight.mjs`                                                                                                                 |
| Commerce and agentic preflight                                                         | **PASS**                    | `npm run commerce:preflight` and `npm run agentic:preflight`; structural, not full live integrations                                                 |
| Mainnet static preflight                                                               | **PASS**                    | `npm run mainnet:static`, not live RPC                                                                                                               |
| TypeScript/TSX parsing of 9 edited/new application files                               | **PASS**                    | Global TypeScript `transpileModule` diagnostics only; does not verify types or imports                                                               |
| Source integrity                                                                       | **PASS**                    | SHA-256 source manifest regenerated and verified after all source edits                                                                              |
| npm registry install                                                                   | **BLOCKED**                 | DNS `EAI_AGAIN`; inherited `package-lock.json` lacks package resolution for `pg` and `@types/pg`                                                     |
| Full TypeScript check, lint, formatting check, Next.js production build, browser tests | **NOT RUN / NOT VERIFIED**  | Dependency install unavailable; must run on connected CI machine                                                                                     |
| Foundry compile/test & full local contract E2E                                         | **NOT RUN / NOT VERIFIED**  | `forge`/`anvil` absent                                                                                                                               |
| Database migration and signed live-wallet roundtrip                                    | **NOT RUN / NOT VERIFIED**  | No Postgres instance, test wallet or app server                                                                                                      |
| Bankr research live API request                                                        | **NOT RUN / NOT VERIFIED**  | No Bankr key, job receipt or network connection                                                                                                      |
| Mainnet USDC/B20 fulfillment                                                           | **NOT RUN / NOT VERIFIED**  | No audited deployment, funded real vault, B20 inventory or real transaction receipts                                                                 |

### Important interpretations

- The `/allocation` route is real TSX and the API handlers are included. The verified tests are unit/static source tests, **not** a successful running Next.js browser session.
- The policy returns **refused** when `OWNBACK_PILOT_SETTLEMENT_STOCK` is unset; it never silently substitutes a token. Setting that flag is not an inventory, listing or eligibility verification.
- A saved preference is not a reward claim or trade; its signature is specific to wallet, origin, chain, max illustrative amount, exact constraints, expiry and nonce. Persistent receipt storage is off by default.
- Existing merchant checkout and vault contracts remain a mainnet **candidate**; v3.9 does not solve stock liquidity, security review, legal eligibility, multi-stock execution or delivery funding.
- Shopify cohort metrics are descriptive within each merchant. New customers without a complete return window can depress observed rates; a pre-exposure controlled experiment is required before stating impact.

**Production handoff gate:** On a networked machine, refresh lockfile; run clean `npm ci`, full `npm test`, `npm run check`, `npm run lint`, `npm run format:check`, `npm run build`, Foundry tests, Postgres migration, browser/wallet/Shopify/Bankr integration tests, a live-chain read-only preflight, security review and a controlled funded canary. Do not enable mainnet payments until all are independently verified.

---

## Base mainnet run report

_Formerly `BASE_MAINNET_RUN_REPORT.md`._

> **Latest v3.9 update:** See `OWNBACK_V3_9_RELEASE.md` and `OWNBACK_V3_9_VALIDATION.md` for current source changes, unit tests and blockers. This document remains the historical v3.8 run report.

## OWNBACK v3.8 — Execution and limitations report

**Prepared:** 2026-11-12 (Asia/Dubai). **Release label:** Mainnet candidate source, NOT real-money-ready, NOT deployed.

## Results actually executed in this working environment

| Check                                                                | Observed result                                                             | Evidence or limitation                                                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| v3.7 original SHA256 manifest                                        | PASS (207 files before edits)                                               | `npm run verify:manifest` before modifications                                                                                          |
| **v3.8 source-integrity manifest**                                   | **PASS, 217 included files**                                                | `npm run generate:manifest && npm run verify:manifest` after changes                                                                    |
| Original full `npm test`                                             | 96 pass, 1 test module failed to load                                       | `viem` missing from the environment; not a logic assertion failure                                                                      |
| **Updated full `npm test`**                                          | **103 pass, 1 module could not load (104 total)**                           | The same missing `viem` dependency blocks `tests/frontend-logic.test.mjs`; no new assertion failures observed                           |
| Original retention tests                                             | PASS 11/11                                                                  | `npm run test:retention`                                                                                                                |
| Original protocol tests                                              | PASS 4/4                                                                    | `npm run test:protocol`                                                                                                                 |
| Original hybrid tests                                                | PASS 11/11                                                                  | `npm run test:hybrid`                                                                                                                   |
| Recovery tests                                                       | PASS 6/6                                                                    | `npm run test:recovery`                                                                                                                 |
| Fault-injected Shopify recovery simulation                           | PASS 17 model assertions, including duplicate-send avoidance after DB crash | `npm run simulate:recovery` — offline simulated DB/email/chain, not live transactions; replay harness updated for new viem quote import |
| Mainnet safety tests                                                 | PASS 7/7                                                                    | `npm run test:mainnet`, static asserts and deterministic unit math                                                                      |
| Mainnet offline preflight                                            | PASS                                                                        | `npm run mainnet:static` only; no chain calls                                                                                           |
| Commerce & agentic preflight                                         | PASS                                                                        | `npm run commerce:preflight` / `npm run agentic:preflight`                                                                              |
| Live `npm ci`                                                        | BLOCKED                                                                     | Offline/unreachable registry, missing lockfile `pg` + `@types/pg`                                                                       |
| Solidity compilation / Foundry tests                                 | NOT RUN                                                                     | `forge`/`anvil` are unavailable                                                                                                         |
| Next.js production build / TypeScript full typecheck                 | NOT RUN                                                                     | npm dependency installation blocked; **103 TS/TSX files parse with 0 syntax errors** (not equivalent to typecheck)                      |
| Full local contract/payment/keeper E2E                               | NOT RUN                                                                     | missing Foundry, viem, real local chain                                                                                                 |
| Base 8453 RPC inspection / token metadata                            | NOT RUN                                                                     | No validated live RPC session or deployment context supplied; onchain-only preflight included                                           |
| Deploy, verified contracts, fund real USDC/B20, execute a paid order | NOT RUN                                                                     | Requires real chain keys/assets, security/legal review, production services                                                             |

## Major risks outstanding before go-live

1. Independent contract compile/audit of `OwnbackMainnet`, `ShopifyRewardVaultMainnet` and inventory adapters (including whole-contract invariants and refund/return edge cases).
2. Legally approved recipient eligibility/KYC/sanctions policy; onchain `eligibleRecipient` is a multisig-controlled allowlist, not an identity verification service.
3. Verified production inventory custody, token pricing and cost basis. B20 reference feed is **not** the actual DEX executable price. Stale feeds may block weekends and holidays.
4. Merchant authorization, Shopify credentials/webhooks, secure Postgres, Resend, refund policy, taxes and fulfillment.
5. Clean lockfile, complete test/build/typecheck/Foundry suite and auditable chain receipts. Source-level guards are not a replacement.
6. O(N) keeper and single-merchant SQL isolation are acceptable only in a tightly bounded pilot, not mass consumer traffic.
7. Merchant USDC vault budget **and** separately prefunded dealer B20 inventory must both be solvent to honor reward promises. Owner pause/withdrawal permissions require multisig governance. The stock inventory is not reserved per purchase; fresh solvency checks, low pilot caps and/or contract-level reservation are needed to avoid overstating fulfillment guarantees.

**Never treat this report or its example stock quote as proof of a live transaction.**

---

## Base team submission brief

_Formerly `BASE_TEAM_SUBMISSION_BRIEF.md`._

## OWNBACK — Base Stocks Maxxing, Agentic Stock Finance

**Product:** Merchant-funded stock-linked rewards for first and comeback purchases, with a bounded agent that refuses allocations a single-token vault cannot support.

**The demonstration:** One onchain campaign → unique paid orderRef → refund hold/eligible settlement state → allowed & refused policy briefs → observed returner and USDC budget dashboard. We have intentionally cut agentic shopping, Bankr research, borrowing and multi-stock trading from the primary flow.

**Key claim:** One vault token, one clearly constrained agent, transparent settlement and descriptive return purchases. Preference signatures are consent receipts only and cannot trade, transfer or claim.

**Status as of 2026-11-13:** Source release v3.10, **not deployed to Base mainnet**; Base Sepolia mock tokens are not actual equities. Repaired lock structure, JS policy tests passed, but npm CI/Next build is not verified due to registry DNS restrictions. Four required transaction/API evidence slots are still missing. We will not present test fixtures as live customer activity.

**Target:** Base Stocks Maxxing Agentic Stock Finance submission before December 5, 2026, with verified proof receipts, code SHA, source, and a 90-second demo only when all claims are evidenced.

---

## v3.10 release

_Formerly `OWNBACK_V3_10_RELEASE.md`._

## OWNBACK v3.10 — release notes and developer handoff

**Release intent:** Narrow v3.9 for Base Stocks Maxxing judges; no new lending, multi-stock execution, x402, or mandatory Bankr features. This is a **competition candidate** with visible evidence gaps, **not a mainnet deployment**.

## Applied changes

| Priority           | Delivered in source                                                                                                                                  | Boundary                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| P0: one hero path  | `/` and `/judge` guide campaign → paid order → finality → policy refusal → observed retention                                                        | Existing secondary modules remain in source, not judge story              |
| P0: lock           | Complete `pg` and `@types/pg` dependency trees with published tarball integrity SHA-512; offline npm lock-only regeneration passed                   | Real `npm ci`, TS type-check and Next build still need a networked runner |
| P0: reality labels | Global truth banner on all routes, `NOT_EXECUTED` on allocation, no alleged owned stock                                                              | Base Sepolia mock ≠ mainnet B20                                           |
| P0: evidence       | `evidence/proofs.json`, `/judge#proofs`, structural proof verifier + strict tag gate                                                                 | No chain or API receipts invented; **0/4 attached**                       |
| P1: consistency    | One immutable vault token; explicit hard refusals; source architecture unchanged                                                                     | Signed preference cannot change token or settle a reward                  |
| P1: merchant hero  | `/growth` leads with actual contract `available`, `spent`, `reserved` and observed campaign receipts from RPC; 7/30-day repeat stats; explorer links | Absent deployment yields no sample numbers; data is observed, not causal  |
| P1: demo           | One-click allowed and impossible allocation _offline_ fixtures, plus separate real backend proposal button                                           | Preview fixtures cannot sign, trade or claim                              |
| P1: finality       | State machine on homepage, judge page, and merchant scorecard                                                                                        | Refund after delivery remains a merchant liability                        |
| P2: deferred       | Audited funded B20 mainnet transfer and shop-scoped IAM                                                                                              | Not asserted or secretly implemented                                      |

## Reproducible installation gate (required on exact release SHA)

```bash
npm ci
npm run check
npm run test:allocation
npm run test:retention
npm run test:judge
npm run build
npm run verify:manifest
npm run verify:proofs:strict
```

A `v3.10.*` git tag triggers `.github/workflows/submission-gate.yml`; only a green run on the exact submitted SHA should be presented as a reproducible build. Strict proof validation **intentionally fails** until the real evidence slots are filled. `npm run check:lock` and `npm install --package-lock-only --offline` work locally, but do not substitute for `npm ci`.

## Evidence collection instructions

1. Deploy a controlled **Base Sepolia** mock vault/campaign (or explicitly label Anvil); save chain ID, contract addresses, deployment block, code SHA, and deployment transaction receipts.
2. Fund merchant campaign with testnet USDC, save `CampaignFunded` transaction hash, block and amount. Do not use a mock transaction hash.
3. Pay an actual user checkout with unique `orderRef`, save `Purchased` event and payment transaction; validate same orderRef retry rejects and no second charge occurs.
4. Try settle during hold, then after eligibility; record `RewardDelivered` and recipient testnet mock token balance. Trigger a real overspend or duplicate refusal with exact reason; `callStatic` refusal is local simulation unless the chain receipt proves otherwise.
5. Configure real preference receipt database and `APP_ORIGIN`, `OWNBACK_PREFERENCE_RECEIPTS_ENABLED=true`. Sign a wallet EIP-191 message; save first success and repeat POST with same wallet/nonce returning HTTP 409. Do not expose private keys, full cookies, access tokens, or customer PII.
6. Put sanitized receipts or logs under `evidence/receipts` or `evidence/logs`, update `evidence/proofs.json` only after checking the receipt matches exact network, and run `npm run verify:proofs:strict`. Run the CI tag gate, then record the green run URL and tagged commit SHA separately.

**Critical:** the proof-register validator verifies expected formats, file presence and network labels, **not transaction existence or finality**. Human/explorer or RPC verification is required.

## Local validation as delivered

- All new `test:judge`, `test:allocation`, `test:retention` tests passed.
- Local static TSX parsing passed for updated pages. Source manifest can be regenerated and verified.
- `npm test` contains one inherited failure caused by inaccessible `viem` module, not a failing policy assertion.
- `npm ci` failed due to npm registry DNS (`EAI_AGAIN`) despite repaired lock metadata; no Next build, browser E2E or Foundry mainnet test was executed here.

## Developer caution

- Global UI label is intentionally hard-coded to the current **not-deployed** release. It MUST be replaced with verified runtime/deployment attestation before any actual production deployment.
- The demo badge “offline fixture” on allocation is mandatory if the vault policy is not configured; a successful fixture proposal is not an actionable allocation.
- Onchain receipt metrics reflect RPC-derived purchased events in one configured campaign. Recent cohorts are immature; excluding refunded purchases does not fix survivorship or selection bias. Do not assert incremental lift or investor ownership.
- Shopify data is a separate authenticated checkout channel and stays behind a secondary expandable section. Do not mix native explorer-payment transactions with Shopify paid webhooks in the demo.

---

## v3.10.1 evidence gate

_Formerly `OWNBACK_v3.10.1_EVIDENCE_GATE.md`._

## OWNBACK v3.10.1 — Proof-first release gate

**Status: NOT submission-complete; NOT mainnet deployed.** This is a small P0 patch to v3.10, with no new product features. It closes the gap in the old `verify:proofs:strict`, which had validated hash/URL formatting but not transactions on a blockchain. **All four proof slots remain MISSING** in this source handoff.

## 1. Honest release position

- Target competition: Base Stocks Maxxing / Agentic Stock Finance.
- Hero: merchant-funded campaign → real paid orderRef → reward finality → one-stock allocation proposal/refusal → observed returners.
- Demo environment must be declared in first ten seconds. `BASE SEPOLIA / MOCK STOCK — NOT MAINNET` is the preferred proving ground. `ANVIL ONLY` is an acceptable local technical demonstration, not publicly verifiable traction.
- Allocation approvals are **NOT_EXECUTED** preferences; signing does not change the vault stock, trade, transfer, or claim.
- Shopify/retention totals describe **observed returners, not causally attributed lift**.
- Base mainnet B20 settlement requires issuer/recipient eligibility, inventory, independent security review, real contract deployment and funds. It is not asserted as complete.

## 2. Clean CI build (not yet verified here)

Run on a fresh Node.js 22.16.0, npm 10.9.2 runner with network access:

```sh
npm ci
npm run check
npm run test:allocation
npm run test:retention
npm run test:judge
npm run test:proofs
npm run build
npm run verify:manifest
```

A complete reproducible build **must be proven on the exact tagged Git SHA**. The ZIP has no `.git` history and is not a deployable public repository. CI will fail intentionally until evidence is attached and matching RPC secrets are present. The offline lock graph audit is not a substitute for `npm ci`.

## 3. Capture _real_ Base Sepolia receipts, never dummy hashes

Deploy the existing testnet path using `DEPLOY.md` and `contracts/script/DeployTestnet.s.sol`, follow a genuine funded campaign and customer paid order, then settle a real eligible reward. Confirm `CampaignFunded`, `Purchased`, and `RewardDelivered` events are emitted by **the same deployed OWNBACK contract**. All three receipts must match chain ID 84532 and refer to the same controlled demonstration. For any Anvil run, replace `BASE_SEPOLIA` with `ANVIL` and set `ANVIL_RPC_URL`.

Set a **trusted** Base Sepolia RPC URL in your local shell (do not commit credentials):

```sh
export BASE_SEPOLIA_RPC_URL='https://YOUR-TRUSTED-BASE-SEPOLIA-RPC'
export OWNBACK_CONTRACT='0xYOUR_ACTUAL_DEPLOYED_CONTRACT'
```

Capture the receipt of each real transaction (replace every placeholder only when available):

```sh
node scripts/capture-chain-proof.mjs --id=campaign_funding --environment=BASE_SEPOLIA --hash=0xREAL_FUND_TX_HASH --contract="$OWNBACK_CONTRACT"
node scripts/capture-chain-proof.mjs --id=order_payment --environment=BASE_SEPOLIA --hash=0xREAL_PAY_TX_HASH --contract="$OWNBACK_CONTRACT" --orderRef=0xREAL_32_BYTE_ORDER_REF
node scripts/capture-chain-proof.mjs --id=settlement_refusal --environment=BASE_SEPOLIA --hash=0xREAL_SETTLE_TX_HASH --contract="$OWNBACK_CONTRACT"
```

The third slot uses a **successful `RewardDelivered` settlement event**, not an unverifiable revert claim. An overspend refusal may additionally be demonstrated on screen with reason and test log, but must not be relabelled as a successful delivery.

The script checks RPC chain ID, receipt success, confirmed block, contract address and expected event; for payment, the event data must contain the claimed `orderRef`. It stores a receipt and updates only its corresponding proof slot. It cannot fabricate a transaction. The full strict gate independently re-fetches and rechecks the receipts.

## 4. Preference receipt + replay 409 (no spend authority)

Run a real OWNBACK app against configured Postgres, the existing allocation preference schema, an origin policy, a wallet-signature verifier and `OWNBACK_PREFERENCE_RECEIPTS_ENABLED=true`. The `POST /api/allocation/approve` endpoint should return HTTP **200** for a valid new signed preference and HTTP **409** for an identical replay of the same nonce. Capture the genuine POST body into a **local file outside the repository**, e.g. `/tmp/ownback-signed-preference.json`; never commit raw signatures or customer data.

```sh
node scripts/capture-preference-replay.mjs --url=https://YOUR_DEPLOYED_APP --bodyFile=/tmp/ownback-signed-preference.json --environment=BASE_SEPOLIA
```

This sends the **identical signed request twice**, records the two HTTP statuses and only a redacted digest, and populates `evidence/logs/preference-replay.json` if the responses are exactly HTTP 200 → HTTP 409. The source logs can corroborate the demo, but an HTTP log is not a chain receipt and does not confer permission to trade. Validate the capture against server logs before publishing. Remove local signed request files after the capture if no longer needed.

## 5. Strict acceptance gate on tagged SHA

```sh
npm run verify:proofs:strict
npm run generate:manifest  # after legitimate evidence updates
npm run verify:manifest
# Commit the evidence + complete source + SHA256 manifest, then tag the exact SHA.
```

Required GitHub Action secret: `BASE_SEPOLIA_RPC_URL` (or matching environment, as used in the proof register). The separate `submission-gate.yml` job enforces clean installation, typecheck, policy/retention/judge/proof tests, build, manifest and chain evidence. The workflow must show **green on the tagged commit**. Do not tag until the four proofs have been captured, each RPC is reachable, and all gates pass.

### What v3.10.1 proves and does not prove

| Gate                                          | State at handoff                                                   |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Receipt verifier negative/positive tests      | 8/8 passing locally (simulated RPC response fixtures)              |
| Policy/retention/judge tests                  | 16/16, 15/15, 8/8 passing locally                                  |
| Existing source manifest                      | Will be regenerated and checked for this patch                     |
| Actual Base Sepolia/Anvil receipts            | **MISSING — 0/3**                                                  |
| Preference HTTP 200 → 409 production capture  | **MISSING — 0/1**                                                  |
| `npm ci` / TypeScript / Next production build | **UNVERIFIED** — package registry inaccessible in this environment |
| Verified Base mainnet stock delivery          | **NOT DEPLOYED / NOT VERIFIED**                                    |

No time-based or conditional operation is scheduled. Release is **NO-GO** until genuine evidence and a green build exist.

---

## v3.10.2 release status

_Formerly `OWNBACK_v3_10_2_RELEASE_STATUS.md`._

## OWNBACK v3.10.2 — Proof execution handoff

**Release decision: NO-GO for judge submission.** This is a proof-execution source patch, not a deployed product. No live Base Sepolia or Base mainnet transactions were submitted here. Evidence still **0/4**. No production tag or green hosted build exists from this session.

## Source changes

- Added `scripts/capture-anvil-path.mjs`: inspects **real** Anvil `eth_getLogs` and captures a coherent `CampaignFunded` → `Purchased(orderRef)` → `RewardDelivered` sequence from one live contract/campaign/purchase, through the existing receipt RPC verifier. Activated only by `OWNBACK_CAPTURE_EVIDENCE=true npm run e2e:local` after the chain is running.
- Added `scripts/create-signed-preference.mjs`: creates a genuine, short-lived wallet preference signature using a throwaway developer wallet; writes body to a local `/tmp` location; cannot authorize a trade. Existing API capture tool verifies HTTP 200, then HTTP 409 with the same body.
- Strengthened `verify:proofs:strict` to require captured receipt snapshots, canonical chain RPC receipts, indexed event identity and fund/pay/deliver linkage, and a consistent environment and contract.
- Added `scripts/assert-tagged-sha.mjs` and tag-enforced `judge:gate` so source must be a clean Git commit with a `v3.10.x` tag pointing at HEAD. GitHub's submission workflow also checks SHA and reruns full tests.
- Added proof-path tests and `RELEASE_PROOF_EXECUTION_v3.10.2.md` with local Anvil and recommended public Base Sepolia steps.

## Checks actually run on this source

| Check                           | Actual result                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run check:lock`            | Passed: offline structural lock metadata check                                           |
| `npm run test:proofs`           | **9/9 passed** (RPC fixture tests; NOT live-chain proofs)                                |
| `npm run test:release-proof`    | **4/4 passed** (source/negative guard tests)                                             |
| `npm run test:allocation`       | **16/16 passed**                                                                         |
| `npm run test:retention`        | **15/15 passed**                                                                         |
| `npm run test:judge`            | **8/8 passed**                                                                           |
| `npm test`                      | **140/141 passed**. One test could not import `viem` because packages are not installed. |
| `npm run verify:manifest`       | Passed on packaged source tree                                                           |
| `npm run verify:proofs:strict`  | **Intentionally failed: 0/4 genuine receipts**                                           |
| `npm run release:tag-assert`    | **Intentionally failed: ZIP is not a Git checkout/tag**                                  |
| `npm ci --offline`              | **Failed:** npm tarball absent from cache (`zod`)                                        |
| `npm run check`                 | **Failed:** unresolved packages/type declarations in incomplete environment              |
| `npm run build`                 | **Failed:** `next` not installed                                                         |
| Foundry/Anvil actual deployment | **Not run:** no Foundry binaries in environment                                          |

## What the developer needs to bring

A networked Node 22 / npm 10 machine with Foundry, access to a test-only wallet and Base Sepolia RPC (or running Anvil), plus PostgreSQL and the optional running Next app for preference replay. On a fresh checkout, complete the steps in `RELEASE_PROOF_EXECUTION_v3.10.2.md`. Generate evidence, regenerate the manifest, commit, tag the exact SHA, and require the tagged GitHub workflow to be green. Do not populate proofs with fabricated hashes or synthetic API results.

### Truth and scope

- Anvil = **local technical evidence**, not public onchain traction. Resetting Anvil loses its block/receipt evidence.
- Base Sepolia = **mock USDC/mock stock**, not eligible B20 ownership or mainnet launch.
- Signed preference = `NOT_EXECUTED`, cannot trade or claim.
- Retention = observed counts, not causal lift.

Do not record or submit the 90-second launch video as a verified, public-chain build until real evidence and a green release tag exist.

---

## v3.10.2 release proof execution

_Formerly `RELEASE_PROOF_EXECUTION_v3.10.2.md`._

## OWNBACK v3.10.2 — Evidence execution, exact-SHA release gate

**RELEASE STATUS: NO-GO. No onchain deployment performed in this ZIP. 0/4 evidence slots populated.**

Purpose: make the _existing_ purchase/reward story reproducible and externally assessable, without adding product features or simulating real B20 ownership. The new `capture:anvil` utility reads real RPC event logs and will refuse to invent transaction hashes. The signed-preference utility produces a genuine temporary message signature only; it does not trade. Strict verification now requires both captured receipt snapshots and live canonical-RPC confirmation. `judge:gate` additionally asserts a clean Git tag at the exact tested SHA.

## Recommended for judge-ready submission: Base Sepolia

1. On an internet-connected machine: `npm ci && ./contracts/install-deps.sh && (cd contracts && forge test)` and run tests + `npm run build`.
2. Deploy only the **testnet** Ownback stack to Base Sepolia with a test-only wallet and safe mock tokens (`contracts/script/DeployTestnet.s.sol`). Fund the wallet with Sepolia ETH; the mock USDC/stock tokens have no real asset backing. Do not put deployment private keys into source control.
3. In the SAME deployment, record actual `CampaignFunded`, `Purchased(orderRef)` and `RewardDelivered` transactions. Use `scripts/capture-chain-proof.mjs` exactly as documented in `OWNBACK_v3.10.1_EVIDENCE_GATE.md`. Do not use a reverted overspend transaction as proof of successful settlement.
4. Run the preference API with PostgreSQL migrated using `commerce/allocations.sql`, with `APP_ORIGIN`, `OWNBACK_PILOT_SETTLEMENT_STOCK` and `OWNBACK_PREFERENCE_RECEIPTS_ENABLED=true`. Use `scripts/create-signed-preference.mjs` with an **unfunded, temporary, controlled** signer to create `/tmp/ownback-signed-preference.json` and immediately run `scripts/capture-preference-replay.mjs` to prove HTTP 200 then 409. No trade is made.
5. Capture proof files on the **same release tree**: 3 chain receipts + 1 replay record. Run `npm run verify:proofs:strict`; verify first on a public Sepolia RPC and check actual explorer records independently. Update source manifest **after all files and docs are final**.
6. Commit source + evidence + manifest, tag that exact commit `v3.10.2`, push tag to GitHub and require the `Base Stocks Maxxing submission gate` job **green on the tag SHA**. Run `npm run judge:gate` in that clean tagged checkout. Only THEN record the 90-second demo with `BASE SEPOLIA / MOCK STOCK — NOT MAINNET` upfront.

`verify:proofs:strict` validates chain data as it exists _at runtime_; public Sepolia evidence is recommended to make the tagged GitHub gate independently repeatable. A local Anvil reset invalidates its old hashes and blocks; therefore an Anvil capture cannot substitute for durable public explorer proof.

## Local Anvil-only technical rehearsal (does not satisfy public evidence)

Prerequisites: Foundry (`anvil`, `forge`), Node 22, npm packages and Solidity deps. Open separate terminal A:

```bash
anvil --silent
```

Terminal B (from repo root; public Anvil demo keys ONLY):

```bash
npm ci
./contracts/install-deps.sh
mkdir -p contracts/deployments
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export KEEPER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
(cd contracts && forge script script/DeployTestnet.s.sol:DeployTestnet --rpc-url http://127.0.0.1:8545 --broadcast)
export ANVIL_RPC_URL=http://127.0.0.1:8545
OWNBACK_CAPTURE_EVIDENCE=true npm run e2e:local
```

After the last command, **three of four slots** should point to genuine local receipts and say `ANVIL ONLY`. Strict verification remains red until a real wallet-signed preference is captured from a running app + PostgreSQL:

```bash
# Configure app separately: chain=31337; APP_ORIGIN=http://localhost:3000;
# OWNBACK_PILOT_SETTLEMENT_STOCK=AAPLc; OWNBACK_PREFERENCE_RECEIPTS_ENABLED=true;
# DATABASE_URL points to migrated PostgreSQL. Start the app with npm run dev.
export OWNBACK_DEMO_SIGNER_KEY=0x_YOUR_THROWAWAY_ANVIL_TEST_KEY_  # example placeholder, never funded
export APP_ORIGIN=http://localhost:3000
export NEXT_PUBLIC_CHAIN_ID=31337
export OWNBACK_PILOT_SETTLEMENT_STOCK=AAPLc
node --experimental-strip-types scripts/create-signed-preference.mjs
node scripts/capture-preference-replay.mjs --url=http://localhost:3000 --bodyFile=/tmp/ownback-signed-preference.json --environment=ANVIL
npm run verify:proofs:strict
rm -f /tmp/ownback-signed-preference.json
```

This verifies a temporary **local** chain and HTTP API. It does not create a public, repeatable transaction record once the node stops, and is not an eligibility-approved tokenized equity delivery.

## Exact released SHA gate

```bash
npm run check:lock
npm ci
npm run check
npm run test:allocation
npm run test:retention
npm run test:judge
npm run test:proofs
npm run test:release-proof
npm run build
npm run generate:manifest
npm run verify:manifest
npm run verify:proofs:strict
# Commit here, then tag that exact clean SHA and push:
git tag v3.10.2
git push origin v3.10.2
npm run judge:gate
```

The GitHub workflow runs the gate on the tagged SHA, with `BASE_SEPOLIA_RPC_URL` set as a repository secret; a green build is a fact only after seeing a completed job. For local Anvil, the ephemeral RPC must remain alive throughout verification. The requirement `release:tag-assert` fails outside Git, on an untagged checkout, with uncommitted edits, on branch CI refs, or when the GitHub SHA mismatches HEAD.

### Non-negotiable truth labels

- `BASE SEPOLIA / MOCK STOCK — NOT MAINNET` OR `ANVIL ONLY / MOCK STOCK — NOT MAINNET` in the first 10 seconds.
- `NOT_EXECUTED` next to preference signing. Preference cannot trade or claim.
- Retention is **observed, not causal uplift**. Counts of returners are not established without real deployment and user data.
- Do not claim B20 ownership from minting mock stock, and do not imply live use from a local test.
