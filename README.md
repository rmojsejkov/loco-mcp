# Loco MCP

An MCP server for safely inspecting Loco projects, finding missing translation
keys, validating PO files, and importing new fuzzy translations. It works with
VS Code, Codex, Claude Code, and other stdio MCP hosts.

## Requirements

- Node.js 20 or newer;
- a Loco service API key with access to the target project.

You do not need to clone this repository or install the package globally. The
MCP host runs the published package through `npx`.

## VS Code installation

Create `.vscode/mcp.json` in your project:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "loco-api-key",
      "description": "Loco service API key",
      "password": true
    }
  ],
  "servers": {
    "loco": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@rmojsejkov/loco-mcp"],
      "env": {
        "LOCO_API_KEY": "${input:loco-api-key}",
        "LOCO_IMPORT_LOCALE": "de",
        "LOCO_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

Open the Command Palette, run `MCP: List Servers`, and start `loco`. VS Code
will ask for the API key without storing it in the repository.

## Codex installation

Create `.codex/config.toml` in your project:

```toml
[mcp_servers.loco]
command = "npx"
args = ["-y", "@rmojsejkov/loco-mcp"]
cwd = "."
env = { LOCO_IMPORT_LOCALE = "de", LOCO_WORKSPACE_ROOT = "." }
startup_timeout_sec = 30
tool_timeout_sec = 120
```

Create an ignored `.env.loco` file in the project root:

```text
LOCO_API_KEY=<service key>
```

Restart Codex and run `codex mcp list` to verify that `loco` is enabled.

## Claude Code installation

Create `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "loco": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@rmojsejkov/loco-mcp"],
      "env": {
        "LOCO_IMPORT_LOCALE": "de",
        "LOCO_WORKSPACE_ROOT": "${CLAUDE_PROJECT_DIR:-.}"
      }
    }
  }
}
```

Use the same ignored `.env.loco` file shown above, restart Claude Code, and run
`/mcp` to verify the connection.

## Safety model

The server exposes bounded read tools plus one additive write tool. It does not
expose generic HTTP, delete, overwrite, tag, untag, or arbitrary import-option
operations.

`loco_import_po`:

- accepts only regular `.po` files inside `LOCO_WORKSPACE_ROOT`;
- verifies the configured Loco project before importing;
- rejects the complete import if any Asset ID already exists;
- imports into the configured locale with `ignore-existing`, `ignore-blank`,
  and `flag-new=fuzzy` hardcoded;
- verifies that every new asset and fuzzy translation exists after import.

## Configuration

| Variable              | Required | Description                                                                                |
| --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `LOCO_API_KEY`        | Yes      | Loco service API key. Never pass it as a command argument.                                 |
| `LOCO_PROJECT_NAME`   | No       | Exact Loco project name. Defaults to the workspace directory name.                         |
| `LOCO_IMPORT_LOCALE`  | No       | Fixed import locale. Defaults to `de`.                                                     |
| `LOCO_WORKSPACE_ROOT` | No       | Only directory from which PO files may be read. Defaults to the process working directory. |
| `LOCO_ENV_FILE`       | No       | Optional environment file path. Defaults to `<workspace>/.env.loco`.                       |

The environment file uses this format:

```text
LOCO_API_KEY=<service key>
```

If the workspace directory name differs from the Loco project name, add
`LOCO_PROJECT_NAME` with the exact Loco project name to the server environment.
Ready-to-copy configurations are also available in `examples/`.

## Tools

- `loco_verify_project`
- `loco_list_assets`
- `loco_find_missing_assets`
- `loco_get_asset`
- `loco_get_translation`
- `loco_validate_po`
- `loco_import_po`

## Local development

```sh
npm install
npm run typecheck
npm test
npm run build
```

The built executable is `dist/index.js`.
