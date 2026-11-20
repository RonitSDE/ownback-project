# OWNBACK v3.10.10 — Developer handoff (Nov 19, 2026)

**What changed:** Kept GitHub role navigation; added differentiator on `/` and `/judge`; restored `/verify`, the six policy explanations, source-captured proof links and X share metadata; fixed Builder Code recovery harness and missing mini-app icon/artwork; regenerated source manifest. No smart-contract, business-logic or payment-path modifications.

1. Check the merge, then run `npm ci`, `npm run check`, `npm test`, `npm run test:judge`, `npm run simulate:recovery`, `npm run test:contracts`, `npm run build`, `npm run verify:manifest` on a clean machine.
2. Configure Sepolia RPC, Builder Code, server secrets and trusted proxy ingress; run `npm run verify:proofs:strict` and confirm actual attribution on *new* transactions. Do not publish secrets.
3. Deploy staging, smoke-test `/`, `/judge`, `/verify`, `/allocation`, `/growth` and the X preview. Keep the Base Sepolia / MOCK STOCK / NOT_EXECUTED labels visible. Mini-app publishing requires valid account association; do not claim it is published merely because assets exist.
4. Demonstrate **real** fund → first purchase → settlement → second purchase → comeback settlement or state clearly that comeback is not evidenced. Preserve explorers, orderRefs and both eligible/refused policy results.
5. Tag `v3.10.10` only after clean tests; run `npm run judge:gate` on **that exact SHA** with `BASE_SEPOLIA_RPC_URL`. Record the 90s video from that build and share the CI URL, deploy URL, tx hashes and commit SHA.

**Mainnet is NO-GO:** mock assets, stock eligibility/compliance, contract audit, real inventory and production monitoring still remain separate requirements. This ZIP is a candidate, not evidence that deployment or the strict gate passed.

**Additional safeguards:** Shopify email claims are intentionally testnet-only; all mainnet reward lanes stay disabled. Before allowing mainnet orders require independent audit, real B20 inventory liability safety, KYC/jurisdiction and issuer-policy review; do not switch flags to true to bypass.
