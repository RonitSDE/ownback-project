#!/usr/bin/env bash
# Installs pinned Solidity dependencies into contracts/lib. Run once after cloning.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p lib
[ -d lib/openzeppelin-contracts ] || git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
if [ ! -d lib/forge-std ]; then
  git clone https://github.com/foundry-rs/forge-std lib/forge-std
  git -C lib/forge-std checkout dc647cc030d9d65910d8f1172a0cde48d7106e32
fi
echo "Dependencies ready in contracts/lib"
