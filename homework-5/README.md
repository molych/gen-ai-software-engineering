# Homework 5: Configure MCP Servers

**Author:** Oleksandr Mochalov ([@molych](https://github.com/molych))

## Overview

This project configures four Model Context Protocol (MCP) servers so that an
MCP-aware client (Claude Code / Claude Desktop) can interact with GitHub, the
local filesystem, Notion, and a custom-built server:

1. **GitHub MCP** ([`github/github-mcp-server`](https://github.com/github/github-mcp-server),
   run via Docker) — lets Claude list/inspect pull requests, issues, and
   commits on a real repository.
2. **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`) — lets
   Claude list files and read file contents from a chosen local directory.
3. **Notion MCP** (`@notionhq/notion-mcp-server`) — lets Claude query a
   connected Notion workspace, e.g. for the last 5 bug pages/tickets on a
   project.
4. **Custom MCP server** (`custom-mcp-server/`) — a server built from
   scratch with [FastMCP](https://gofastmcp.com) that exposes:
   - a **Resource** (`resource://lorem-ipsum` and the templated
     `resource://lorem-ipsum/{word_count}`) that reads `lorem-ipsum.md` and
     returns the first `word_count` words (default `30`), and
   - a **Tool** named `read` that takes an optional `word_count` argument
     and returns the same word-limited content.

All four servers are registered in [`.mcp.json`](./.mcp.json). See
[`HOWTORUN.md`](./HOWTORUN.md) for setup, run, and test instructions, and
[`docs/screenshots/`](./docs/screenshots/) for evidence of each server's
successful interaction.

## Resources vs. Tools

- **Resources** are URIs that Claude *reads from* — like a file or an API
  endpoint. They are addressed (e.g. `resource://lorem-ipsum/30`) and return
  data, but they don't take an open-ended action.
- **Tools** are actions Claude *calls* — functions with arguments that can
  perform an operation (read a file, run a command, hit an API) and return a
  result. The custom server's `read` tool wraps the same underlying logic as
  the resource, but is invoked like a function call (`read(word_count=30)`)
  rather than read like a URI.

## Project Structure

```
homework-5/
├── README.md
├── HOWTORUN.md
├── .mcp.json
├── custom-mcp-server/
│   ├── server.py
│   ├── lorem-ipsum.md
│   └── requirements.txt
└── docs/
    └── screenshots/
        ├── github-mcp-result.png
        ├── filesystem-mcp-result.png
        ├── jira-or-notion-mcp-result.png
        └── custom-mcp-read-tool-result.png
```
