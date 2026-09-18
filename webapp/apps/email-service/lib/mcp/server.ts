import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContactTools } from "./tools/contacts";
import { registerCampaignTools } from "./tools/campaigns";
import { registerSegmentTools } from "./tools/segments";
import { registerSenderTools } from "./tools/senders";
import { registerListTools } from "./tools/lists";

export function createServer(projectId: string): McpServer {
  const server = new McpServer({
    name: "email-service",
    version: "1.0.0",
  });

  registerContactTools(server, projectId);
  registerCampaignTools(server, projectId);
  registerSegmentTools(server, projectId);
  registerSenderTools(server, projectId);
  registerListTools(server, projectId);

  return server;
}
