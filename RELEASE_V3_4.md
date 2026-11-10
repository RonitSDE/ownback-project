# OWNBACK v3.4 integrated release — developer handoff

This is a **Base Sepolia deployment candidate** rather than a certified mainnet protocol. It merges the previously separate single-merchant USDC commerce code with v3.3 reward checkout and replaces the unsafe Bankr shared-wallet loan endpoint with a customer-safe read-only educational research flow.

## Setup
1. Node >=22, npm, PostgreSQL 16, Foundry/Anvil. Configure `.env` from `.env.example`.
2. `npm install` (updates lockfile for the new `pg` dependency); commit generated `package-lock.json`, then `npm ci` on a clean checkout.
3. `docker compose -f docker-compose.commerce.yml up -d`, set `DATABASE_URL` to the local container on port **5433**, then `npm run commerce:migrate`.
4. Follow `DEPLOY.md` for Base Sepolia mock contracts; copy matching contract addresses, chain ID, campaign ID, and deployment block into commerce and Next.js variables.
5. `npm test && npm run test:commerce && npm run check && npm run build && npm run test:contracts && npm run verify:local`. All must pass before public deployment.
6. Start Next.js: `npm run dev`; `/` overview, `/commerce` real sample catalog, `/commerce/admin` pilot merchant, `/shop` reward wallet, `/protocol` evidence walk-through, `/demo` simulator.
7. Schedule authenticated `/api/commerce/admin/reconcile` with `COMMERCE_CRON_SECRET` and supervise indexer/keeper.
8. Configure a separate Bankr read-only API key; enable research only after confirming wallet permissions, Agent API credits, `/wallet/me` and a successful no-write prompt.

## Acceptance test
Paid real product with correct inventory; reload before receipt; retry duplicate tx; 3 confirmations; first and repeat reward contract events; malicious/wrong wallet or orderRef rejected; keeper settles mock stock; pause and refund; merchant fulfillment; Bankr job response appears without claiming a loan.

## Remaining blockers
No live contract deployment, independent audit, real stock-issuer permission, customer-specific Bankr authorization, card payments, generalized shipping/tax, bankr credentials or full CI build is supplied. The project is *not* real-tokenized-equity or lending production ready. Some third-party behavior may change.
