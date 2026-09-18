// Maps common ISO 3166-1 alpha-2 country codes to their primary IANA timezone
export const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  AF: 'Asia/Kabul', AL: 'Europe/Tirane', DZ: 'Africa/Algiers', AS: 'Pacific/Pago_Pago',
  AD: 'Europe/Andorra', AO: 'Africa/Luanda', AG: 'America/Antigua', AR: 'America/Argentina/Buenos_Aires',
  AM: 'Asia/Yerevan', AU: 'Australia/Sydney', AT: 'Europe/Vienna', AZ: 'Asia/Baku',
  BS: 'America/Nassau', BH: 'Asia/Bahrain', BD: 'Asia/Dhaka', BB: 'America/Barbados',
  BY: 'Europe/Minsk', BE: 'Europe/Brussels', BZ: 'America/Belize', BJ: 'Africa/Porto-Novo',
  BT: 'Asia/Thimphu', BO: 'America/La_Paz', BA: 'Europe/Sarajevo', BW: 'Africa/Gaborone',
  BR: 'America/Sao_Paulo', BN: 'Asia/Brunei', BG: 'Europe/Sofia', BF: 'Africa/Ouagadougou',
  BI: 'Africa/Bujumbura', KH: 'Asia/Phnom_Penh', CM: 'Africa/Douala', CA: 'America/Toronto',
  CV: 'Atlantic/Cape_Verde', CF: 'Africa/Bangui', TD: 'Africa/Ndjamena', CL: 'America/Santiago',
  CN: 'Asia/Shanghai', CO: 'America/Bogota', KM: 'Indian/Comoro', CG: 'Africa/Brazzaville',
  CD: 'Africa/Kinshasa', CR: 'America/Costa_Rica', CI: 'Africa/Abidjan', HR: 'Europe/Zagreb',
  CU: 'America/Havana', CY: 'Asia/Nicosia', CZ: 'Europe/Prague', DK: 'Europe/Copenhagen',
  DJ: 'Africa/Djibouti', DM: 'America/Dominica', DO: 'America/Santo_Domingo', EC: 'America/Guayaquil',
  EG: 'Africa/Cairo', SV: 'America/El_Salvador', GQ: 'Africa/Malabo', ER: 'Africa/Asmara',
  EE: 'Europe/Tallinn', ET: 'Africa/Addis_Ababa', FJ: 'Pacific/Fiji', FI: 'Europe/Helsinki',
  FR: 'Europe/Paris', GA: 'Africa/Libreville', GM: 'Africa/Banjul', GE: 'Asia/Tbilisi',
  DE: 'Europe/Berlin', GH: 'Africa/Accra', GR: 'Europe/Athens', GD: 'America/Grenada',
  GT: 'America/Guatemala', GN: 'Africa/Conakry', GW: 'Africa/Bissau', GY: 'America/Guyana',
  HT: 'America/Port-au-Prince', HN: 'America/Tegucigalpa', HK: 'Asia/Hong_Kong', HU: 'Europe/Budapest',
  IS: 'Atlantic/Reykjavik', IN: 'Asia/Kolkata', ID: 'Asia/Jakarta', IR: 'Asia/Tehran',
  IQ: 'Asia/Baghdad', IE: 'Europe/Dublin', IL: 'Asia/Jerusalem', IT: 'Europe/Rome',
  JM: 'America/Jamaica', JP: 'Asia/Tokyo', JO: 'Asia/Amman', KZ: 'Asia/Almaty',
  KE: 'Africa/Nairobi', KI: 'Pacific/Tarawa', KP: 'Asia/Pyongyang', KR: 'Asia/Seoul',
  KW: 'Asia/Kuwait', KG: 'Asia/Bishkek', LA: 'Asia/Vientiane', LV: 'Europe/Riga',
  LB: 'Asia/Beirut', LS: 'Africa/Maseru', LR: 'Africa/Monrovia', LY: 'Africa/Tripoli',
  LI: 'Europe/Vaduz', LT: 'Europe/Vilnius', LU: 'Europe/Luxembourg', MO: 'Asia/Macau',
  MK: 'Europe/Skopje', MG: 'Indian/Antananarivo', MW: 'Africa/Blantyre', MY: 'Asia/Kuala_Lumpur',
  MV: 'Indian/Maldives', ML: 'Africa/Bamako', MT: 'Europe/Malta', MH: 'Pacific/Majuro',
  MR: 'Africa/Nouakchott', MU: 'Indian/Mauritius', MX: 'America/Mexico_City', FM: 'Pacific/Chuuk',
  MD: 'Europe/Chisinau', MC: 'Europe/Monaco', MN: 'Asia/Ulaanbaatar', ME: 'Europe/Podgorica',
  MA: 'Africa/Casablanca', MZ: 'Africa/Maputo', MM: 'Asia/Yangon', NA: 'Africa/Windhoek',
  NR: 'Pacific/Nauru', NP: 'Asia/Kathmandu', NL: 'Europe/Amsterdam', NZ: 'Pacific/Auckland',
  NI: 'America/Managua', NE: 'Africa/Niamey', NG: 'Africa/Lagos', NO: 'Europe/Oslo',
  OM: 'Asia/Muscat', PK: 'Asia/Karachi', PW: 'Pacific/Palau', PA: 'America/Panama',
  PG: 'Pacific/Port_Moresby', PY: 'America/Asuncion', PE: 'America/Lima', PH: 'Asia/Manila',
  PL: 'Europe/Warsaw', PT: 'Europe/Lisbon', QA: 'Asia/Qatar', RO: 'Europe/Bucharest',
  RU: 'Europe/Moscow', RW: 'Africa/Kigali', KN: 'America/St_Kitts', LC: 'America/St_Lucia',
  VC: 'America/St_Vincent', WS: 'Pacific/Apia', SM: 'Europe/San_Marino', ST: 'Africa/Sao_Tome',
  SA: 'Asia/Riyadh', SN: 'Africa/Dakar', RS: 'Europe/Belgrade', SC: 'Indian/Mahe',
  SL: 'Africa/Freetown', SG: 'Asia/Singapore', SK: 'Europe/Bratislava', SI: 'Europe/Ljubljana',
  SB: 'Pacific/Guadalcanal', SO: 'Africa/Mogadishu', ZA: 'Africa/Johannesburg', ES: 'Europe/Madrid',
  LK: 'Asia/Colombo', SD: 'Africa/Khartoum', SR: 'America/Paramaribo', SZ: 'Africa/Mbabane',
  SE: 'Europe/Stockholm', CH: 'Europe/Zurich', SY: 'Asia/Damascus', TW: 'Asia/Taipei',
  TJ: 'Asia/Dushanbe', TZ: 'Africa/Dar_es_Salaam', TH: 'Asia/Bangkok', TL: 'Asia/Dili',
  TG: 'Africa/Lome', TO: 'Pacific/Tongatapu', TT: 'America/Port_of_Spain', TN: 'Africa/Tunis',
  TR: 'Europe/Istanbul', TM: 'Asia/Ashgabat', TV: 'Pacific/Funafuti', UG: 'Africa/Kampala',
  UA: 'Europe/Kiev', AE: 'Asia/Dubai', GB: 'Europe/London', US: 'America/New_York',
  UY: 'America/Montevideo', UZ: 'Asia/Tashkent', VU: 'Pacific/Efate', VE: 'America/Caracas',
  VN: 'Asia/Ho_Chi_Minh', YE: 'Asia/Aden', ZM: 'Africa/Lusaka', ZW: 'Africa/Harare',
}

const US_CITY_TIMEZONE_MAP: Record<string, string> = {
  'new york': 'America/New_York', 'los angeles': 'America/Los_Angeles',
  'chicago': 'America/Chicago', 'houston': 'America/Chicago',
  'phoenix': 'America/Phoenix', 'philadelphia': 'America/New_York',
  'san antonio': 'America/Chicago', 'san diego': 'America/Los_Angeles',
  'dallas': 'America/Chicago', 'san francisco': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles', 'denver': 'America/Denver',
  'boston': 'America/New_York', 'miami': 'America/New_York',
  'atlanta': 'America/New_York', 'detroit': 'America/Detroit',
  'minneapolis': 'America/Chicago', 'anchorage': 'America/Anchorage',
  'honolulu': 'Pacific/Honolulu',
}

export function getTimezoneFromCountry(countryCode: string, city?: string | null): string | null {
  const code = countryCode.toUpperCase()
  if (code === 'US' && city) {
    const cityLower = city.toLowerCase()
    if (US_CITY_TIMEZONE_MAP[cityLower]) return US_CITY_TIMEZONE_MAP[cityLower]
  }
  return COUNTRY_TIMEZONE_MAP[code] || null
}

export function calculateSendTimeForTimezone(targetHour: number, timezone: string): Date {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const getValue = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
  const tzYear = getValue('year'), tzMonth = getValue('month'), tzDay = getValue('day'), tzHour = getValue('hour')

  let targetDate: Date
  if (tzHour < targetHour) {
    targetDate = new Date(`${tzYear}-${String(tzMonth).padStart(2, '0')}-${String(tzDay).padStart(2, '0')}T${String(targetHour).padStart(2, '0')}:00:00`)
  } else {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tParts = formatter.formatToParts(tomorrow)
    const tGetValue = (type: string) => parseInt(tParts.find(p => p.type === type)?.value || '0')
    targetDate = new Date(`${tGetValue('year')}-${String(tGetValue('month')).padStart(2, '0')}-${String(tGetValue('day')).padStart(2, '0')}T${String(targetHour).padStart(2, '0')}:00:00`)
  }

  const refStr = targetDate.toLocaleString('en-US', { timeZone: timezone })
  const utcStr = targetDate.toLocaleString('en-US', { timeZone: 'UTC' })
  const offsetMs = new Date(refStr).getTime() - new Date(utcStr).getTime()
  return new Date(targetDate.getTime() - offsetMs)
}
