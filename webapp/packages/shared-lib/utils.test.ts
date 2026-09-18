import { describe, it, expect } from 'vitest'
import { isPersonalEmail, getEmailType } from './utils'

describe('isPersonalEmail', () => {
  it('should identify Gmail as personal email', () => {
    expect(isPersonalEmail('user@gmail.com')).toBe(true)
  })

  it('should identify Yahoo as personal email', () => {
    expect(isPersonalEmail('user@yahoo.com')).toBe(true)
  })

  it('should identify Outlook as personal email', () => {
    expect(isPersonalEmail('user@outlook.com')).toBe(true)
  })

  it('should identify Hotmail as personal email', () => {
    expect(isPersonalEmail('user@hotmail.com')).toBe(true)
  })

  it('should identify Live as personal email', () => {
    expect(isPersonalEmail('user@live.com')).toBe(true)
  })

  it('should identify iCloud as personal email', () => {
    expect(isPersonalEmail('user@icloud.com')).toBe(true)
  })

  it('should identify me.com as personal email', () => {
    expect(isPersonalEmail('user@me.com')).toBe(true)
  })

  it('should identify AOL as personal email', () => {
    expect(isPersonalEmail('user@aol.com')).toBe(true)
  })

  it('should identify ProtonMail as personal email', () => {
    expect(isPersonalEmail('user@protonmail.com')).toBe(true)
  })

  it('should identify Mail.com as personal email', () => {
    expect(isPersonalEmail('user@mail.com')).toBe(true)
  })

  it('should identify Zoho as personal email', () => {
    expect(isPersonalEmail('user@zoho.com')).toBe(true)
  })

  it('should identify Yandex as personal email', () => {
    expect(isPersonalEmail('user@yandex.com')).toBe(true)
  })

  it('should identify company email correctly', () => {
    expect(isPersonalEmail('user@company.com')).toBe(false)
  })

  it('should identify custom domain as company email', () => {
    expect(isPersonalEmail('admin@example.org')).toBe(false)
  })

  it('should handle mixed case domains', () => {
    expect(isPersonalEmail('User@Gmail.Com')).toBe(true)
  })

  it('should handle uppercase email', () => {
    expect(isPersonalEmail('ADMIN@YAHOO.COM')).toBe(true)
  })

  it('should correctly parse email with multiple @ symbols in username', () => {
    // Only the last @ should be considered the domain separator
    const email = 'user@test@company.com'
    expect(isPersonalEmail(email)).toBe(false)
  })
})

describe('getEmailType', () => {
  it('should return "personal" for Gmail', () => {
    expect(getEmailType('test@gmail.com')).toBe('personal')
  })

  it('should return "personal" for Yahoo', () => {
    expect(getEmailType('test@yahoo.com')).toBe('personal')
  })

  it('should return "personal" for Outlook', () => {
    expect(getEmailType('test@outlook.com')).toBe('personal')
  })

  it('should return "company" for custom domain', () => {
    expect(getEmailType('test@acme.com')).toBe('company')
  })

  it('should return "company" for .org domain', () => {
    expect(getEmailType('test@nonprofit.org')).toBe('company')
  })

  it('should handle all supported personal domains', () => {
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'live.com', 'icloud.com', 'me.com', 'aol.com',
      'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com'
    ]

    personalDomains.forEach(domain => {
      expect(getEmailType(`user@${domain}`)).toBe('personal')
    })
  })

  it('should handle mixed case email addresses', () => {
    expect(getEmailType('User@Outlook.COM')).toBe('personal')
  })

  it('should return "company" for edu domains', () => {
    expect(getEmailType('student@university.edu')).toBe('company')
  })
})
