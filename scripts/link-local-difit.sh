#!/usr/bin/env bash

set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "Error: nvm was not found at $NVM_DIR/nvm.sh" >&2
  echo "Install nvm first: https://github.com/nvm-sh/nvm" >&2
  exit 1
fi

# nvm is implemented as a shell function, so its initialization script must be sourced.
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

echo "==> Installing and activating Node.js 24"
nvm install 24
nvm use 24
nvm alias default 24

echo "==> Activating pnpm 11.6.0"
# Corepack downloads directly from registry.npmjs.org and does not honor the
# npm registry configured for this environment.
corepack disable
npm install --global pnpm@11.6.0

echo "==> Installing dependencies"
cd "$project_dir"
pnpm install

echo "==> Building difit"
pnpm build

echo "==> Linking this checkout as the global difit command"
npm link
hash -r

difit_bin="$(command -v difit)"
resolved_bin="$(
  node -e "console.log(require('node:fs').realpathSync(process.argv[1]))" "$difit_bin"
)"

if [[ "$resolved_bin" != "$project_dir/"* ]]; then
  echo "Error: difit resolved outside this checkout: $resolved_bin" >&2
  exit 1
fi

echo
echo "Local difit setup complete."
echo "Command: $difit_bin"
echo "Target:  $resolved_bin"
echo "Version: $(difit --version)"
echo
echo "Open a new terminal (or run 'nvm use 24') before invoking difit."
