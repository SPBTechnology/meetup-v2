#!/usr/bin/env bash
# Remove the Maestro toolchain installed by scripts/setup-maestro.sh.
#
#   npm run maestro:teardown               # removes Maestro CLI + the openjdk@17 formula
#   npm run maestro:teardown -- --keep-java   # removes only the Maestro CLI
set -euo pipefail

KEEP_JAVA=false
for arg in "$@"; do
  case "$arg" in
    --keep-java) KEEP_JAVA=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

# Maestro is installed via its own installer (not Homebrew — see setup-maestro.sh
# for why), so it lives under ~/.maestro. The brew lines are a harmless no-op
# safety net in case a Homebrew install was ever completed on another machine.
rm -rf "$HOME/.maestro"
brew list maestro >/dev/null 2>&1 && brew uninstall maestro
brew untap mobile-dev-inc/tap >/dev/null 2>&1 || true

if [ "$KEEP_JAVA" = false ]; then
  brew list openjdk@17 >/dev/null 2>&1 && brew uninstall openjdk@17
fi

echo "Done. Remove the JAVA_HOME/PATH lines from your shell profile if you added them."
