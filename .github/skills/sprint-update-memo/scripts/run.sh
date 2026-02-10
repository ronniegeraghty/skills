#!/usr/bin/env bash
#
# Run the Sprint Update Memo skill pipeline.
#
# Usage:
#   ./run.sh                    # Interactive mode
#   ./run.sh --sprint 12        # Generate report for Sprint 12
#   ./run.sh --sprint 12 --no-prompt  # Non-interactive mode
#

set -e

# Navigate to skill directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
cd "$SKILL_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Run the pipeline with all arguments
echo "Running Sprint Update Memo pipeline..."
pnpm exec tsx scripts/run.ts "$@"
