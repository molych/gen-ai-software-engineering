# How to Run

This guide covers all four MCP servers registered in [`.mcp.json`](./.mcp.json):
`github`, `filesystem`, `notion`, and `custom-mcp-server`.

## 1. Install dependencies

**Custom server (Python / FastMCP):**

```bash
cd custom-mcp-server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**External servers** run via `npx` / `docker`, so nothing needs to be
pre-installed beyond Node.js (for `npx`) and Docker Desktop (for the GitHub
server) — both are fetched/pulled automatically on first run.

## 2. Provide credentials

Export these before launching your MCP client (Claude Code / Claude Desktop),
or put them in your shell profile:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxx..."   # GitHub PAT with repo scope
export NOTION_TOKEN="ntn_xxx..."                    # Notion internal integration token
```

The Filesystem server's directory and the custom server's script path are
already set in `.mcp.json`; update the filesystem path if you want to expose a
different directory.

## 3. Run the servers

You don't start these manually — your MCP client reads `.mcp.json` and spawns
each server as a subprocess on demand. To use this config:

- **Claude Code**: open this repo as your project root; Claude Code
  auto-discovers `.mcp.json` and lists the four servers (`/mcp` shows their
  status).
- **Claude Desktop**: copy the contents of `.mcp.json` into
  `claude_desktop_config.json` (macOS:
  `~/Library/Application Support/Claude/claude_desktop_config.json`) and
  restart Claude Desktop.

To sanity-check the custom server on its own (outside of a client), run it
directly:

```bash
cd custom-mcp-server
python3 server.py
```

It starts and waits on stdio — this is expected; a client connects to it the
same way Claude Code does. Press `Ctrl+C` to stop.

## 4. Connect the MCP configuration

`.mcp.json` at the repo root already registers all four servers:

| Server | Command |
|---|---|
| `github` | `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server` |
| `filesystem` | `npx -y @modelcontextprotocol/server-filesystem <dir>` |
| `notion` | `npx -y @notionhq/notion-mcp-server` |
| `custom-mcp-server` | `python3 custom-mcp-server/server.py` |

Once your client picks up `.mcp.json` (Claude Code does this automatically
for the project it's launched in), each server appears as a distinct MCP
connection with its own tools/resources exposed to Claude.

## 5. Use / test the `read` tool

Once `custom-mcp-server` is connected, in Claude ask:

> "Call the `read` tool with word_count=15"

or, to read the resource directly:

> "Read resource://lorem-ipsum/15"

Both return the first 15 words of `custom-mcp-server/lorem-ipsum.md`.

You can also test it headlessly with the `fastmcp` Python client, without any
chat client at all:

```python
import asyncio
from fastmcp import Client

async def main():
    async with Client("custom-mcp-server/server.py") as client:
        result = await client.call_tool("read", {"word_count": 15})
        print(result.content[0].text)

asyncio.run(main())
```

Expected: exactly 15 words of lorem-ipsum text are printed. Calling `read`
with no arguments returns the default 30 words.

## Resources vs. Tools (recap)

- **Resources** are URIs Claude reads from (e.g. `resource://lorem-ipsum/30`,
  a file, an API endpoint) — addressed data, no side effects.
- **Tools** are actions Claude calls with arguments (e.g. `read(word_count=30)`)
  to perform an operation and get a result back.

See [`docs/screenshots/`](./docs/screenshots/) for evidence that each of the
four servers is connected and returns a real, successful result.
