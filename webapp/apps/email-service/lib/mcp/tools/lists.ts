import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/email-prisma";

export function registerListTools(server: McpServer, projectId: string) {
  server.tool(
    "lists_list",
    "List all contact lists with member counts.",
    {},
    async () => {
      const lists = await prisma.contactList.findMany({
        where: { projectId },
        include: { _count: { select: { memberships: true } } },
        orderBy: { createdAt: "desc" },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(lists, null, 2) }] };
    },
  );

  server.tool(
    "list_manage_members",
    "Add or remove contacts from a contact list.",
    {
      listId: z.string().describe("Contact list ID"),
      action: z.enum(["add", "remove"]).describe("Whether to add or remove contacts"),
      contactIds: z.array(z.string()).min(1).describe("Array of contact IDs to add/remove"),
    },
    async ({ listId, action, contactIds }) => {
      // Verify list belongs to project
      const list = await prisma.contactList.findUnique({ where: { id: listId, projectId } });
      if (!list) throw new Error("Contact list not found");

      let result: unknown;
      if (action === "add") {
        const created = await prisma.contactListMembership.createMany({
          data: contactIds.map((contactId) => ({ contactId, listId })),
          skipDuplicates: true,
        });
        result = { added: created.count };
      } else {
        const deleted = await prisma.contactListMembership.deleteMany({
          where: { listId, contactId: { in: contactIds } },
        });
        result = { removed: deleted.count };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
