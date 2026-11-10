# OWNBACK v3.6 — Source and integration audit

Audit date: November 10, 2026. Baseline: `OWNBACK-v3.5-Hybrid-Shopify-Base-Source.zip`.

## Delivered code

- `/agentic` consumer experience: responsive mobile-first UI with conversational search, verified live results, selected variants, cart summary, illustrative reward preview, buyer-controlled checkout handoff and unambiguous preview/live states.
- UCP JSON-RPC adapter uses Shopify 2026-08-25 `search_catalog`, `lookup_catalog`, `create_cart` interface and `result.structuredContent`, with hosted agent profile.
- API: merchant discovery uses only installed Shopify merchants; UCP calls use fixed merchant origins, URL allowlists, strict variant IDs, resource caps and timeout/redirect protection.
- Source web2/web3 stack preserved: Shopify connect/HMAC webhooks and refund holds, USDC native checkout, merchant rewards, customer claim, Bankr read-only research.
- Source manifest and CI strict `npm ci` (CI no longer mutates the lockfile before installing).

## Verification performed in this environment

- 11/11 agentic unit/integration tests PASS (mocked Shopify UCP; no merchant was contacted).
- 72/72 selected tests PASS (existing backend/business logic and agentic tests combined).
- `npm run release:preflight` PASS.
- `npm run commerce:preflight` PASS.
- `npm run agentic:preflight` PASS.
- All new TypeScript/TSX files parsed with TypeScript parser: zero syntax errors.
- Standalone HTML UX preview has JavaScript syntax verified by Node; **not** a live Next.js rendering.
- Source manifest checked with `scripts/verify-manifest.mjs` after source freeze.

## Not verified / blockers

- `npm ci` remains unverified because npm package registry is unavailable here. The **inherited** lockfile lacks `pg`/`@types/pg`, which causes a clean install failure until `npm install --package-lock-only` is run and committed on a network-connected machine.
- `npm run check` fails with missing dependencies/types. It cannot serve as an app typecheck until installation finishes; do not infer product errors from these missing modules or mark the check passed.
- Next.js production build, Playwright device testing, Foundry compilation and testnet deployments were not executed in this environment.
- No live Shopify UCP connected store, paid-order webhook, customer claim delivery, tokenized-stock execution or Bankr credential was available to verify remotely.
- In-process API rate limits are single-instance only; use distributed rate limiting/WAF prior to public traffic.
- The Shopify Cart MCP endpoint may live on a merchant's custom storefront domain, which must be explicitly approved in environment variables.

## Release decision

**Agentic UI and UCP adapter source candidate; staging validation required.** Do not advertise real tokenized stock ownership or customer-controlled Bankr borrowing. Synthetic testnet stock and research-only Bankr stay correctly labelled.
