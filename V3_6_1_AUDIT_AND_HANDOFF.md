# OWNBACK v3.6.1 — source audit, functional fixes and developer handoff

**Baseline:** User-provided v3.6 source archive. **Review date:** November 10, 2026.

## What was actually fixed

1. **Native USDC order reconciliation:** `orderRefUsed(campaignId, payer, orderRef)` requires three arguments, but the inherited commerce helper passed only two. It now checks the right customer's order reference. Previously, that check could not execute as intended and reconciliation could fail, jeopardizing safe expiry handling.
2. **Real Shopify product imagery:** The production Content-Security-Policy blocked all remote HTTPS product images. `img-src` now permits HTTPS catalog images. Product images explicitly use `referrerPolicy="no-referrer"`; active HTML content remains disallowed as imagery.
3. **Checkout consistency when merchants change:** Changing the selected store now clears search results, selected variants, previous cart, and any old merchant handoff URL. Invalidated search/cart requests cannot reinstate stale offers or checkout links. Cart modification also cancels a pending handoff state.
4. **Connected wallet used consistently for reward claims:** Claim signatures use OWNBACK's selected connected EIP-1193 provider, verify network/account continuity, and no longer silently fall back to a different extension's `window.ethereum` provider.
5. **Fail-closed catalog validation:** Shopify UCP variants without an explicit `availability.available===true` are not purchasable; missing, null, boolean or whitespace prices are rejected rather than displayed as accidental zero-dollar products.
6. **Merchant reward readiness:** A store must be installed, active, and webhook-ready before shoppers can discover it in the participating merchant directory. The frontend also respects whether a public UCP profile has been configured.
7. **Source-integrity coverage:** The source manifest verifier now checks for unlisted source files and duplicate paths as well as changed/missing files.
8. **Typed webhook payload / UCP parser:** Replaced loose `any` definitions in the touched modules with explicit or unknown-safe types. Existing security controls for Shopify webhook signature verification, refund holds, and mock-token delivery are preserved.

## What has NOT been changed

- No real securities issuance, live stock transfers or live collateralized borrowing were enabled. Bankr remains read-only; POST /api/agent/borrow remains HTTP 403.
- Shopify card, shipping and tax flows stay on the merchant's checkout. OWNBACK does **not** charge card shoppers again.
- USDC native checkout, synthetic Base Sepolia Shopify reward vault, merchant funding, refund holds and signed claim flow remain in the source.
- **Customer hashing was deliberately NOT migrated.** V3.6 prefers normalized email when present, otherwise Shopify customer ID. Changing to customer-ID-first without reconciling existing hash histories would break return-purchase loyalty continuity. Design and test that migration separately before any real-data rollout.

## Verification performed in this session

- User ZIP safely extracted; original source manifest verified **185/185**.
- Shopify UCP agentic tests passed; Shopify hybrid security tests passed; additional regression tests passed.
- Dependency-independent unit suite passed (excluding `tests/frontend-logic.test.mjs`, which imports the unavailable `viem` dependency). The precise final total is in the command log; do not treat this as a full `npm test` pass.
- TypeScript **syntax parsing** completed across 97 TS/TSX source files with zero parse errors. This is NOT a semantic TypeScript typecheck.
- Release and commerce source preflight scripts passed.

## Environment and launch blockers

- The **original lockfile does not contain the `pg` and `@types/pg` package lock entries** needed for a clean `npm ci`; attempts to fetch them from npm failed because `registry.npmjs.org` was unavailable in this environment. Do NOT claim clean install or production build success. On a networked developer machine, regenerate the lockfile, commit it and run `npm ci` from scratch.
- Full ESLint, Prettier, TypeScript semantic checking, Next.js production build, Foundry compilation/test, Playwright device tests and deployed Base Sepolia integration were not run here. The CI `format:check` gate must also be verified with the complete dependency install. If reformatting changes source files, regenerate the manifest **after** formatting.
- No active Shopify test merchant, published HTTPS UCP profile, real signed paid-order/refund webhook, SMTP, Base Sepolia deployment credentials, or live Bankr key were supplied. The purchase-to-claim journey is NOT proven in production or staging.
- The API's per-process rate limiter depends on trusted proxy headers; add a distributed limiter and WAF before real users.

## Competition readiness: required demonstration

1. Install a pilot Shopify store and verify all order/refund webhooks are actually registered; publish OWNBACK's HTTPS UCP agent profile.
2. In **live mode**: real catalog search → select an explicitly available variant → merchant cart → merchant checkout. Show product images and verified source pricing.
3. Complete a Shopify test payment; verify the HMAC order event, deferred reward, a customer wallet-claim signature and a **real Base Sepolia mock-token delivery transaction receipt**.
4. Repeat a purchase for the same pseudonymous customer inside seven days and verify a higher eligible reward once. Demonstrate cancelled/refunded/duplicate orders do not pay.
5. Independently demonstrate native USDC checkout, wallet payment proof, inventory update and merchant analytics. Show Bankr as research only.
6. Obtain screenshots/receipts plus a **clean green CI** run after correcting the dependency lockfile. Keep promotional language explicit: synthetic stock testnet, not legally held equity.

**Release recommendation:** Use as a **v3.6.1 audit/fix candidate**, not as a production-ready release. Design and product direction are strong; launch eligibility still depends on real integration evidence.
