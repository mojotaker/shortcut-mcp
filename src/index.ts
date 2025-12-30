#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const API_TOKEN = process.env.SHORTCUT_API_TOKEN;
const BASE_URL = "https://api.app.shortcut.com/api/v3";

if (!API_TOKEN) {
  console.error("Error: SHORTCUT_API_TOKEN environment variable is required");
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Shortcut-Token": API_TOKEN,
    "Content-Type": "application/json",
  },
});

const server = new Server(
  {
    name: "shortcut-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

interface ShortcutError {
  message: string;
  errors?: Record<string, string[]>;
}

function formatError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ShortcutError | undefined;
    if (data?.message) {
      let msg = data.message;
      if (data.errors) {
        const details = Object.entries(data.errors)
          .map(([key, msgs]) => `${key}: ${msgs.join(", ")}`)
          .join("; ");
        msg += ` (${details})`;
      }
      return msg;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_epic",
        description: "Create a new Epic in Shortcut",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the epic" },
            description: { type: "string", description: "Description of the epic" },
            group_id: { type: "string", description: "Group (Team) ID" },
          },
          required: ["name"],
        },
      },
      {
        name: "create_story",
        description: "Create a new Story (Ticket) in Shortcut",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Title of the story" },
            description: { type: "string", description: "Description of the story" },
            workflow_state_id: { type: "integer", description: "Workflow state ID (required)" },
            group_id: { type: "string", description: "Group (Team) ID" },
            epic_id: { type: "integer", description: "Epic ID this story belongs to" },
            story_type: { 
              type: "string", 
              enum: ["feature", "bug", "chore"],
              description: "Type of story (default: feature)" 
            },
          },
          required: ["name", "workflow_state_id"],
        },
      },
      {
        name: "create_task",
        description: "Create a new Task within a Story in Shortcut",
        inputSchema: {
          type: "object",
          properties: {
            story_id: { type: "integer", description: "ID of the story to add task to" },
            description: { type: "string", description: "Description of the task" },
            complete: { type: "boolean", description: "Whether the task is completed" },
          },
          required: ["story_id", "description"],
        },
      },
      {
        name: "get_story",
        description: "Get details of a specific Story",
        inputSchema: {
          type: "object",
          properties: {
            story_id: { type: "integer", description: "ID of the story" },
          },
          required: ["story_id"],
        },
      },
      {
        name: "search_stories",
        description: "Search for stories in Shortcut",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            page_size: { type: "integer", description: "Number of results to return (default: 25)" },
          },
          required: ["query"],
        },
      },
      {
        name: "update_story",
        description: "Update a Story in Shortcut (move to new state, change name/description, etc)",
        inputSchema: {
          type: "object",
          properties: {
            story_id: { type: "integer", description: "ID of the story to update" },
            name: { type: "string", description: "New title of the story" },
            description: { type: "string", description: "New description of the story" },
            workflow_state_id: { type: "integer", description: "New Workflow state ID" },
            archived: { type: "boolean", description: "Archive the story" },
            group_id: { type: "string", description: "New Group (Team) ID" },
            epic_id: { type: "integer", description: "New Epic ID" },
          },
          required: ["story_id"],
        },
      },
       {
        name: "list_workflows",
        description: "List all workflows and their states. Use this to find workflow_state_id.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "create_epic": {
        const { name, description, group_id } = request.params.arguments as any;
        const response = await client.post("/epics", {
          name,
          description,
          group_id,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "create_story": {
        const { name, description, workflow_state_id, group_id, epic_id, story_type } = request.params.arguments as any;
        const response = await client.post("/stories", {
          name,
          description,
          workflow_state_id,
          group_id,
          epic_id,
          story_type: story_type || "feature",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "create_task": {
        const { story_id, description, complete } = request.params.arguments as any;
        const response = await client.post(`/stories/${story_id}/tasks`, {
          description,
          complete: complete || false,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "get_story": {
         const { story_id } = request.params.arguments as any;
         const response = await client.get(`/stories/${story_id}`);
         return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "search_stories": {
        const { query, page_size } = request.params.arguments as any;
        const response = await client.get("/search/stories", {
            params: {
                query,
                page_size: page_size || 25
            }
        });
         return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "list_workflows": {
         const response = await client.get("/workflows");
         // Simplify output to just show names and state IDs
         const workflows = response.data.map((wf: any) => ({
             name: wf.name,
             id: wf.id,
             states: wf.states.map((st: any) => ({
                 name: st.name,
                 id: st.id,
                 type: st.type
             }))
         }));
         return {
          content: [
            {
              type: "text",
              text: JSON.stringify(workflows, null, 2),
            },
          ],
        };
      }

      case "update_story": {
        const { story_id, name, description, workflow_state_id, archived, group_id, epic_id } = request.params.arguments as any;
        const response = await client.put(`/stories/${story_id}`, {
          name,
          description,
          workflow_state_id,
          archived,
          group_id,
          epic_id
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${formatError(error)}`,
        },
      ],
      isError: true,
    };
  }
});

server.connect(new StdioServerTransport());
console.error("Shortcut MCP server running on stdio");
