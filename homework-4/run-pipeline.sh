#!/usr/bin/env bash
#
# 4-Agent Bug-Fix Pipeline runner.
#
# Runs the 4 required agents (agents/*.agent.md) against one ticket, in order,
# as non-interactive `claude -p` sessions -- one command, no manual invocation
# between steps. Each stage's model/tool restrictions come straight from that
# agent's own frontmatter, so a stage literally cannot use a tool its
# *.agent.md doesn't grant it (e.g. Security Verifier has no Edit tool at all).
#
# Run order: Bug Research Verifier -> Bug Fixer -> Security Verifier -> Unit Test Generator
# (matches TASKS.md; Bug Researcher / Bug Planner are upstream, human/manual
# steps that are not part of the 4 required agents, so this script expects
# their outputs -- codebase-research.md and implementation-plan.md -- to
# already exist for the given ticket).
#
# Usage:
#   ./run-pipeline.sh [--dry-run] [ticket-id]     # ticket-id defaults to 001
#
# --dry-run prints exactly what would be run (model, tools, prompt) for every
# stage without calling `claude` or touching any file -- safe to use to sanity
# check the script itself.

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi
TICKET="${1:-001}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

TICKET_DIR="context/bugs/$TICKET"
LOG_DIR="$TICKET_DIR/pipeline-logs"

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: required input not found: $1" >&2
    echo "This pipeline automates the 4 required agents (Research Verifier, Bug Fixer," >&2
    echo "Security Verifier, Unit Test Generator). It expects bug-context.md," >&2
    echo "research/codebase-research.md, and implementation-plan.md to already exist" >&2
    echo "for ticket $TICKET (produced upstream by Bug Researcher / Bug Planner)." >&2
    exit 1
  fi
}

require_file "$TICKET_DIR/bug-context.md"
require_file "$TICKET_DIR/research/codebase-research.md"
require_file "$TICKET_DIR/implementation-plan.md"

mkdir -p "$LOG_DIR"

if [[ "$DRY_RUN" != "1" ]] && ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: 'claude' CLI not found on PATH." >&2
  exit 1
fi

# --- read an agent's frontmatter / body -------------------------------------

agent_model() {
  sed -n 's/^model: *//p' "$1" | head -1
}

agent_tools() {
  sed -n 's/^tools: *\[\(.*\)\]/\1/p' "$1" | head -1 | tr -d ' '
}

agent_body() {
  awk '/^---$/{c++; next} c>=2' "$1"
}

file_mtime() {
  [[ -f "$1" ]] || { echo 0; return; }
  stat -f%m "$1" 2>/dev/null || stat -c%Y "$1"
}

# --- run one pipeline stage as a fresh, non-interactive claude session ------

run_stage() {
  local label="$1" agent_file="$2" user_prompt="$3" expect_file="$4"
  local model tools log_file before_mtime after_mtime

  model="$(agent_model "$agent_file")"
  tools="$(agent_tools "$agent_file")"
  log_file="$LOG_DIR/$(basename "$agent_file" .agent.md).log"

  echo ""
  echo "===================================================================="
  echo "STAGE: $label"
  echo "Agent:  $agent_file"
  echo "Model:  $model"
  echo "Tools:  $tools"
  echo "===================================================================="

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] would run:"
    echo "  claude -p \"$user_prompt\" \\"
    echo "    --append-system-prompt <body of $agent_file, $(agent_body "$agent_file" | wc -l | tr -d ' ') lines> \\"
    echo "    --model \"$model\" --tools \"$tools\" --permission-mode bypassPermissions \\"
    echo "    --no-session-persistence --output-format text"
    echo "[dry-run] expected output file: $expect_file"
    return 0
  fi

  before_mtime="$(file_mtime "$expect_file")"

  claude -p "$user_prompt" \
    --append-system-prompt "$(agent_body "$agent_file")" \
    --model "$model" \
    --tools "$tools" \
    --permission-mode bypassPermissions \
    --no-session-persistence \
    --output-format text | tee "$log_file"

  if [[ ! -f "$expect_file" ]]; then
    echo "ERROR: $label did not produce the expected output file: $expect_file" >&2
    echo "Stopping pipeline. See $log_file for the agent's transcript." >&2
    exit 1
  fi
  after_mtime="$(file_mtime "$expect_file")"
  if [[ "$after_mtime" == "$before_mtime" ]]; then
    echo "ERROR: $label ran but did not update $expect_file. Stopping pipeline." >&2
    echo "See $log_file for the agent's transcript." >&2
    exit 1
  fi
  echo "OK: $expect_file written."
}

echo "4-Agent Pipeline -- ticket $TICKET"
echo "Run order: Bug Research Verifier -> Bug Fixer -> Security Verifier -> Unit Test Generator"
[[ "$DRY_RUN" == "1" ]] && echo "(dry run -- no claude sessions will be started, no files will change)"

run_stage "1/4 Bug Research Verifier" \
  "agents/research-verifier.agent.md" \
  "Ticket: $TICKET. Verify context/bugs/$TICKET/research/codebase-research.md per your role instructions." \
  "$TICKET_DIR/research/verified-research.md"

run_stage "2/4 Bug Fixer" \
  "agents/bug-fixer.agent.md" \
  "Ticket: $TICKET. Apply context/bugs/$TICKET/implementation-plan.md per your role instructions." \
  "$TICKET_DIR/fix-summary.md"

if [[ "$DRY_RUN" != "1" ]]; then
  echo ""
  echo "Confirming the full test suite is green after the Bug Fixer stage..."
  if ! npm test; then
    echo "ERROR: npm test failed after the Bug Fixer stage." >&2
    echo "Stopping pipeline before Security Verifier / Unit Test Generator." >&2
    exit 1
  fi
fi

run_stage "3/4 Security Verifier" \
  "agents/security-verifier.agent.md" \
  "Ticket: $TICKET. Review the changes documented in context/bugs/$TICKET/fix-summary.md per your role instructions." \
  "$TICKET_DIR/security-report.md"

run_stage "4/4 Unit Test Generator" \
  "agents/unit-test-generator.agent.md" \
  "Ticket: $TICKET. Generate tests for the changes documented in context/bugs/$TICKET/fix-summary.md per your role instructions." \
  "$TICKET_DIR/test-report.md"

echo ""
echo "===================================================================="
echo "Pipeline complete for ticket $TICKET."
echo "===================================================================="
echo "Outputs:"
echo "  - $TICKET_DIR/research/verified-research.md"
echo "  - $TICKET_DIR/fix-summary.md"
echo "  - $TICKET_DIR/security-report.md"
echo "  - $TICKET_DIR/test-report.md"
echo "Per-stage transcripts: $LOG_DIR/"
