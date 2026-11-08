# v3.1 -> v3.1.1 review patches

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
