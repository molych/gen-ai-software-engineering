"""Custom FastMCP server exposing the transaction pipeline's results.

Mirrors the FastMCP pattern from this repo's homework-5 custom MCP server:
decorator-based tools/resources, run under stdio transport.

Run standalone with: python mcp/server.py
"""

from __future__ import annotations

import json
from pathlib import Path

from fastmcp import FastMCP

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = PROJECT_ROOT / "shared" / "results"
SUMMARY_PATH = RESULTS_DIR / "_summary.json"

mcp = FastMCP("pipeline-status")


def _load_result(transaction_id: str) -> dict | None:
    path = RESULTS_DIR / f"{transaction_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


@mcp.tool(name="get_transaction_status")
def get_transaction_status(transaction_id: str) -> dict:
    """Return the current pipeline status for a single transaction_id, read
    from shared/results/<transaction_id>.json."""
    record = _load_result(transaction_id)
    if record is None:
        return {
            "transaction_id": transaction_id,
            "found": False,
            "error": "no result found for this transaction_id — has the pipeline been run?",
        }
    return {"transaction_id": transaction_id, "found": True, **record}


@mcp.tool(name="list_pipeline_results")
def list_pipeline_results() -> dict:
    """Return a summary of every transaction processed in the most recent
    pipeline run (transaction_id + final_status for each)."""
    if not RESULTS_DIR.exists():
        return {"count": 0, "results": []}

    results = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        if path.name == "_summary.json":
            continue
        record = json.loads(path.read_text(encoding="utf-8"))
        results.append({
            "transaction_id": record.get("transaction_id"),
            "final_status": record.get("final_status"),
        })
    return {"count": len(results), "results": results}


@mcp.resource("pipeline://summary")
def pipeline_summary() -> str:
    """Return the latest pipeline run summary (shared/results/_summary.json) as text."""
    if not SUMMARY_PATH.exists():
        return "No pipeline run yet. Run `python orchestrator.py` to generate a summary."
    return SUMMARY_PATH.read_text(encoding="utf-8")


if __name__ == "__main__":
    mcp.run()
