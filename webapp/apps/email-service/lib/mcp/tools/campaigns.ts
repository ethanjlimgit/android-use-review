import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/email-prisma";
import { buildContactWhereFromFilters } from "@/lib/segment-evaluator";
import { calculateSendTimeForTimezone, getTimezoneFromCountry } from "@/lib/timezone";
import { campaignEmailService } from "@/lib/campaign-email";
import crypto from "crypto";

export function registerCampaignTools(server: McpServer, projectId: string) {
  server.tool(
    "campaigns_list",
    "List campaigns with optional status and search filters.",
    {
      status: z
        .enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "PAUSED", "CANCELLED"])
        .optional()
        .describe("Filter by campaign status"),
      search: z.string().optional().describe("Search by campaign name"),
    },
    async ({ status, search }) => {
      const where: Record<string, unknown> = { projectId };
      if (status) where.status = status;
      if (search) where.name = { contains: search, mode: "insensitive" };

      const campaigns = await prisma.emailCampaign.findMany({
        where,
        include: {
          variants: { select: { id: true, subject: true, segmentId: true } },
          _count: { select: { recipients: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(campaigns, null, 2) }] };
    },
  );

  server.tool(
    "campaign_create",
    "Create a new email campaign with one or more variants. Each variant needs a subject and HTML body.",
    {
      name: z.string().describe("Campaign name"),
      senderId: z.string().optional().describe("Sender identity ID (uses default sender if omitted)"),
      scheduledAt: z.string().optional().describe("ISO8601 datetime to schedule sending"),
      sendByTimezone: z.boolean().optional().describe("Send based on each contact's timezone"),
      targetHour: z.number().int().min(0).max(23).optional().describe("Target hour (0-23) for timezone-based sending"),
      variants: z
        .array(
          z.object({
            subject: z.string().describe("Email subject line"),
            htmlBody: z.string().describe("HTML email body"),
            textBody: z.string().optional().describe("Plain text fallback"),
            preheader: z.string().optional().describe("Email preheader text"),
            segmentId: z.string().optional().describe("Segment ID to target with this variant"),
            sortOrder: z.number().int().optional().describe("Variant sort order"),
          }),
        )
        .min(1)
        .describe("Email variants (at least one required)"),
    },
    async (args) => {
      let senderId = args.senderId ?? null;
      if (!senderId) {
        const defaultSender = await prisma.senderIdentity.findFirst({
          where: { projectId, isDefault: true },
        });
        if (defaultSender) senderId = defaultSender.id;
      }

      const campaign = await prisma.emailCampaign.create({
        data: {
          projectId,
          senderId,
          name: args.name,
          scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : null,
          sendByTimezone: args.sendByTimezone ?? false,
          targetHour: args.targetHour ?? null,
          variants: {
            create: args.variants.map((v, i) => ({
              segmentId: v.segmentId ?? null,
              subject: v.subject,
              preheader: v.preheader ?? null,
              htmlBody: v.htmlBody,
              textBody: v.textBody ?? null,
              sortOrder: v.sortOrder ?? i,
            })),
          },
        },
        include: { variants: true },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(campaign, null, 2) }] };
    },
  );

  server.tool(
    "campaign_get",
    "Get campaign details including variants, stats (recipients, opens, clicks, bounces), and event counts.",
    {
      id: z.string().describe("Campaign ID"),
      includeStats: z.boolean().optional().describe("Also fetch detailed statistics"),
    },
    async ({ id, includeStats }) => {
      const campaign = await prisma.emailCampaign.findUnique({
        where: { id, projectId },
        include: {
          variants: { include: { segment: true }, orderBy: { sortOrder: "asc" } },
          _count: { select: { recipients: true } },
        },
      });
      if (!campaign) throw new Error("Campaign not found");

      if (!includeStats) {
        return { content: [{ type: "text" as const, text: JSON.stringify(campaign, null, 2) }] };
      }

      const [recipientStats, eventStats] = await Promise.all([
        prisma.campaignRecipient.groupBy({
          by: ["status"],
          where: { campaignId: id },
          _count: true,
        }),
        prisma.emailEvent.groupBy({
          by: ["eventType"],
          where: { recipient: { campaignId: id } },
          _count: true,
        }),
      ]);

      const recipientsByStatus = Object.fromEntries(recipientStats.map((r) => [r.status, r._count]));
      const eventCounts = Object.fromEntries(eventStats.map((e) => [e.eventType, e._count]));

      const totalRecipients = Object.values(recipientsByStatus).reduce((a, b) => a + (b as number), 0) as number;
      const delivered = (eventCounts.DELIVERED as number) || 0;
      const opened = (eventCounts.OPENED as number) || 0;
      const clicked = (eventCounts.CLICKED as number) || 0;
      const bounced = (eventCounts.BOUNCED as number) || 0;

      const stats = {
        totalRecipients,
        recipientsByStatus,
        delivered,
        opened,
        clicked,
        bounced,
        spamReports: (eventCounts.SPAM_REPORT as number) || 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
        bounceRate: totalRecipients > 0 ? (bounced / totalRecipients) * 100 : 0,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ campaign, stats }, null, 2) }],
      };
    },
  );

  server.tool(
    "campaign_action",
    "Perform an action on a campaign: send, pause, cancel, duplicate, or send a test email.",
    {
      id: z.string().describe("Campaign ID"),
      action: z.enum(["send", "pause", "cancel", "duplicate", "test_email"]).describe("Action to perform"),
      testEmail: z.string().email().optional().describe("Recipient email for test_email action"),
      variantIndex: z.number().int().min(0).optional().describe("Variant index for test_email action (default: 0)"),
    },
    async ({ id, action, testEmail, variantIndex }) => {
      let result: unknown;

      switch (action) {
        case "pause": {
          const c = await prisma.emailCampaign.findUnique({ where: { id, projectId } });
          if (!c) throw new Error("Campaign not found");
          if (c.status !== "SENDING" && c.status !== "SCHEDULED") {
            throw new Error("Only SENDING or SCHEDULED campaigns can be paused");
          }
          await prisma.emailCampaign.update({ where: { id }, data: { status: "PAUSED" } });
          result = { success: true };
          break;
        }

        case "cancel": {
          const c = await prisma.emailCampaign.findUnique({ where: { id, projectId } });
          if (!c) throw new Error("Campaign not found");
          if (c.status === "SENT" || c.status === "CANCELLED") {
            throw new Error("Cannot cancel SENT or CANCELLED campaigns");
          }
          await prisma.$transaction([
            prisma.emailCampaign.update({ where: { id }, data: { status: "CANCELLED" } }),
            prisma.campaignRecipient.deleteMany({ where: { campaignId: id, status: "QUEUED" } }),
          ]);
          result = { success: true };
          break;
        }

        case "duplicate": {
          const original = await prisma.emailCampaign.findUnique({
            where: { id, projectId },
            include: { variants: { orderBy: { sortOrder: "asc" } } },
          });
          if (!original) throw new Error("Campaign not found");
          result = await prisma.emailCampaign.create({
            data: {
              projectId,
              senderId: original.senderId,
              name: `${original.name} (Copy)`,
              status: "DRAFT",
              sendByTimezone: original.sendByTimezone,
              targetHour: original.targetHour,
              variants: {
                create: original.variants.map((v) => ({
                  segmentId: v.segmentId,
                  subject: v.subject,
                  preheader: v.preheader,
                  htmlBody: v.htmlBody,
                  textBody: v.textBody,
                  sortOrder: v.sortOrder,
                })),
              },
            },
            include: { variants: true },
          });
          break;
        }

        case "send": {
          result = await sendCampaign(id, projectId);
          break;
        }

        case "test_email": {
          if (!testEmail) throw new Error("testEmail is required for test_email action");
          const campaign = await prisma.emailCampaign.findUnique({
            where: { id, projectId },
            include: { variants: { orderBy: { sortOrder: "asc" } } },
          });
          if (!campaign) throw new Error("Campaign not found");

          const variant = campaign.variants[variantIndex ?? 0];
          if (!variant) throw new Error("Variant not found at given index");

          let sender = campaign.senderId
            ? await prisma.senderIdentity.findUnique({ where: { id: campaign.senderId } })
            : null;
          if (!sender) {
            sender = await prisma.senderIdentity.findFirst({ where: { projectId, isDefault: true } });
          }
          if (!sender) throw new Error("No sender identity configured");

          const sendResult = await campaignEmailService.sendCampaignEmail({
            to: testEmail,
            subject: `[TEST] ${variant.subject}`,
            preheader: variant.preheader,
            htmlBody: variant.htmlBody,
            textBody: variant.textBody,
            recipientId: "test-preview",
            unsubscribeToken: "test-token",
            campaignId: campaign.id,
            variantId: variant.id,
            fromEmail: sender.email,
            fromName: sender.name,
            replyTo: sender.replyTo,
          });
          if (!sendResult.success) throw new Error(sendResult.error || "Failed to send test email");
          result = { success: true };
          break;
        }
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}

async function sendCampaign(id: string, projectId: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id, projectId },
    include: { variants: { include: { segment: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error("Campaign must be in DRAFT or SCHEDULED status to send");
  }

  let sender = campaign.senderId
    ? await prisma.senderIdentity.findUnique({ where: { id: campaign.senderId } })
    : null;
  if (!sender) {
    sender = await prisma.senderIdentity.findFirst({ where: { projectId, isDefault: true } });
  }
  if (!sender) throw new Error("No sender identity configured. Create a sender first.");

  const assignedContactIds = new Set<string>();
  const recipientData: Array<{
    contactId: string;
    email: string;
    variantId: string;
    timezone: string | null;
    scheduledFor: Date | null;
  }> = [];

  const segmentedVariants = campaign.variants.filter((v) => v.segmentId !== null);
  const defaultVariant = campaign.variants.find((v) => v.segmentId === null);

  for (const variant of segmentedVariants) {
    if (!variant.segment) continue;
    const where = buildContactWhereFromFilters(projectId, variant.segment.filters as SegmentFilter[]);
    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true, email: true, timezone: true, country: true, city: true },
    });

    for (const contact of contacts) {
      if (assignedContactIds.has(contact.id)) continue;
      assignedContactIds.add(contact.id);
      const tz = contact.timezone || getTimezoneFromCountry(contact.country || "", contact.city);
      let scheduledFor: Date | null = null;
      if (campaign.sendByTimezone && campaign.targetHour !== null && tz) {
        scheduledFor = calculateSendTimeForTimezone(campaign.targetHour, tz);
      }
      recipientData.push({ contactId: contact.id, email: contact.email, variantId: variant.id, timezone: tz, scheduledFor });
    }
  }

  if (defaultVariant) {
    const contacts = await prisma.contact.findMany({
      where: { projectId, emailUnsubscribed: false, id: { notIn: Array.from(assignedContactIds) } },
      select: { id: true, email: true, timezone: true, country: true, city: true },
    });
    for (const contact of contacts) {
      assignedContactIds.add(contact.id);
      const tz = contact.timezone || getTimezoneFromCountry(contact.country || "", contact.city);
      let scheduledFor: Date | null = null;
      if (campaign.sendByTimezone && campaign.targetHour !== null && tz) {
        scheduledFor = calculateSendTimeForTimezone(campaign.targetHour, tz);
      }
      recipientData.push({ contactId: contact.id, email: contact.email, variantId: defaultVariant.id, timezone: tz, scheduledFor });
    }
  }

  if (recipientData.length === 0) throw new Error("No eligible recipients found");

  // Ensure unsubscribe tokens
  const contactIds = recipientData.map((r) => r.contactId);
  const withoutTokens = await prisma.contact.findMany({
    where: { id: { in: contactIds }, unsubscribeToken: null },
    select: { id: true },
  });
  if (withoutTokens.length > 0) {
    await Promise.all(
      withoutTokens.map((c) =>
        prisma.contact.update({ where: { id: c.id }, data: { unsubscribeToken: crypto.randomUUID() } }),
      ),
    );
  }

  await prisma.campaignRecipient.createMany({
    data: recipientData.map((r) => ({
      campaignId: id,
      variantId: r.variantId,
      contactId: r.contactId,
      email: r.email,
      timezone: r.timezone,
      scheduledFor: r.scheduledFor,
      status: "QUEUED",
    })),
    skipDuplicates: true,
  });

  const newStatus = campaign.sendByTimezone ? "SCHEDULED" : "SENDING";
  await prisma.emailCampaign.update({ where: { id }, data: { status: newStatus } });

  if (!campaign.sendByTimezone) {
    sendCampaignEmails(id, sender).catch((err) =>
      console.error(`[campaign] Background send failed for ${id}:`, err),
    );
  }

  return { success: true, recipientCount: recipientData.length, status: newStatus };
}

import type { SegmentFilter } from "@/lib/schemas";

async function sendCampaignEmails(
  campaignId: string,
  sender: { email: string; name: string; replyTo: string | null },
) {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "QUEUED" },
    include: { variant: true, contact: { select: { unsubscribeToken: true } } },
  });

  const byVariant = new Map<string, typeof recipients>();
  for (const r of recipients) {
    const group = byVariant.get(r.variantId) || [];
    group.push(r);
    byVariant.set(r.variantId, group);
  }

  for (const [, variantRecipients] of byVariant) {
    if (variantRecipients.length === 0) continue;
    const variant = variantRecipients[0].variant;
    const results = await campaignEmailService.sendBatch(
      variantRecipients.map((r) => ({
        to: r.email,
        recipientId: r.id,
        unsubscribeToken: r.contact.unsubscribeToken || "",
      })),
      variant,
      { id: campaignId },
      sender,
    );
    for (const res of results) {
      if (!res.recipientId) continue;
      await prisma.campaignRecipient.update({
        where: { id: res.recipientId },
        data: {
          status: res.success ? "SENT" : "FAILED",
          sentAt: res.success ? new Date() : null,
          sendgridMessageId: res.messageId || null,
          error: res.error || null,
        },
      });
    }
  }

  await prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: "SENT" } });
}
