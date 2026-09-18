import sendgrid from "@sendgrid/mail"
import { z } from "zod"

const campaignEmailConfigSchema = z.object({
  SENDGRID_API_KEY: z.string().min(1),
  EMAIL_SERVICE_URL: z.string().url().default("http://localhost:3002"),
})

type CampaignEmailConfig = z.infer<typeof campaignEmailConfigSchema>

class CampaignEmailService {
  private config: CampaignEmailConfig | null = null
  private initialized = false

  private init() {
    if (this.initialized) return

    const result = campaignEmailConfigSchema.safeParse({
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
      EMAIL_SERVICE_URL: process.env.EMAIL_SERVICE_URL,
    })

    if (!result.success) {
      console.error("[campaign-email] Configuration error:", result.error.format())
      throw new Error("Campaign email service not configured")
    }

    this.config = result.data
    sendgrid.setApiKey(this.config.SENDGRID_API_KEY)
    this.initialized = true
  }

  buildCampaignEmail(params: {
    htmlBody: string
    recipientId: string
    unsubscribeToken: string
    baseUrl: string
  }): string {
    const { htmlBody, recipientId, unsubscribeToken, baseUrl } = params

    const trackingPixel = `<img src="${baseUrl}/api/track/open?rid=${encodeURIComponent(recipientId)}" width="1" height="1" style="display:none" alt="" />`

    const wrappedBody = htmlBody.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (_, url: string) => {
        const trackUrl = `${baseUrl}/api/track/click?rid=${encodeURIComponent(recipientId)}&url=${encodeURIComponent(url)}`
        return `href="${trackUrl}"`
      }
    )

    const unsubscribeUrl = `${baseUrl}/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
    const footer = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e4e4e7; text-align: center;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa;">
          You're receiving this email because you subscribed.
          <br />
          <a href="${unsubscribeUrl}" style="color: #71717a; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    `

    let result = wrappedBody
    if (result.includes("</body>")) {
      result = result.replace("</body>", `${footer}${trackingPixel}</body>`)
    } else {
      result = result + footer + trackingPixel
    }

    return result
  }

  async sendCampaignEmail(params: {
    to: string
    subject: string
    preheader?: string | null
    htmlBody: string
    textBody?: string | null
    recipientId: string
    unsubscribeToken: string
    campaignId: string
    variantId: string
    fromEmail: string
    fromName: string
    replyTo?: string | null
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    this.init()
    if (!this.config) throw new Error("Campaign email service not initialized")

    const baseUrl = this.config.EMAIL_SERVICE_URL
    const html = this.buildCampaignEmail({
      htmlBody: params.htmlBody,
      recipientId: params.recipientId,
      unsubscribeToken: params.unsubscribeToken,
      baseUrl,
    })

    let finalHtml = html
    if (params.preheader) {
      const preheaderHtml = `<div style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${params.preheader}</div>`
      if (finalHtml.includes("<body")) {
        finalHtml = finalHtml.replace(/(<body[^>]*>)/, `$1${preheaderHtml}`)
      } else {
        finalHtml = preheaderHtml + finalHtml
      }
    }

    const unsubscribeUrl = `${baseUrl}/email/unsubscribe?token=${encodeURIComponent(params.unsubscribeToken)}`

    const msg: sendgrid.MailDataRequired = {
      to: params.to,
      from: {
        email: params.fromEmail,
        name: params.fromName,
      },
      ...(params.replyTo && { replyTo: params.replyTo }),
      subject: params.subject,
      html: finalHtml,
      text: params.textBody || undefined,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      customArgs: {
        recipientId: params.recipientId,
        campaignId: params.campaignId,
        variantId: params.variantId,
      },
    }

    try {
      const [response] = await sendgrid.send(msg)
      const messageId = response.headers["x-message-id"] as string | undefined
      return { success: true, messageId }
    } catch (error) {
      console.error("[campaign-email] Send failed:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown send error"
      return { success: false, error: errorMessage }
    }
  }

  async sendBatch(
    recipients: Array<{
      to: string
      recipientId: string
      unsubscribeToken: string
    }>,
    variant: {
      subject: string
      preheader?: string | null
      htmlBody: string
      textBody?: string | null
      id: string
    },
    campaign: { id: string },
    sender: { email: string; name: string; replyTo?: string | null }
  ): Promise<Array<{ recipientId: string; success: boolean; messageId?: string; error?: string }>> {
    const results: Array<{ recipientId: string; success: boolean; messageId?: string; error?: string }> = []
    const batchSize = 100

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)

      const batchResults = await Promise.allSettled(
        batch.map(async (recipient) => {
          const result = await this.sendCampaignEmail({
            to: recipient.to,
            subject: variant.subject,
            preheader: variant.preheader,
            htmlBody: variant.htmlBody,
            textBody: variant.textBody,
            recipientId: recipient.recipientId,
            unsubscribeToken: recipient.unsubscribeToken,
            campaignId: campaign.id,
            variantId: variant.id,
            fromEmail: sender.email,
            fromName: sender.name,
            replyTo: sender.replyTo,
          })
          return { recipientId: recipient.recipientId, ...result }
        })
      )

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value)
        } else {
          results.push({
            recipientId: "",
            success: false,
            error: result.reason?.message || "Unknown error",
          })
        }
      }

      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}

export const campaignEmailService = new CampaignEmailService()
