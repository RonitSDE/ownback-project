# Staging test plan (must be executed, not asserted)

## Tools & setup
Node >=22, PostgreSQL 16, Foundry and a configured Base Sepolia RPC. Configure a merchant wallet and an independent buyer wallet. Set `DATABASE_URL` for the Postgres container (localhost port 5433). Deploy mock contracts, create a campaign with the correct configured merchant; ensure all public and private contract addresses refer to the same deployment.

## Checkout → inventory → receipt
- Create product with stock 2, price 48 USDC. Two separate customers buy at the same moment; only 2 units can be reserved. A third request must be rejected.
- Reserve one and leave without paying. Wait for quote expiry; reconciliation must prove no `Purchased` event and return inventory.
- Pay a reserved order; close browser immediately. Run the indexer; it should verify 3 Base confirmations and mark exactly one `PAID` order, with a matching wallet, orderRef, campaign, vault and amount.
- Retry with the same transaction: no extra inventory deduction; second reference using the same tx fails.
- Attempt wrong payer, wrong ref, insufficient reward budget, paused campaign, expired quote. They must not collect customer USDC.
- Merchant marks pickup fulfilled; refund a paid order. Onchain purchase state/merchant refund state must reconcile.

## Loyalty / stock proof
- Valid first purchase earns 2%, then eligible repeat earns 5% within seven days and cannot repeat the comeback bonus. Test at the 7-day boundary and just after.
- Keeper restarts halfway through settlement; repeat receipt processing must not duplicate delivery.
- Stock adapter must emit mock token transfer, not simply mark USDC payment as stock delivery.

## Bankr
- Configure dedicated **read-only** key and Agent API credits; `GET /wallet/me` responds. Trigger one allowlisted research job, follow signed polling link to terminal state.
- Invalid symbols, forged/expired research receipt and repeated prompts fail; `/api/agent/borrow` always returns 403 even if legacy `BANKR_BORROW_ENABLED=true`.
- Verify operator key cannot transfer or borrow. A job `completed` must never show “Loan opened.”

## Release gates
- `npm install --package-lock-only` on a network-enabled machine to update lock (pg dependency); commit it; `npm ci` on a clean clone.
- `npm test && npm run test:commerce && npm run check && npm run build && npm run test:contracts && npm run verify:local` all pass.
- Rehearse the browser checkout on mobile, merchant refund, keeper crash/restart, database backup and recovery.
- Block real-money customer access pending legal/issuer review, financial integration approval and independent contract security review.
