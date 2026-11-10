# Package status and audit

Base: user-provided `OWNBACK-v3_3-final.zip`. Commerce backend: prior OWNBACK V4 Commerce source merged into v3.3 rather than replacing reward contracts.

Implemented: merged `/commerce` and `/commerce/admin` plus `/api/commerce/*`, Postgres SQL and reconciliation, updated Bankr `/wallet/me`, new allowlisted read-only `/api/agent/research` with expiring HMAC job retrieval, permanently disabled shared-key `/api/agent/borrow`, corrected public copy, authenticated observed-retention analytics, and new `/protocol` showcase.

**Important:** the source dependency lock is inherited from v3.3 and does NOT yet include the merged `pg` dependency. This environment cannot access the npm registry. The first step on a networked developer machine is `npm install --package-lock-only` and commit the regenerated package-lock before running `npm ci`. The package is NOT clean-install verified until then.

No live Bankr account, external model credits, PostgreSQL service, full Next.js production compilation, real chain receipt, or Solidity tests were run in this session. Do not treat absence of errors in source review as validation of these services.

Bankr's Agent API reports completed jobs in `response` and `richData`; job completion is not onchain execution. The public write path remains blocked.
