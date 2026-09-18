const SENDGRID_API_URL = "https://api.sendgrid.com/v3/verified_senders"

function getApiKey(): string {
  const key = process.env.SENDGRID_API_KEY
  if (!key) throw new Error("SENDGRID_API_KEY environment variable is not set")
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  }
}

export interface CreateVerifiedSenderPayload {
  nickname: string
  from_email: string
  from_name: string
  reply_to: string
  reply_to_name: string
  address: string
  city: string
  country: string
}

export interface SendGridVerifiedSender {
  id: number
  nickname: string
  from_email: string
  from_name: string
  reply_to: string
  reply_to_name: string
  address: string
  city: string
  country: string
  verified: boolean
  locked: boolean
}

export async function createVerifiedSender(
  payload: CreateVerifiedSenderPayload
): Promise<SendGridVerifiedSender> {
  const res = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SendGrid createVerifiedSender failed (${res.status}): ${body}`)
  }

  return res.json()
}

export async function listVerifiedSenders(): Promise<SendGridVerifiedSender[]> {
  const res = await fetch(SENDGRID_API_URL, {
    method: "GET",
    headers: headers(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SendGrid listVerifiedSenders failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.results ?? []
}

export async function resendVerification(sendgridSenderId: number): Promise<void> {
  const res = await fetch(`${SENDGRID_API_URL}/resend/${sendgridSenderId}`, {
    method: "POST",
    headers: headers(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SendGrid resendVerification failed (${res.status}): ${body}`)
  }
}

export async function deleteVerifiedSender(sendgridSenderId: number): Promise<void> {
  const res = await fetch(`${SENDGRID_API_URL}/${sendgridSenderId}`, {
    method: "DELETE",
    headers: headers(),
  })

  if (!res.ok && res.status !== 404) {
    const body = await res.text()
    throw new Error(`SendGrid deleteVerifiedSender failed (${res.status}): ${body}`)
  }
}

export async function getVerificationStatus(sendgridSenderId: number): Promise<boolean> {
  const senders = await listVerifiedSenders()
  const match = senders.find((s) => s.id === sendgridSenderId)
  return match?.verified ?? false
}
