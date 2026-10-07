#!/usr/bin/env bash
# Rebuild public/wasm/ct_kernel.wasm from wasm/ct-kernel/assembly/index.ts.
# Toolchain: AssemblyScript 0.28.20 (pure npm package, fetched on demand by npx; needs Node >= 18 and network on first run).
# The built .wasm is committed, so `npm run build` / Vercel never need this step.
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes --package assemblyscript@0.28.20 -- asc wasm/ct-kernel/assembly/index.ts \
  --outFile public/wasm/ct_kernel.wasm --runtime stub --optimizeLevel 3 --shrinkLevel 1 --noAssert
ls -l public/wasm/ct_kernel.wasm
sha256sum public/wasm/ct_kernel.wasm 2>/dev/null || shasum -a 256 public/wasm/ct_kernel.wasm
