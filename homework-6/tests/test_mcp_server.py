"""Tests for mcp/server.py.

Loaded via importlib from its file path rather than `import mcp.server`,
because the top-level `mcp/` directory in this project shadows-but-loses-to
the installed `mcp` pip package (a dependency of fastmcp) which has its own
`mcp.server` submodule.
"""

import importlib.util
import json
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVER_PATH = PROJECT_ROOT / "mcp" / "server.py"


def _load_server_module():
    spec = importlib.util.spec_from_file_location("pipeline_mcp_server_under_test", SERVER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def server(tmp_path, monkeypatch):
    module = _load_server_module()
    results_dir = tmp_path / "results"
    results_dir.mkdir()
    monkeypatch.setattr(module, "RESULTS_DIR", results_dir)
    monkeypatch.setattr(module, "SUMMARY_PATH", results_dir / "_summary.json")
    return module


def test_get_transaction_status_found(server):
    record = {"transaction_id": "TXN001", "final_status": "settled"}
    (server.RESULTS_DIR / "TXN001.json").write_text(json.dumps(record), encoding="utf-8")

    result = server.get_transaction_status("TXN001")
    assert result["found"] is True
    assert result["final_status"] == "settled"


def test_get_transaction_status_not_found(server):
    result = server.get_transaction_status("TXN999")
    assert result["found"] is False
    assert "error" in result


def test_list_pipeline_results(server):
    (server.RESULTS_DIR / "TXN001.json").write_text(
        json.dumps({"transaction_id": "TXN001", "final_status": "settled"}), encoding="utf-8"
    )
    (server.RESULTS_DIR / "TXN002.json").write_text(
        json.dumps({"transaction_id": "TXN002", "final_status": "rejected"}), encoding="utf-8"
    )
    (server.RESULTS_DIR / "_summary.json").write_text(json.dumps({"total": 2}), encoding="utf-8")

    result = server.list_pipeline_results()
    assert result["count"] == 2
    ids = {r["transaction_id"] for r in result["results"]}
    assert ids == {"TXN001", "TXN002"}


def test_list_pipeline_results_empty_when_no_results_dir(tmp_path, monkeypatch):
    module = _load_server_module()
    monkeypatch.setattr(module, "RESULTS_DIR", tmp_path / "does-not-exist")
    result = module.list_pipeline_results()
    assert result == {"count": 0, "results": []}


def test_pipeline_summary_resource_returns_summary_text(server):
    summary = {"total": 8, "settled": 5}
    (server.RESULTS_DIR / "_summary.json").write_text(json.dumps(summary), encoding="utf-8")

    text = server.pipeline_summary()
    assert json.loads(text) == summary


def test_pipeline_summary_resource_handles_missing_summary(server):
    text = server.pipeline_summary()
    assert "No pipeline run yet" in text
