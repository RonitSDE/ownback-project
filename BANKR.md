# Bankr: read-only research integration — v3.4

The v3.3 publicly accessible Bankr borrow path was unsafe because it used a single operator API key, not the connected customer's Bankr wallet. It is now disabled at `/api/agent/borrow` (403), irrespective of old flags.

Use a dedicated Bankr API key with **read-only** permissions and optional IP restrictions (verify at bankr.bot/api-keys), `BANKR_RESEARCH_ENABLED=true`, `BANKR_API_KEY` and a random `BANKR_JOB_TOKEN_SECRET` (32+ chars). Bankr docs: GET `/wallet/me`, POST `/agent/prompt`, GET `/agent/job/:id`. The prompt is educational, requests no account balances or transaction execution, and is constrained by an allowlist. Job access uses a signed 10-minute receipt. Verify the account key is read-only: the application cannot infer this from a successful authentication probe.

The result screen shows the Bankr **response**, never claims a completed job means a real loan. This integration does not authorize or execute lending. A future production loan feature needs customer-specific provisioning, permitted real assets, validated market position, independent LTV/health checks, a user-approved transaction and verified debt state.

`npm run bankr:check -- --ask` requires a funded or subscribed Bankr account; do not paste keys into browser or public logs.
