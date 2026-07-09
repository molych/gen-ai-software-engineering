import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture
def tmp_shared(tmp_path) -> Path:
    """An isolated shared/{input,processing,output,results} tree, separate
    from the project's real shared/ directory, for orchestrator tests."""
    shared_root = tmp_path / "shared"
    for sub in ("input", "processing", "output", "results"):
        (shared_root / sub).mkdir(parents=True)
    return shared_root
