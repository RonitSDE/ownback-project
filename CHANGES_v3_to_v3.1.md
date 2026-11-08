# Source change summary — v3 -> v3.1

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
