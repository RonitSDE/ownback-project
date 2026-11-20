# Security

OWNBACK v3.2 is a **testnet** build. It has had internal review, static analysis and adversarial testing, but **no
independent audit**. Don't deploy it with real funds.

Report issues privately to the maintainers rather than opening a public issue.

## Trust model

| Actor        | Can                                                              | Cannot                                                                          |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Customer** | Pay, settle their own reward (and set its slippage floor)        | Settle someone else's reward, reuse a reference to double-pay                   |
| **Merchant** | Fund, withdraw _unreserved_ budget, pause rewards, refund orders | Touch reserved rewards, cancel a promised reward by pausing, redirect a reward  |
| **Keeper**   | Settle due rewards, publish prices (testnet adapter)             | Invent orders, change amounts, redirect rewards, re-stamp an old price as fresh |
| **Owner**    | Set adapter, keeper and stock allowlist; global pause            | Move customer or merchant USDC directly                                         |

**Owner is the main centralisation risk.** A malicious adapter set by the owner could take the reward amount being
settled (bounded by what's reserved). Mainnet would need a multisig and a timelock on `setAdapter`/`setStock`.
Ownership transfer is two-step (`Ownable2Step`), so a mistyped address can't brick admin control.

## Attacks considered

| Attack                                              | Defence                                                                                 | Test                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Customer charged without the reward they were shown | `minRewardUsdc` floor: payment reverts before any transfer                              | `testPause/WithdrawalBetweenPreviewAndPayment…`                                                                        |
| Double charge from a retry or double-click          | Per-payer `orderRef` reverts on reuse; browser intent store                             | `testReplayNeverChargesCustomerAgain`, UI journey                                                                      |
| Griefing: front-running another payer's `orderRef`  | References namespaced by `msg.sender`                                                   | `testOrderRefCannotBeGriefedByAnotherPayer`, e2e                                                                       |
| Stale quote executed much later                     | `quoteDeadline` at most 1 hour ahead, checked on chain time                             | `testQuoteDeadlineAndRewardFloor`                                                                                      |
| Merchant withdraws budget promised to customers     | Reservation at checkout; `available()` excludes it                                      | `testWithdrawCannotTouchReservedRewards`                                                                               |
| Refund abuse: reward then refund                    | Refund hold before settlement; after it, refund is recorded, not clawed back            | `testRefundAfterRewardIsFlagged…`                                                                                      |
| Comeback reward stranded by a refunded first order  | Refunding a first order voids its pending comeback                                      | `testRefundBeforeSettleReturnsMoneyAndVoidsComeback`                                                                   |
| Reentrancy via token or adapter                     | `nonReentrant` on every state-changing entry point; checks-effects-interactions         | Slither clean (see below)                                                                                              |
| Keeper republishes an old price as fresh            | Adapter stores the upstream source timestamp; rejects regressions and future times      | `testRejectStaleUpstreamPriceTimestamp`, `testRejectFutureSourceTimestamp`, `testKeeperCannotRestampOlderPriceAsNewer` |
| Settlement at a stale price                         | Adapter refuses quotes older than `maxPriceAge` (fails closed)                          | `testStalePriceFailsClosed`                                                                                            |
| Slippage                                            | Customer or keeper sets `minStockOut`; delivery measured from balance delta             | `testSlippageGuard`                                                                                                    |
| Wrong network or swapped account in the wallet      | Chain and signer verified before every send                                             | UI journey                                                                                                             |
| Malicious wallet metadata (EIP-6963 icon)           | Icons rendered only if they match a strict `data:image/…;base64` pattern                | `safeIcon`                                                                                                             |
| Tampered browser storage                            | Stored intents validated field by field before use                                      | `frontend-logic.test.mjs`                                                                                              |
| Unlimited approvals                                 | UI approves only the exact amount                                                       | code review                                                                                                            |
| Clickjacking, injection, mixed content              | CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, strict referrer and permissions policies | headers verified on the served app                                                                                     |

## Static analysis

Slither 0.11.6 (102 detectors) over all contracts. All medium and higher findings were fixed or documented:

- `arbitrary-send-erc20` in `refund`: false positive (the sender is always the merchant); now written as
  `msg.sender` for clarity.
- `reentrancy-balance` / `unused-return` in `settle`: intentional. Delivery is measured from the customer's
  balance, not the adapter's report; `settle` is `nonReentrant` and the adapter is owner-set. Annotated inline.
- Missing event on `setMaxPriceAge`: fixed.

Remaining low and informational findings are deliberate: a zero keeper address disables keeper settlement
(customers can still settle themselves), and time windows use `block.timestamp` by design.

## Known limitations

- Not audited. Owner powers aren't timelocked.
- The keeper's price source (Coinbase Tokenized Stocks API) hasn't been verified against the live response from
  this build environment. Run `npm run prices:check` before deploying.
- The mock adapter mints test tokens. A mainnet adapter needs an oracle-bounded `minOut` and issuer eligibility
  checks at delivery.
- Customers are identified by wallet, so one person with several wallets can earn several first-order rewards.
  Each still requires a real payment to the merchant, which bounds the cost.

## v3.10.6 — HTTP client identity hardening

API throttles cannot authenticate a client from arbitrary `X-Forwarded-For` input. The new `src/lib/server/client-ip.ts` returns `untrusted` by default, conservatively sharing one limit bucket, and allows per-client identity only when a trusted ingress _overwrites_ `X-Real-IP` or reliably _appends_ its observed peer as the final entry of `X-Forwarded-For`. Set `OWNBACK_TRUSTED_PROXY_IP_HEADER` only after verifying that behavior on the deployed provider. A client-controlled value in the chosen position defeats IP-based throttling. Multi-instance deployments must use shared limits plus an external WAF. See `SECURITY_SIMULATION_v3.10.6.md`.

---

## OWNBACK v3.10.6 — Security simulation and release decision

### Scope

This patch uses **v3.10.5** as baseline and changes only request-origin rate limiting, security tests, metadata, and handoff documentation. It does not alter deployed contracts, merchant experience, customer settlement, captured Base Sepolia receipts, or stock eligibility. The patch does **not** prove mainnet safety.

### Finding 1: attacker-selected HTTP rate-limit identity

**Risk:** If the app trusts an incoming `X-Forwarded-For` header, an attacker can rotate its first comma-separated IP string to evade per-IP throttling on login, redemption, portfolio reads, and research routes. Trust depends on actual reverse-proxy behavior; a correctly sanitized ingress may already mitigate this.

**Patch:** `clientIp()` now ignores forwarded IP headers unless `OWNBACK_TRUSTED_PROXY_IP_HEADER` explicitly chooses an approved ingress format. It accepts only syntactically valid IPv4/IPv6 values. `x-forwarded-for-last` ignores spoofed _first_ entries and uses the nearest peer appended by a trusted ingress. Three commerce-related routes that previously read the raw header now use the same helper as the agent routes.

**Tradeoff:** Without an authenticated ingress-provided IP all requests share the `untrusted` rate-limit bucket. This protects the budget but may reject legitimate traffic under load. Before production deploy, configure an ingress that overwrites the chosen header, a shared rate limiter across instances, and independent edge/WAF throttling. Misconfiguring the proxy can undo this protection; ensure trusted ingress and WAF log evidence exist.

**Executed local adversarial cases:** 100 rotated spoofed IPs in default mode; 100 rotated initial XFF entries with a fixed trusted last hop; malformed / comma-injected IPs; IPv4/IPv6 acceptance; route consistency. See `tests/trusted-proxy-security.test.mjs` and the separate validation report.

### Additional contract regression scenarios — execution status updated

The seven Foundry adversarial regressions in `contracts/test/OwnbackMainnet.t.sol` cover unauthorized settlement, duplicate settlement, refundable reservation accounting, budget-exhaustion refusal, withdrawal isolation, comeback voiding after a refund, and future-dated oracle rounds.

**Original v3.10.6 patch environment (recorded at creation): NOT RUN.** Foundry and OpenZeppelin dependencies were unavailable there. This remains a true historical record of what the patch author independently executed.

**Separate follow-up tester (reported November 16, 2026): PASS, 7/7 new adversarial cases; 20/20 mainnet suite; 70/70 total contract tests.** The same supplied report says a clean `npm ci`, TypeScript check, ESLint, 164 JavaScript tests, a Next.js production build (49 routes / 39 pages), and a 241-file source manifest passed. These are _tester-reported_ results: the report supplied to us does not include raw logs, the tested Git commit SHA, the exact Foundry version, or a CI run URL. They are not independently reproducible facts certified by this documentation-only patch.

**Recheck in this packaging environment:** the five direct proxy-security tests and twelve judge tests pass (5/5 and 12/12), the manifest passes on the original archive (241 files), and all 20 mainnet test functions can be counted in source. `forge` is unavailable here; EVM execution was **not independently rerun**. Do not equate 70 passing tests with a formal contract audit.

### Release blockers

1. On a networked runner, run `npm ci`, `npm run check`, `npm test`, `npm run build`, and `npm run verify:manifest`.
2. Install Foundry and contract dependencies and run `npm run test:contracts` and fuzz/invariant campaigns.
3. Provide a trusted-ingress configuration and external shared limits; penetration-test the actual deployed proxy behavior, not just mocked headers.
4. Verify all saved receipts against live Base Sepolia RPC, verify the preference 200→409 replay log, and get `npm run judge:gate` green on the exact signed/tagged commit.
5. Obtain independent security and issuer/legal review before handling Base mainnet USDC or B20 stock; no live mainnet deployment has been performed here.

**Release posture: competition-source hardening only. Mainnet NO-GO; final judge submission gate pending.**

### Test provenance / submission evidence addendum (November 16, 2026)

| Gate                                   | Reported by separate tester      | Reproduced here                                                 | Evidence required for signed release               |
| -------------------------------------- | -------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| `npm ci`                               | PASS                             | No                                                              | Clean job log + tested SHA                         |
| TypeScript, ESLint                     | PASS                             | No                                                              | CI artifacts                                       |
| Full JavaScript suite                  | 164 passed                       | No; focused security 5/5 and judge 12/12 pass                   | CI test log                                        |
| Foundry complete suite                 | 70/70 passed                     | No Foundry installed                                            | `forge test -vvv` output                           |
| Mainnet contract suite                 | 20/20 passed (7 new regressions) | 20 test functions confirmed in source, execution not reproduced | Contract-specific Foundry log                      |
| Next.js build                          | PASS, 49 routes / 39 pages       | No                                                              | CI build output                                    |
| Source manifest                        | PASS, 241 files (original ZIP)   | PASS, 241 files (original ZIP)                                  | Regenerate and recheck after documentation changes |
| Base Sepolia RPC receipt verification  | Not established                  | Not established                                                 | Strict RPC report at tagged SHA                    |
| `judge:gate` at exact tagged SHA       | Not established                  | Not established                                                 | Green GitHub Actions URL + exact SHA               |
| Issuer eligibility / real B20 transfer | Not established                  | Not established                                                 | Separate integration/security/eligibility proof    |

**Proxy configuration is not verified by unit tests.** In production, `OWNBACK_TRUSTED_PROXY_IP_HEADER` must be enabled _only after_ confirming that the actual HTTPS ingress strips/overwrites `X-Real-IP`, or appends an authenticated last `X-Forwarded-For` peer. Test against forged headers through the public endpoint. A default shared `untrusted` bucket is protective against spoofing but can reduce availability; use a shared limiter and WAF/edge enforcement across instances.

**Do not retag an existing Git tag.** This addendum updates documentation and changes the source manifest and resulting commit SHA, although it does not change application or contract logic. Commit the updated documentation and manifest first. If `v3.10.6` is already published, use a new release tag/version; otherwise tag the final new SHA once and validate `judge:gate` on that exact revision.

**Decision unchanged:** no production mainnet approval; final judge verification requires independently reproducible CI, actual RPC receipt confirmation, and an honest testnet/mock-stock video.
