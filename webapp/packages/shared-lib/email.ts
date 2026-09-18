import sendgrid from '@sendgrid/mail'
import { z } from 'zod'
import { prisma } from './prisma'

// Validate environment variables
const emailConfigSchema = z.object({
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),
  SENDGRID_FROM_NAME: z.string().default('Boris'),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
})

type EmailConfig = z.infer<typeof emailConfigSchema>

// Default site name if not configured in database
const DEFAULT_SITE_NAME = 'Boris'

class EmailService {
  private config: EmailConfig | null = null
  private initialized = false
  private cachedSiteName: string | null = null
  private siteNameCacheTime: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

  /**
   * Get site name from database settings with caching
   */
  private async getSiteName(): Promise<string> {
    const now = Date.now()

    // Return cached value if still valid
    if (this.cachedSiteName && (now - this.siteNameCacheTime) < this.CACHE_TTL) {
      return this.cachedSiteName
    }

    try {
      const setting = await prisma.appSettings.findUnique({
        where: { key: 'site.name' }
      })

      this.cachedSiteName = setting?.value || DEFAULT_SITE_NAME
      this.siteNameCacheTime = now
      return this.cachedSiteName
    } catch (error) {
      console.error('[email] Failed to fetch site name from settings:', error)
      return this.cachedSiteName || DEFAULT_SITE_NAME
    }
  }

  /**
   * Initialize SendGrid with API key
   * Validates configuration on first use
   */
  private init() {
    if (this.initialized) return

    const result = emailConfigSchema.safeParse({
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
      SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
      SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
      AUTH_URL: process.env.AUTH_URL,
    })

    if (!result.success) {
      console.error('[email] Configuration error:', result.error.format())
      throw new Error('Email service not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL')
    }

    this.config = result.data
    sendgrid.setApiKey(this.config.SENDGRID_API_KEY)
    this.initialized = true
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(params: {
    to: string
    name: string | null
    verificationToken: string
  }): Promise<boolean> {
    this.init()

    if (!this.config) {
      throw new Error('Email service not initialized')
    }

    const siteName = await this.getSiteName()
    const verifyUrl = `${this.config.AUTH_URL}/auth/verify-email?token=${params.verificationToken}`

    const msg = {
      to: params.to,
      from: {
        email: this.config.SENDGRID_FROM_EMAIL,
        name: this.config.SENDGRID_FROM_NAME,
      },
      subject: `Verify Your Email - ${siteName}`,
      text: this.getVerificationTextTemplate(params.name, verifyUrl, siteName),
      html: this.getVerificationHtmlTemplate(params.name, verifyUrl, siteName),
    }

    try {
      await sendgrid.send(msg)
      console.log(`[email] Verification email sent to ${params.to}`)
      return true
    } catch (error) {
      console.error('[email] Failed to send verification email:', error)
      if (error instanceof Error && 'response' in error) {
        const sgError = error as any
        console.error('[email] SendGrid error:', sgError.response?.body)
      }
      return false
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(params: {
    to: string
    name: string | null
    resetToken: string
  }): Promise<boolean> {
    this.init()

    if (!this.config) {
      throw new Error('Email service not initialized')
    }

    const siteName = await this.getSiteName()
    const resetUrl = `${this.config.AUTH_URL}/auth/reset-password?token=${params.resetToken}`

    const msg = {
      to: params.to,
      from: {
        email: this.config.SENDGRID_FROM_EMAIL,
        name: this.config.SENDGRID_FROM_NAME,
      },
      subject: `Reset Your Password - ${siteName}`,
      text: this.getPasswordResetTextTemplate(params.name, resetUrl, siteName),
      html: this.getPasswordResetHtmlTemplate(params.name, resetUrl, siteName),
    }

    try {
      await sendgrid.send(msg)
      console.log(`[email] Password reset email sent to ${params.to}`)
      return true
    } catch (error) {
      console.error('[email] Failed to send password reset email:', error)
      if (error instanceof Error && 'response' in error) {
        const sgError = error as any
        console.error('[email] SendGrid error:', sgError.response?.body)
      }
      return false
    }
  }

  /**
   * Plain text email template
   */
  private getPasswordResetTextTemplate(name: string | null, resetUrl: string, siteName: string): string {
    return `
Hi ${name || 'there'},

You recently requested to reset your password for your ${siteName} account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The ${siteName} Team
    `.trim()
  }

  /**
   * HTML email template
   */
  private getPasswordResetHtmlTemplate(name: string | null, resetUrl: string, siteName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #18181b;">Reset Your Password</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                Hi ${name || 'there'},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                You recently requested to reset your password for your ${siteName} account. Click the button below to reset it.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Reset Password</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                Or copy and paste this URL into your browser:<br>
                <a href="${resetUrl}" style="color: #18181b; word-break: break-all;">${resetUrl}</a>
              </p>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                This link will expire in <strong>1 hour</strong>.
              </p>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa; text-align: center;">
                ${siteName} - AI-Powered Android Device Interactions<br>
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim()
  }

  /**
   * Verification email text template
   */
  private getVerificationTextTemplate(name: string | null, verifyUrl: string, siteName: string): string {
    return `
Hi ${name || 'there'},

Thank you for signing up for ${siteName}!

Please verify your email address by clicking the link below:
${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

Best regards,
The ${siteName} Team
    `.trim()
  }

  /**
   * Verification email HTML template
   */
  private getVerificationHtmlTemplate(name: string | null, verifyUrl: string, siteName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #18181b;">Verify Your Email</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                Hi ${name || 'there'},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                Thank you for signing up for ${siteName}! To complete your registration, please verify your email address by clicking the button below.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Verify Email Address</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                Or copy and paste this URL into your browser:<br>
                <a href="${verifyUrl}" style="color: #18181b; word-break: break-all;">${verifyUrl}</a>
              </p>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                This link will expire in <strong>24 hours</strong>.
              </p>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa; text-align: center;">
                ${siteName} - AI-Powered Android Device Interactions<br>
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim()
  }
}

export const emailService = new EmailService()
