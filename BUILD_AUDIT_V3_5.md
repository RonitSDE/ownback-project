# OWNBACK 3.5 — Reproducible Build Audit

**2026-11-10** · Hybrid Shopify + Base USDC commerce · Developer release candidate

## Independently run in this environment
- Source layout and ZIP inputs inspected from uploaded v3.4 artifact.
- 54/54 targeted Node.js business/security tests passed, including 11/11 new Shopify cryptography, identity, claim-rule and payout-gate tests.
- 91 TypeScript/TSX files passed **syntax transpilation**, but this is not a full dependency-aware `tsc --noEmit` typecheck.
- Existing `release-preflight` and `commerce-preflight` scripts passed.
- `SOURCE_MANIFEST.sha256` is generated from the final artifact files and verified before packaging. ZIP CRC integrity verified after packaging.
- Static UX preview is bundled; browser screenshots/tests could **not** be executed here because the browser blocks local file and localhost access. Preview is illustrative, not the running Next.js app.

## P0 remaining deployment gates
1. The old v3.4 lockfile omitted `pg` and `@types/pg`. We could not reach npm registry from this container. On a networked machine run `npm run bootstrap:lock`, commit the resolved lockfile, change CI back to `npm ci`, then verify `npm ci && npm run check && npm run build`.
2. Run `npm run format` and `npm run format:check` and resolve lint warnings before merging; Prettier was not available in this container.
3. `./contracts/install-deps.sh && npm run test:contracts` has not been run; Foundry unavailable. This includes the new ShopifyRewardVault and ShopifyTestnetAdapter tests.
4. Start PostgreSQL, apply `commerce/schema.sql` and `commerce/shopify.sql` via `npm run commerce:migrate`, test upgrade on snapshot, and verify no duplicate/refund issues.
5. Deploy/verify contracts on Base Sepolia. No live Base receipts were produced here.
6. Verify real Shopify OAuth installation, approved order/email scopes, webhook subscriptions, webhook-HMAC retries, confirmed order re-query, email issuance/redeem, wallet signature, automated claim worker and stock delivery with a real shop and test accounts.
7. Mobile Safari + Android Chrome touch, 44px targets, reduced motion, loading performance and accessibility QA on `/experience`, `/claim`, `/commerce`, `/commerce/admin`, `/shop`, `/protocol`.

## Security / scope caveats
- Shopify customer checkout is processed by Shopify; the Shopify reward vault **does not** charge the buyer. The merchant funds synthetic stock rewards in separate test USDC.
- All securities, portfolio execution and Bankr borrowing are disabled. Bankr read-only research is retained.
- Shopify pilot supports one allowlisted store and USD-only orders; no multi-merchant OAuth token rotation or public app marketplace submission is claimed.
- Merchant/consumer identities are hashed; anonymous shoppers without usable email or customer ID can't earn rewards. Real delivery depends on approved email access.
- The dedicated Shopify worker must be run singly and reconciles chain events; no distributed queue/KMS production deployment is claimed.
- Refunds after stock settlement are marked, not clawed back. Commercial merchant risk remains.

**Assessment:** a substantial integrated developer handoff and runnable source candidate, not a certified live production or securities platform.
