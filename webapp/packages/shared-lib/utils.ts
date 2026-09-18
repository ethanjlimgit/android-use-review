// cn utility has been moved to @droiduse/shared-ui

// Email detection utilities
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
]

export function isPersonalEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1]
  return PERSONAL_EMAIL_DOMAINS.includes(domain)
}

export function getEmailType(email: string): 'personal' | 'company' {
  return isPersonalEmail(email) ? 'personal' : 'company'
}
