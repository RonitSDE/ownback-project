# v3.1 → v3.2

## Contracts

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

## Frontend

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

## Tooling

- ESLint (Next core-web-vitals + TypeScript) and Prettier enforced in CI.
- `npm run test:ui`: real Chromium with an injected EIP-6963 wallet sending genuine transactions; runs in CI with
  screenshots uploaded as artifacts.
- Slither static analysis; findings in SECURITY.md.
