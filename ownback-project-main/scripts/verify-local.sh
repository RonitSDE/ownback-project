#!/usr/bin/env bash
# Full local Anvil verification, from source to first purchase, comeback, refunds, second campaign.
set -euo pipefail
cd "$(dirname "$0")/.."
for binary in node npm forge anvil; do command -v "$binary" >/dev/null || { echo "Missing required tool: $binary"; exit 2; }; done

npm ci
./contracts/install-deps.sh
npm test
npm run release:preflight
npm run test:contracts

# The following keys are Foundry's PUBLIC Anvil development keys. Never use on public networks.
export DEPLOYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export KEEPER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

anvil --silent --chain-id 31337 --port 8545 > /tmp/ownback-anvil.log 2>&1 &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true' EXIT
for i in {1..30}; do
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then cat /tmp/ownback-anvil.log; exit 1; fi
  if curl -fsS -H 'content-type: application/json' --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' http://127.0.0.1:8545 >/dev/null 2>&1; then break; fi
  sleep 1
done

(cd contracts && forge script script/DeployTestnet.s.sol:DeployTestnet --rpc-url http://127.0.0.1:8545 --broadcast)
npm run e2e:local
npm run write:local-env
npm run check
npm run build

echo 'LOCAL CONTRACT + CHECKOUT + KEEPER + FRONTEND BUILD VERIFIED'
echo 'To test browser: start anvil/deploy locally again, then npm run dev and npm run test:e2e.'
