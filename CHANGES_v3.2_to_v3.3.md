# v3.2 → v3.3

## Bankr integration (Agentic Stock Finance)

- **Real Bankr Agent API client** (`src/lib/bankr/client.ts`) built from Bankr's public docs: async
  `/agent/prompt` → `/agent/job/{id}` polling, synchronous `/wallet/submit`, `X-API-Key` auth, typed errors.
- **"Borrow against your reward" now has two paths**: your own wallet (always on) or your Bankr agent
  (one tap, when a key is configured). The stock does real work either way.
- Server-only key handling: `BANKR_API_KEY` never reaches the browser; `/api/agent/status` and
  `/api/agent/borrow` routes.
- `npm run bankr:check` verifies the client against the live Bankr API before a demo.
- 8 Bankr unit tests (job lifecycle, snake_case normalisation, auth/timeout errors, submit, prompts).
- Graceful degradation: no key → the Bankr button is hidden, the wallet path is unchanged.
- Docs: BANKR.md.

## Agent borrow security

- **Off by default.** The borrow action and route stay disabled until `BANKR_BORROW_ENABLED=true`.
- Per-IP rate limiting (5/min, 429 + Retry-After), a per-borrow USDC cap, 2 KB body limit, and strict
  pattern validation of symbol/collateral/amount before any prompt is built.
- Server-only key access; `no-store` on agent routes. 8 new security unit tests.

## Frontend polish

- **New landing hero**: product receipt visual (pay → earn stock → borrowable), visible nav buttons
  (the old dark-on-dark buttons were invisible), trust row, agent-native pillar. The dead hero gap is gone.
- Agent action styling; four-pillar value row; tightened section headings.

## Verified

- 43 Foundry tests, 50 unit tests, lint/types/format/build clean, full real-browser journey passes with
  zero console errors, agent status + health routes confirmed serving.

## Not verified here

- The live Bankr API (run `npm run bankr:check` with a real key) and the live Coinbase price API.
- Base Sepolia deployment; independent audit.
