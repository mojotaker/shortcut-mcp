# Shortcut MCP Server

A Model Context Protocol (MCP) server that interfaces with the Shortcut Project Management API. This server enables AI agents to create and manage Epics, Stories, and Tasks in Shortcut.

## Features

- **Create Epic**: Create a new Epic (`create_epic`)
- **Create Story**: Create a new Story/Ticket (`create_story`)
- **Create Task**: Create a Task within a Story (`create_task`)
- **Get Story**: Retrieve story details (`get_story`)
- **Search Stories**: Search for stories (`search_stories`)
- **List Workflows**: List workflows and states to get `workflow_state_id` (`list_workflows`)

## Prerequisities

- Node.js (v18 or higher)
- A Shortcut API Token. Generate one [here](https://app.shortcut.com/settings/account/api-tokens).

## Installation & Build

1.  Clone/Enter this repository:
    ```bash
    cd shortcut-mcp
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the server:
    ```bash
    npm run build
    ```
    The build output will be in the `dist/` directory.

## Configuration

To use this server with an MCP client (like Claude Desktop, Cursor, or VS Code MCP extensions), you need to configure it with the command to run the server and your API token.

### Environment Variables

- `SHORTCUT_API_TOKEN`: **Required**. Your Shortcut API Token.

### 1. Claude Desktop App

Edit your configuration file (usually found at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS).

```json
{
  "mcpServers": {
    "shortcut": {
      "command": "node",
      "args": [
        "C:\\Users\\Moyo\\Documents\\Projects\\shortcut-mcp\\dist\\index.js"
      ],
      "env": {
        "SHORTCUT_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

> **Note**: Update the path in `args` to match the absolute path where you cloned/created the project.

### 2. Cursor

Cursor currently supports adding MCP servers via its settings panel.

1.  Open Cursor Settings (`Ctrl/Cmd + ,`).
2.  Navigate to **Features** > **MCP Servers**.
3.  Click **+ Add New MCP Server**.
4.  Fill in the details:
    -   **Name**: `shortcut`
    -   **Type**: `command` (or stdio)
    -   **Command**: `node C:\Users\Moyo\Documents\Projects\shortcut-mcp\dist\index.js`
5.  **Important**: Currently, Cursor UI might not have a dedicated field for Environment Variables for every server type yet. If it doesn't, you can create a wrapper script or use `cross-env` in the command:
    
    **Command**: 
    ```bash
    npx -y cross-env SHORTCUT_API_TOKEN=your-token-here node C:\Users\Moyo\Documents\Projects\shortcut-mcp\dist\index.js
    ```

### 3. VS Code (Generic MCP Extension)

If you are using an MCP extension for VS Code (like "MCP Server" or similar):

1.  Locate the extension's configuration settings in `.vscode/settings.json` or User Settings.
2.  Add the server configuration following the extension's schema. It typically looks like:

```json
"mcp.servers": {
    "shortcut": {
        "command": "node",
        "arguments": ["C:\\Users\\Moyo\\Documents\\Projects\\shortcut-mcp\\dist\\index.js"],
        "env": {
            "SHORTCUT_API_TOKEN": "your-token-here"
        }
    }
}
```

### 4. Antigravity / General Client

For other clients, lookup their MCP configuration file (often `mcp_config.json` or similar). The configuration structure usually follows the standard:

```json
{
  "mcpServers": {
    "shortcut": {
      "command": "node",
      "args": ["C:/Users/Moyo/Documents/Projects/shortcut-mcp/dist/index.js"],
      "env": {
        "SHORTCUT_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Usage Tips

- **Finding Workflow State IDs**: Before creating a story, you usually need to know the `workflow_state_id` (e.g., "Ready for Dev", "In Progress"). Use the `list_workflows` tool first to find these IDs.
- **Group/Team IDs**: Similarly, `create_story` often benefits from a `group_id` (Team). You can find these via `create_epic` or by inspecting existing stories via `get_story` or `search_stories`.
