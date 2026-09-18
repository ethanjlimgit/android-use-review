import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/email-prisma";
import { buildContactWhereFromFilters } from "@/lib/segment-evaluator";
import type { Prisma } from "@/generated/client";

export function registerSegmentTools(server: McpServer, projectId: string) {
  server.tool(
    "segments_list",
    "List all segments with their filter definitions.",
    {},
    async () => {
      const segments = await prisma.emailSegment.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(segments, null, 2) }] };
    },
  );

  server.tool(
    "segment_create",
    "Create a segment with filter rules. Optionally preview how many contacts match.",
    {
      name: z.string().describe("Segment name"),
      description: z.string().optional().describe("Segment description"),
      filters: z
        .array(
          z.object({
            field: z.string().describe("Contact field to filter on (e.g. email, country, metadata.key)"),
            operator: z
              .enum(["equals", "not_equals", "in", "not_in", "contains", "gt", "lt", "gte", "lte"])
              .describe("Comparison operator"),
            value: z.any().describe("Value to compare against"),
          }),
        )
        .min(1)
        .describe("Filter rules (all must match)"),
      preview: z.boolean().optional().describe("If true, also preview matching contact count after creation"),
    },
    async ({ name, description, filters, preview }) => {
      const segment = await prisma.emailSegment.create({
        data: {
          projectId,
          name,
          description: description ?? null,
          filters: filters as unknown as Prisma.InputJsonValue,
        },
      });

      if (preview) {
        const where = buildContactWhereFromFilters(projectId, filters);
        const [count, sample] = await Promise.all([
          prisma.contact.count({ where }),
          prisma.contact.findMany({
            where,
            select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
            take: 10,
            orderBy: { createdAt: "desc" },
          }),
        ]);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ segment, preview: { count, sample } }, null, 2) }],
        };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(segment, null, 2) }] };
    },
  );
}
