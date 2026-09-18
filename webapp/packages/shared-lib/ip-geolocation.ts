/**
 * IP Geolocation utility using ip-api.com
 * Free tier: 45 requests per minute
 */

export interface GeolocationData {
  ip: string
  country: string | null
  countryCode: string | null // ISO 3166-1 alpha-2 country code (e.g., 'US', 'IN', 'BR')
  city: string | null
  latitude: number | null
  longitude: number | null
}

/**
 * Get geolocation data from IP address
 * @param ip - IP address to lookup
 * @returns Geolocation data or null if lookup fails
 */
export async function getGeolocationFromIP(ip: string): Promise<GeolocationData | null> {
  try {
    // Skip localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        ip,
        country: null,
        countryCode: null,
        city: null,
        latitude: null,
        longitude: null,
      }
    }

    // Use ip-api.com free API
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[IP Geolocation] API request failed:', response.statusText)
      return null
    }

    const data = await response.json()

    if (data.status === 'fail') {
      console.error('[IP Geolocation] API returned error:', data.message)
      return null
    }

    return {
      ip,
      country: data.country || null,
      countryCode: data.countryCode || null,
      city: data.city || null,
      latitude: data.lat || null,
      longitude: data.lon || null,
    }
  } catch (error) {
    console.error('[IP Geolocation] Error fetching geolocation:', error)
    return null
  }
}

/**
 * Extract IP address from request headers
 * Checks common headers used by proxies and load balancers
 */
export function getIPFromRequest(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  // Check various headers in order of preference
  const possibleHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
    'x-cluster-client-ip',
    'forwarded',
  ]

  for (const header of possibleHeaders) {
    const value = headers instanceof Headers
      ? headers.get(header)
      : (Array.isArray(headers[header]) ? headers[header]?.[0] : headers[header])

    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const firstIP = value.split(',')[0].trim()
      if (firstIP) {
        return firstIP
      }
    }
  }

  return null
}

/**
 * Extract client IP and get geolocation data
 * This is a convenience function that combines IP extraction and geolocation lookup
 */
export async function getClientGeolocation(headers: Headers | Record<string, string | string[] | undefined>): Promise<GeolocationData | null> {
  const ip = getIPFromRequest(headers)

  if (!ip) {
    console.warn('[IP Geolocation] Could not extract IP from request headers')
    return null
  }

  return getGeolocationFromIP(ip)
}
