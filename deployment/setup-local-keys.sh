#!/usr/bin/env bash
set -euo pipefail
umask 077
AIC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AIC_KEYGEN="${AIC_SOLANA_KEYGEN:-$AIC_ROOT/.local/tools/agave/bin/solana-keygen}"
if [[ ! -x "$AIC_KEYGEN" ]]; then AIC_KEYGEN="$(command -v solana-keygen)"; fi
mkdir -p "$AIC_ROOT/.local/keys"
cd "$AIC_ROOT"
for AIC_ROLE in deployer test-payer demo-client demo-creator arbiter deployment-buffer; do
  AIC_FILE=".local/keys/$AIC_ROLE.json"
  if [[ ! -f "$AIC_FILE" ]]; then
    "$AIC_KEYGEN" new --silent --no-bip39-passphrase --outfile "$AIC_FILE" >/dev/null
  fi
  chmod 600 "$AIC_FILE"
  printf '%s: ' "$AIC_ROLE"
  "$AIC_KEYGEN" pubkey "$AIC_FILE"
done
printf '%s\n' 'Only public addresses printed. Generated keys remain in ignored .local/keys/.'
