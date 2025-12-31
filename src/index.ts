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
            custom_fields: { 
              type: "array", 
              description: "Array of custom fields to update",
              items: {
                type: "object",
                properties: {
                  field_id: { type: "string" },
                  value_id: { type: "string" },
                  value: { type: "string" }
                }
              }
            },
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
      {
        name: "list_stories",
        description: "List all stories, optionally filtered by workflow state",
        inputSchema: {
          type: "object",
          properties: {
            workflow_state_id: { type: "integer", description: "Filter by workflow state ID" },
            page_size: { type: "integer", description: "Number of results (default: 25)" },
          },
        },
      },
      {
        name: "assign_story",
        description: "Assign a story to one or more team members",
        inputSchema: {
          type: "object",
          properties: {
            story_id: { type: "integer", description: "ID of the story to assign" },
            owner_ids: { 
              type: "array", 
              items: { type: "string" },
              description: "Array of member UUIDs to assign as owners" 
            },
          },
          required: ["story_id", "owner_ids"],
        },
      },
      {
        name: "link_story_epic",
        description: "Link a story to an epic",
        inputSchema: {
          type: "object",
          properties: {
            story_id: { type: "integer", description: "ID of the story" },
            epic_id: { type: "integer", description: "ID of the epic to link to (use null to unlink)" },
          },
          required: ["story_id", "epic_id"],
        },
      },
      {
        name: "list_members",
        description: "List all members in the workspace to get member UUIDs for assignment",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_groups",
        description: "List all groups (teams) in the workspace",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_custom_fields",
        description: "List all custom fields in the workspace",
        inputSchema: {
          type: "object",
          properties: {
             query: { type: "string", description: "Search query for field name" },
          },
        },
      },
      {
        name: "add_story_comment",
        description: "Add a comment to a Story",
        inputSchema: {
          type: "object",
          properties: {
            story_id: { type: "integer", description: "ID of the story" },
            text: { type: "string", description: "The comment text" },
          },
          required: ["story_id", "text"],
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
        const { story_id, name, description, workflow_state_id, archived, group_id, epic_id, custom_fields } = request.params.arguments as any;
        const response = await client.put(`/stories/${story_id}`, {
          name,
          description,
          workflow_state_id,
          archived,
          group_id,
          epic_id,
          custom_fields
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

      case "list_stories": {
        const { workflow_state_id, page_size } = request.params.arguments as any;
        // Use search endpoint with empty query to list stories
        const response = await client.get("/search/stories", {
          params: {
            query: workflow_state_id ? `state:${workflow_state_id}` : "",
            page_size: page_size || 25,
          },
        });
        // Simplify output
        const stories = response.data.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          story_type: s.story_type,
          workflow_state_id: s.workflow_state_id,
          owner_ids: s.owner_ids,
          epic_id: s.epic_id,
          app_url: s.app_url,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stories, null, 2),
            },
          ],
        };
      }

      case "assign_story": {
        const { story_id, owner_ids } = request.params.arguments as any;
        const response = await client.put(`/stories/${story_id}`, {
          owner_ids,
        });
        return {
          content: [
            {
              type: "text",
              text: `Story ${story_id} assigned to ${owner_ids.length} owner(s). Updated at: ${response.data.updated_at}`,
            },
          ],
        };
      }

      case "link_story_epic": {
        const { story_id, epic_id } = request.params.arguments as any;
        const response = await client.put(`/stories/${story_id}`, {
          epic_id,
        });
        return {
          content: [
            {
              type: "text",
              text: epic_id 
                ? `Story ${story_id} linked to Epic ${epic_id}. Updated at: ${response.data.updated_at}`
                : `Story ${story_id} unlinked from any epic. Updated at: ${response.data.updated_at}`,
            },
          ],
        };
      }

      case "list_members": {
        const response = await client.get("/members");
        const members = response.data.map((m: any) => ({
          id: m.id,
          name: m.profile.name,
          mention_name: m.profile.mention_name,
          email: m.profile.email_address,
          group_ids: m.group_ids,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(members, null, 2),
            },
          ],
        };
      }

      case "list_groups": {
        const response = await client.get("/groups");
        const groups = response.data.map((g: any) => ({
          id: g.id,
          name: g.name,
          mention_name: g.mention_name,
          description: g.description,
          num_stories_started: g.num_stories_started,
          num_stories: g.num_stories,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(groups, null, 2),
            },
          ],
        };
      }

      case "list_custom_fields": {
        const { query } = request.params.arguments as any;
        const response = await client.get("/custom-fields");
        let fields = response.data.map((f: any) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            values: f.values ? f.values.map((v: any) => ({
                id: v.id,
                value: v.value,
                position: v.position,
                color_key: v.color_key
            })) : []
        }));

        if (query) {
            const lowerQuery = query.toLowerCase();
            fields = fields.filter((f: any) => f.name.toLowerCase().includes(lowerQuery));
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(fields, null, 2),
            },
          ],
        };
      }

      case "add_story_comment": {
        const { story_id, text } = request.params.arguments as any;
        const response = await client.post(`/stories/${story_id}/comments`, {
          text,
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
