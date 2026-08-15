# Loco MCP

Standalone stdio MCP server for safely inspecting and importing translations
in Loco. The same executable can be connected to VS Code, Codex, Claude Code,
or any other MCP host.

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

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

The built executable is `dist/index.js`.

## VS Code

Before the package is published, connect a local checkout from either the
workspace or user `mcp.json`:

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
      "command": "node",
      "args": ["/absolute/path/to/loco-mcp/dist/index.js"],
      "env": {
        "LOCO_API_KEY": "${input:loco-api-key}",
        "LOCO_IMPORT_LOCALE": "de",
        "LOCO_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

After publishing, replace `command` and `args` with:

```json
"command": "npx",
"args": ["-y", "@123fahrschule/loco-mcp"]
```

Ready-to-copy host examples are available in `examples/`.

## Tools

- `loco_verify_project`
- `loco_list_assets`
- `loco_find_missing_assets`
- `loco_get_asset`
- `loco_get_translation`
- `loco_validate_po`
- `loco_import_po`
