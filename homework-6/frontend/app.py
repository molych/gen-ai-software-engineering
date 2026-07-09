"""Flask front-end for the transaction processing pipeline.

A simple dashboard: shows the latest shared/results/ state (summary counts
+ per-transaction table) and a "Run Pipeline" button that triggers a fresh
run via orchestrator.run_pipeline().

Run with: python frontend/app.py  (serves http://127.0.0.1:5000/)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from flask import Flask, redirect, render_template, url_for  # noqa: E402

from orchestrator import run_pipeline  # noqa: E402

SHARED_RESULTS = PROJECT_ROOT / "shared" / "results"

app = Flask(__name__)


def _load_results() -> tuple[dict | None, list[dict]]:
    summary_path = SHARED_RESULTS / "_summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else None

    records = []
    if SHARED_RESULTS.exists():
        for path in SHARED_RESULTS.glob("*.json"):
            if path.name == "_summary.json":
                continue
            records.append(json.loads(path.read_text(encoding="utf-8")))
    records.sort(key=lambda r: r.get("transaction_id", ""))
    return summary, records


@app.route("/")
def index():
    summary, records = _load_results()
    return render_template("index.html", summary=summary, records=records)


@app.route("/run", methods=["POST"])
def run():
    run_pipeline(input_path=PROJECT_ROOT / "sample-transactions.json", shared_root=PROJECT_ROOT / "shared")
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
