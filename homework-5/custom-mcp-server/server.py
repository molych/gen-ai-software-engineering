"""Custom MCP server (FastMCP) exposing a lorem-ipsum resource and a read tool.

Resources are URIs Claude can read from (here: the lorem-ipsum.md source file,
sliced to a requested word count). Tools are actions Claude calls to perform
an operation (here: the "read" tool, which returns the same word-limited
content on demand, with an argument instead of a URI).
"""

from pathlib import Path

from fastmcp import FastMCP

LOREM_IPSUM_PATH = Path(__file__).parent / "lorem-ipsum.md"
DEFAULT_WORD_COUNT = 30

mcp = FastMCP("custom-mcp-server")


def _read_words(word_count: int = DEFAULT_WORD_COUNT) -> str:
    """Return the first `word_count` words of lorem-ipsum.md."""
    text = LOREM_IPSUM_PATH.read_text(encoding="utf-8")
    words = text.split()
    return " ".join(words[:word_count])


@mcp.resource("resource://lorem-ipsum")
def lorem_ipsum_default() -> str:
    """Default lorem-ipsum resource: first 30 words of lorem-ipsum.md."""
    return _read_words(DEFAULT_WORD_COUNT)


@mcp.resource("resource://lorem-ipsum/{word_count}")
def lorem_ipsum_with_count(word_count: int) -> str:
    """Lorem-ipsum resource template: first `word_count` words of lorem-ipsum.md."""
    return _read_words(word_count)


@mcp.tool(name="read")
def read(word_count: int = DEFAULT_WORD_COUNT) -> str:
    """Return the first `word_count` words (default 30) from lorem-ipsum.md."""
    return _read_words(word_count)


if __name__ == "__main__":
    mcp.run()
