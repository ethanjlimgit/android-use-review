/**
 * PPP (Purchasing Power Parity) based regional pricing configuration
 * Provides discounts for developing markets while maintaining USD pricing
 */

export type PricingRegion =
  | 'south_asia'
  | 'southeast_asia'
  | 'latin_america'
  | 'eastern_europe'
  | 'africa'
  | 'default';

export interface RegionalPricingConfig {
  region: PricingRegion;
  name: string;
  multiplier: number; // Price multiplier (e.g., 0.35 = 65% discount)
  countries: string[];
}

/**
 * PPP Regions mapping with discount multipliers
 * multiplier = 1 - discount_percentage (e.g., 0.35 = 65% off)
 */
export const PPP_REGIONS: Record<Exclude<PricingRegion, 'default'>, RegionalPricingConfig> = {
  south_asia: {
    region: 'south_asia',
    name: 'South Asia',
    multiplier: 0.35, // 65% off
    countries: ['IN', 'PK', 'BD', 'LK', 'NP'], // India, Pakistan, Bangladesh, Sri Lanka, Nepal
  },
  southeast_asia: {
    region: 'southeast_asia',
    name: 'Southeast Asia',
    multiplier: 0.42, // ~58% off
    countries: ['ID', 'PH', 'VN', 'TH', 'MY', 'MM', 'KH', 'LA'], // Indonesia, Philippines, Vietnam, Thailand, Malaysia, Myanmar, Cambodia, Laos
  },
  latin_america: {
    region: 'latin_america',
    name: 'Latin America',
    multiplier: 0.45, // 55% off
    countries: ['BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'EC', 'VE', 'BO', 'PY', 'UY'], // Brazil, Mexico, Argentina, Colombia, Chile, Peru, Ecuador, Venezuela, Bolivia, Paraguay, Uruguay
  },
  eastern_europe: {
    region: 'eastern_europe',
    name: 'Eastern Europe',
    multiplier: 0.50, // 50% off
    countries: ['PL', 'UA', 'RO', 'CZ', 'HU', 'BG', 'SK', 'HR', 'RS', 'BY', 'MD'], // Poland, Ukraine, Romania, Czech Republic, Hungary, Bulgaria, Slovakia, Croatia, Serbia, Belarus, Moldova
  },
  africa: {
    region: 'africa',
    name: 'Africa',
    multiplier: 0.35, // 65% off
    countries: ['NG', 'KE', 'ZA', 'EG', 'GH', 'TZ', 'UG', 'ET', 'MA', 'DZ', 'TN'], // Nigeria, Kenya, South Africa, Egypt, Ghana, Tanzania, Uganda, Ethiopia, Morocco, Algeria, Tunisia
  },
};

// Flat map of country code to region for fast lookup
const COUNTRY_TO_REGION: Record<string, PricingRegion> = {};
for (const [region, config] of Object.entries(PPP_REGIONS)) {
  for (const country of config.countries) {
    COUNTRY_TO_REGION[country] = region as PricingRegion;
  }
}

/**
 * Get the pricing region for a country code
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'IN', 'BR', 'US')
 * @returns The pricing region or 'default' if not in a PPP region
 */
export function getRegionFromCountry(countryCode: string | null | undefined): PricingRegion {
  if (!countryCode) return 'default';
  const upperCode = countryCode.toUpperCase();
  return COUNTRY_TO_REGION[upperCode] || 'default';
}

/**
 * Get regional pricing configuration
 * @param region - The pricing region
 * @returns The regional config or null for default region
 */
export function getRegionalConfig(region: PricingRegion): RegionalPricingConfig | null {
  if (region === 'default') return null;
  return PPP_REGIONS[region] || null;
}

/**
 * Calculate regional price from base USD price
 * @param basePrice - Base price in USD
 * @param region - The pricing region
 * @returns Adjusted price (rounded to 2 decimal places)
 */
export function calculateRegionalPrice(basePrice: number, region: PricingRegion): number {
  if (region === 'default') return basePrice;

  const config = PPP_REGIONS[region];
  if (!config) return basePrice;

  // Apply multiplier and round to 2 decimal places
  return Math.round(basePrice * config.multiplier * 100) / 100;
}

/**
 * Get discount percentage for a region
 * @param region - The pricing region
 * @returns Discount percentage (e.g., 65 for 65% off)
 */
export function getDiscountPercentage(region: PricingRegion): number {
  if (region === 'default') return 0;

  const config = PPP_REGIONS[region];
  if (!config) return 0;

  return Math.round((1 - config.multiplier) * 100);
}

/**
 * Check if a country has regional pricing
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns true if the country has PPP pricing
 */
export function hasRegionalPricing(countryCode: string | null | undefined): boolean {
  return getRegionFromCountry(countryCode) !== 'default';
}

export interface RegionalPricingInfo {
  countryCode: string | null;
  region: PricingRegion;
  regionName: string | null;
  multiplier: number;
  discountPercentage: number;
  hasDiscount: boolean;
}

/**
 * Get complete regional pricing info for a country
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Complete pricing info for the country
 */
export function getRegionalPricingInfo(countryCode: string | null | undefined): RegionalPricingInfo {
  const region = getRegionFromCountry(countryCode);
  const config = getRegionalConfig(region);

  return {
    countryCode: countryCode || null,
    region,
    regionName: config?.name || null,
    multiplier: config?.multiplier || 1,
    discountPercentage: getDiscountPercentage(region),
    hasDiscount: region !== 'default',
  };
}
