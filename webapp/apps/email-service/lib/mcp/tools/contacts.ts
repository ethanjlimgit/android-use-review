import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/email-prisma";
import type { Prisma } from "@/generated/client";
import crypto from "crypto";

export function registerContactTools(server: McpServer, projectId: string) {
  server.tool(
    "contacts_search",
    "Search and list contacts. Supports filtering by search query and list membership.",
    {
      search: z.string().optional().describe("Search by email, name, or company"),
      listId: z.string().optional().describe("Filter by contact list ID"),
      page: z.number().int().min(1).optional().describe("Page number (default: 1)"),
      pageSize: z.number().int().min(1).max(100).optional().describe("Items per page (default: 50)"),
    },
    async ({ search, listId, page = 1, pageSize = 50 }) => {
      const where: Prisma.ContactWhereInput = { projectId };
      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
        ];
      }
      if (listId) {
        where.listMemberships = { some: { listId } };
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        }),
        prisma.contact.count({ where }),
      ]);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ contacts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "contact_create",
    "Create a new contact with email and optional profile fields.",
    {
      email: z.string().email().describe("Contact email address (required)"),
      firstName: z.string().optional().describe("First name"),
      lastName: z.string().optional().describe("Last name"),
      externalId: z.string().optional().describe("External system ID"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company or organization"),
      jobTitle: z.string().optional().describe("Job title or role"),
      timezone: z.string().optional().describe("IANA timezone (e.g. America/New_York)"),
      country: z.string().optional().describe("Country"),
      city: z.string().optional().describe("City"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Arbitrary key-value metadata"),
      source: z.string().optional().describe("Acquisition source"),
    },
    async (args) => {
      const contact = await prisma.contact.create({
        data: {
          projectId,
          email: args.email,
          firstName: args.firstName ?? null,
          lastName: args.lastName ?? null,
          externalId: args.externalId ?? null,
          phone: args.phone ?? null,
          company: args.company ?? null,
          jobTitle: args.jobTitle ?? null,
          timezone: args.timezone ?? null,
          country: args.country ?? null,
          city: args.city ?? null,
          metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
          source: args.source ?? "mcp",
          unsubscribeToken: crypto.randomUUID(),
        },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(contact, null, 2) }] };
    },
  );

  server.tool(
    "contact_manage",
    "Get, update, or delete a contact by ID.",
    {
      id: z.string().describe("Contact ID"),
      action: z.enum(["get", "update", "delete"]).describe("Action to perform"),
      email: z.string().email().optional().describe("Updated email (for update action)"),
      firstName: z.string().optional().describe("Updated first name"),
      lastName: z.string().optional().describe("Updated last name"),
      externalId: z.string().optional().describe("Updated external ID"),
      phone: z.string().optional().describe("Updated phone"),
      company: z.string().optional().describe("Updated company"),
      jobTitle: z.string().optional().describe("Updated job title"),
      timezone: z.string().optional().describe("Updated timezone"),
      country: z.string().optional().describe("Updated country"),
      city: z.string().optional().describe("Updated city"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Updated metadata"),
    },
    async ({ id, action, ...updateFields }) => {
      let result: unknown;
      switch (action) {
        case "get":
          result = await prisma.contact.findUnique({
            where: { id, projectId },
            include: { listMemberships: { include: { list: true } } },
          });
          if (!result) throw new Error("Contact not found");
          break;
        case "update": {
          const data: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(updateFields)) {
            if (v !== undefined) data[k] = v;
          }
          if (data.metadata) data.metadata = data.metadata as Prisma.InputJsonValue;
          result = await prisma.contact.update({ where: { id, projectId }, data });
          break;
        }
        case "delete":
          await prisma.contact.delete({ where: { id, projectId } });
          result = { success: true };
          break;
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
