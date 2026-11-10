# OWNBACK v3.3 build and verification audit (2026-11-06)

Every result below was executed in the build environment, not inferred.

| Check                                                             | Result                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Solidity compile (solc 0.8.24, via-IR)                            | PASS                                                       |
| Foundry suite                                                     | **43 passed, 0 failed** (incl. 512-run fuzz)               |
| Slither static analysis (102 detectors)                           | No medium or higher findings outstanding (see SECURITY.md) |
| Node unit tests                                                   | **34 passed, 0 failed**                                    |
| ESLint (next/core-web-vitals + typescript)                        | Clean                                                      |
| TypeScript `tsc --noEmit`                                         | Clean                                                      |
| Prettier                                                          | Clean                                                      |
| Next.js production build                                          | PASS (8 routes)                                            |
| Release preflight                                                 | PASS                                                       |
| Local-chain lifecycle (anvil + real keeper)                       | **15/15 checks passed**                                    |
| Real-browser wallet journey (Chromium + injected EIP-6963 wallet) | **8/8 steps passed, zero unexpected console errors**       |
| Served app: routes, 404, `/api/health`, security headers          | PASS                                                       |

Expected in the sandbox and tolerated by the browser test: Google Fonts and `/api/prices` were unreachable (no
outbound network).

## Not verified here

- Live Coinbase Tokenized Stocks API response (`npm run prices:check`)
- Live Bankr Agent API (`npm run bankr:check` with a real bk_ key)
- Base Sepolia deployment and contract verification
- Real wallet extensions (Coinbase Wallet, MetaMask, Rabby) by hand
- Independent security audit
