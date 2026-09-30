#!/usr/bin/env bash
# Install the Maestro UI-test toolchain (Java 17 + Maestro CLI) via Homebrew,
# idempotently. These are machine-wide prerequisites (like Docker Desktop),
# not project-local — undo with scripts/teardown-maestro.sh.
#
#   npm run maestro:setup
set -euo pipefail

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

command -v brew >/dev/null 2>&1 || fail "Homebrew is required: https://brew.sh"

step "Java 17 (Maestro requires 17+; pinned to the 17 LTS formula)"
if brew list openjdk@17 >/dev/null 2>&1; then
  echo "already installed: $(brew list --versions openjdk@17)"
else
  brew install openjdk@17
fi
JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
"$JAVA_HOME/bin/java" -version

step "Maestro CLI"
# Not via Homebrew: the mobile-dev-inc/tap/maestro formula declares its own
# (unversioned) `openjdk` dependency, which Homebrew resolves independently
# of the openjdk@17 above — and on an unsupported/no-bottle macOS version
# (Tier 3, e.g. this machine on macOS 13) that means compiling a second JDK
# from source, which failed here. The official installer avoids this: it
# ships Maestro's own binaries and just needs `java`/JAVA_HOME on PATH,
# which openjdk@17 above already provides.
if command -v maestro >/dev/null 2>&1; then
  echo "already installed: $(maestro --version)"
else
  curl -fsSL "https://get.maestro.mobile.dev" | bash
  export PATH="$HOME/.maestro/bin:$PATH"
fi
maestro --version

step "Done"
cat <<EOF
Add to ~/.zshrc so new shells (and this script, on future runs) find both:

  export JAVA_HOME="$JAVA_HOME"
  export PATH="\$JAVA_HOME/bin:\$HOME/.maestro/bin:\$PATH"

Then: npm run android (build + install the dev client) and npm run test:e2e.
EOF
