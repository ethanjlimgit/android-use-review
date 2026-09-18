#!/bin/bash
#
# Setup git hooks for this repository
#
# Usage: ./scripts/setup-hooks.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_SOURCE="$SCRIPT_DIR/hooks"
HOOKS_TARGET="$REPO_ROOT/.git/hooks"

echo "🔧 Setting up git hooks..."

# Check if we're in a git repository
if [[ ! -d "$REPO_ROOT/.git" ]]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Install post-commit hook
if [[ -f "$HOOKS_SOURCE/post-commit" ]]; then
    cp "$HOOKS_SOURCE/post-commit" "$HOOKS_TARGET/post-commit"
    chmod +x "$HOOKS_TARGET/post-commit"
    echo "✅ Installed post-commit hook (auto-tagging on version change)"
fi

echo ""
echo "🎉 Git hooks installed successfully!"
echo ""
echo "Available hooks:"
echo "  • post-commit: Auto-creates git tag when version changes in gradle.properties"
echo ""
echo "To uninstall, run: rm .git/hooks/post-commit"
