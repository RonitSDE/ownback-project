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
