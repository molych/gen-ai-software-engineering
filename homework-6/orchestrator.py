"""Pipeline orchestrator: drives every transaction in sample-transactions.json
through Validation -> Fraud Detection -> Compliance Check -> Settlement,
using the file-based shared/{input,processing,output,results} protocol
described in specification.md.

Usage:
    python orchestrator.py [--input sample-transactions.json] [--shared-dir shared]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline import compliance_checker, fraud_detector, settlement_processor, validator
from pipeline.common import new_message, now_iso8601, sanitize_for_storage, write_json_atomic

SHARED_SUBDIRS = ("input", "processing", "output", "results")

# (stage_name, target_stage, process_transaction fn) run in order after validation.
POST_VALIDATION_STAGES = (
    ("fraud_detector", "compliance_checker", fraud_detector.process_transaction),
    ("compliance_checker", "settlement_processor", compliance_checker.process_transaction),
    ("settlement_processor", "orchestrator", settlement_processor.process_transaction),
)


def setup_directories(shared_root: Path | str) -> dict[str, Path]:
    """Create (if needed) shared/{input,processing,output,results} and return their paths."""
    shared_root = Path(shared_root)
    dirs = {name: shared_root / name for name in SHARED_SUBDIRS}
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def load_transactions(path: Path | str) -> list[dict]:
    """Load the raw transaction records from a sample-transactions.json file."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _process_one(record: dict, dirs: dict[str, Path], index: int) -> dict:
    transaction_id = record.get("transaction_id") or f"unknown-{index}"

    input_envelope = new_message("orchestrator", "validator", "transaction", sanitize_for_storage(record))
    write_json_atomic(dirs["input"] / f"{transaction_id}.json", input_envelope)

    processing_envelope = new_message("orchestrator", "validator", "transaction", sanitize_for_storage(record))
    write_json_atomic(dirs["processing"] / f"{transaction_id}.json", processing_envelope)

    validator_result = validator.process_transaction(record)

    if validator_result["status"] == "rejected":
        final = dict(validator_result["data"])
        final["transaction_id"] = transaction_id
        final["status"] = "rejected"
        final["reason"] = validator_result["reason"]
        final["final_status"] = "rejected"
        output_envelope = new_message("validator", "orchestrator", "transaction", final)
        write_json_atomic(dirs["output"] / f"{transaction_id}.json", output_envelope)
        return final

    current = dict(validator_result["data"])
    current["transaction_id"] = transaction_id
    current["status"] = "validated"
    previous_stage = "validator"

    for stage_name, target_stage, stage_fn in POST_VALIDATION_STAGES:
        processing_envelope = new_message(previous_stage, stage_name, "transaction", current)
        write_json_atomic(dirs["processing"] / f"{transaction_id}.json", processing_envelope)

        current = stage_fn(current)

        output_envelope = new_message(stage_name, target_stage, "transaction", current)
        write_json_atomic(dirs["output"] / f"{transaction_id}.json", output_envelope)

        previous_stage = stage_name

    return current


def run_pipeline(input_path: Path | str = Path("sample-transactions.json"),
                  shared_root: Path | str = Path("shared")) -> dict:
    """Run every transaction in `input_path` through the full pipeline.

    Writes one JSON file per transaction to shared/results/, plus a
    shared/results/_summary.json report. Returns the summary dict.
    """
    dirs = setup_directories(shared_root)
    records = load_transactions(input_path)

    results = [_process_one(record, dirs, index) for index, record in enumerate(records)]

    for result in results:
        write_json_atomic(dirs["results"] / f"{result['transaction_id']}.json", result)

    summary = {
        "generated_at": now_iso8601(),
        "total": len(results),
        "settled": sum(1 for r in results if r.get("final_status") == "settled"),
        "held_for_review": sum(1 for r in results if r.get("final_status") == "held_for_review"),
        "rejected": sum(1 for r in results if r.get("final_status") == "rejected"),
        "rejection_reasons": {
            r["transaction_id"]: r.get("reason")
            for r in results if r.get("final_status") == "rejected"
        },
        "transactions": [
            {"transaction_id": r["transaction_id"], "final_status": r.get("final_status")}
            for r in results
        ],
    }
    write_json_atomic(dirs["results"] / "_summary.json", summary)
    return summary


def _print_summary(summary: dict) -> None:
    print(f"Total transactions:  {summary['total']}")
    print(f"Settled:             {summary['settled']}")
    print(f"Held for review:     {summary['held_for_review']}")
    print(f"Rejected:            {summary['rejected']}")
    if summary["rejection_reasons"]:
        print("\nRejected transactions:")
        for transaction_id, reason in summary["rejection_reasons"].items():
            print(f"  {transaction_id}: {reason}")
    print(f"\nResults written to shared/results/ (summary: shared/results/_summary.json)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the transaction processing pipeline end-to-end.")
    parser.add_argument("--input", default="sample-transactions.json", type=Path)
    parser.add_argument("--shared-dir", default="shared", type=Path)
    args = parser.parse_args()

    summary = run_pipeline(input_path=args.input, shared_root=args.shared_dir)
    _print_summary(summary)


if __name__ == "__main__":
    main()
