#!/usr/bin/env bash
#
# Executive Review Skill - Bash Wrapper
#
# Usage:
#   ./run.sh <file_path> [options]
#
# Examples:
#   ./run.sh demo.mp4 --personas cto,ciso --frames
#   ./run.sh proposal.pdf --all-personas
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "❌ Error: Python is not installed or not in PATH"
        exit 1
    fi
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi

# Run the main script
exec "$PYTHON_CMD" "$SCRIPT_DIR/run.py" "$@"
