import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/email-prisma";
import { createVerifiedSender, getVerificationStatus, resendVerification } from "@/lib/sendgrid-senders";

export function registerSenderTools(server: McpServer, projectId: string) {
  server.tool(
    "senders_list",
    "List all sender identities.",
    {},
    async () => {
      const senders = await prisma.senderIdentity.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(senders, null, 2) }] };
    },
  );

  server.tool(
    "sender_create",
    "Create a new sender identity for sending emails. Registers with SendGrid for verification.",
    {
      name: z.string().describe("Sender display name"),
      email: z.string().email().describe("Sender email address"),
      replyTo: z.string().email().optional().describe("Reply-to email address"),
      isDefault: z.boolean().optional().describe("Set as default sender (unsets other defaults)"),
      address: z.string().describe("Physical mailing address (required by CAN-SPAM)"),
      city: z.string().describe("City"),
      country: z.string().optional().default("US").describe("Country code (default: US)"),
    },
    async (args) => {
      if (args.isDefault) {
        await prisma.senderIdentity.updateMany({
          where: { projectId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const sender = await prisma.senderIdentity.create({
        data: {
          projectId,
          name: args.name,
          email: args.email,
          replyTo: args.replyTo ?? null,
          isDefault: args.isDefault ?? false,
          address: args.address,
          city: args.city,
          country: args.country,
        },
      });

      // Register with SendGrid (best-effort)
      try {
        const sgSender = await createVerifiedSender({
          nickname: args.name,
          from_email: args.email,
          from_name: args.name,
          reply_to: args.replyTo ?? args.email,
          reply_to_name: args.name,
          address: args.address,
          city: args.city,
          country: args.country,
        });

        await prisma.senderIdentity.update({
          where: { id: sender.id },
          data: { sendgridSenderId: sgSender.id },
        });

        sender.sendgridSenderId = sgSender.id;
      } catch (sgError) {
        console.error("SendGrid registration failed:", sgError);
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(sender, null, 2) }] };
    },
  );

  server.tool(
    "sender_check_verification",
    "Check the verification status of a sender identity with SendGrid.",
    {
      senderId: z.string().describe("The sender identity ID"),
    },
    async (args) => {
      const sender = await prisma.senderIdentity.findFirst({
        where: { id: args.senderId, projectId },
      });

      if (!sender) {
        return { content: [{ type: "text" as const, text: "Sender not found" }], isError: true };
      }

      if (!sender.sendgridSenderId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ verified: sender.verified, sendgridSenderId: null, message: "Not registered with SendGrid" }) }],
        };
      }

      const verified = await getVerificationStatus(sender.sendgridSenderId);

      if (verified !== sender.verified) {
        await prisma.senderIdentity.update({
          where: { id: sender.id },
          data: { verified },
        });
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ verified, sendgridSenderId: sender.sendgridSenderId }) }],
      };
    },
  );

  server.tool(
    "sender_resend_verification",
    "Resend the verification email for an unverified sender identity.",
    {
      senderId: z.string().describe("The sender identity ID"),
    },
    async (args) => {
      const sender = await prisma.senderIdentity.findFirst({
        where: { id: args.senderId, projectId },
      });

      if (!sender) {
        return { content: [{ type: "text" as const, text: "Sender not found" }], isError: true };
      }

      if (!sender.sendgridSenderId) {
        return {
          content: [{ type: "text" as const, text: "Sender is not registered with SendGrid. Cannot resend verification." }],
          isError: true,
        };
      }

      if (sender.verified) {
        return { content: [{ type: "text" as const, text: "Sender is already verified" }] };
      }

      await resendVerification(sender.sendgridSenderId);

      return { content: [{ type: "text" as const, text: "Verification email resent successfully" }] };
    },
  );
}
