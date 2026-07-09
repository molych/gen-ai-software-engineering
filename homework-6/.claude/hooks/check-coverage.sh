#!/usr/bin/env bash
# Coverage-gate hook (PreToolUse, matcher "Bash", see .claude/settings.json).
#
# Blocks `git push` if `pytest --cov=pipeline --cov-fail-under=80` fails.
# Every other Bash command passes through untouched.

set -uo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# Only act on git push commands.
if [[ ! "$command" =~ (^|[[:space:]\&\;])git[[:space:]]+push([[:space:]]|$|\&|\;) ]]; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$project_dir" || exit 0

python_bin="python3"
if [ -x "$project_dir/.venv/bin/python" ]; then
  python_bin="$project_dir/.venv/bin/python"
fi

log_file="$project_dir/.claude/hooks/.coverage-gate.log"

if "$python_bin" -m pytest --cov=pipeline --cov-report=term-missing --cov-fail-under=80 -q > "$log_file" 2>&1; then
  exit 0
fi

pct=$(grep -Eo 'TOTAL.*[0-9]+%' "$log_file" | grep -Eo '[0-9]+%' | tail -1)
message="Coverage gate failed (${pct:-below 80%} on pipeline/, required >= 80%); git push blocked. See $log_file for the full pytest-cov report."

printf '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": %s}' \
  "$(printf '%s' "$message" | jq -Rs .)" >&2
exit 2
