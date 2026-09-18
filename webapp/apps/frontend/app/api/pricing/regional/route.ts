import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiHandler } from '@/lib/api-helpers';
import {
  getClientGeolocation,
  getIPFromRequest,
} from '@droiduse/shared-lib/server';
import {
  getRegionalPricingInfo,
  calculateRegionalPrice,
  type PricingRegion,
} from '@droiduse/shared-lib';
import { PRICING_TIERS_CLIENT } from '@droiduse/shared-lib';

const COUNTRY_COOKIE_NAME = 'detected_country';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

interface RegionalPricingResponse {
  countryCode: string | null;
  countryName: string | null;
  region: PricingRegion;
  regionName: string | null;
  discountPercentage: number;
  hasDiscount: boolean;
  prices: {
    basic: {
      monthly: { original: number; discounted: number };
      yearly: { original: number; discounted: number };
    };
    premium: {
      monthly: { original: number; discounted: number };
      yearly: { original: number; discounted: number };
    };
    business: {
      monthly: { original: number; discounted: number };
      yearly: { original: number; discounted: number };
    };
  };
}

/**
 * GET /api/pricing/regional
 * Returns regional pricing info based on user's IP geolocation
 * Caches country detection in a cookie for 24 hours
 */
export const GET = apiHandler(async (request: NextRequest) => {
  let countryCode: string | null = null;
  let countryName: string | null = null;

  // Check for cached country in cookie
  const cookieStore = await cookies();
  const cachedCountry = cookieStore.get(COUNTRY_COOKIE_NAME)?.value;

  if (cachedCountry) {
    // Parse cached value (format: "CC:Country Name" or just "CC")
    const parts = cachedCountry.split(':');
    countryCode = parts[0] || null;
    countryName = parts[1] || null;
  } else {
    // Detect country from IP
    const ip = getIPFromRequest(request.headers);

    if (ip) {
      const geolocation = await getClientGeolocation(request.headers);

      if (geolocation) {
        countryCode = geolocation.countryCode;
        countryName = geolocation.country;
      }
    }

    // Cache in cookie (regardless of whether we found a country)
    const cookieValue = countryCode
      ? countryName
        ? `${countryCode}:${countryName}`
        : countryCode
      : '';

    cookieStore.set(COUNTRY_COOKIE_NAME, cookieValue, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  // Get regional pricing info
  const pricingInfo = getRegionalPricingInfo(countryCode);

  // Calculate prices for all tiers
  const prices: RegionalPricingResponse['prices'] = {
    basic: {
      monthly: {
        original: PRICING_TIERS_CLIENT.basic.monthlyPrice,
        discounted: calculateRegionalPrice(
          PRICING_TIERS_CLIENT.basic.monthlyPrice,
          pricingInfo.region
        ),
      },
      yearly: {
        original: PRICING_TIERS_CLIENT.basic.yearlyPrice,
        discounted: calculateRegionalPrice(
          PRICING_TIERS_CLIENT.basic.yearlyPrice,
          pricingInfo.region
        ),
      },
    },
    premium: {
      monthly: {
        original: PRICING_TIERS_CLIENT.premium.monthlyPrice,
        discounted: calculateRegionalPrice(
          PRICING_TIERS_CLIENT.premium.monthlyPrice,
          pricingInfo.region
        ),
      },
      yearly: {
        original: PRICING_TIERS_CLIENT.premium.yearlyPrice,
        discounted: calculateRegionalPrice(
          PRICING_TIERS_CLIENT.premium.yearlyPrice,
          pricingInfo.region
        ),
      },
    },
    business: {
      monthly: {
        original: PRICING_TIERS_CLIENT.business.monthlyPrice,
        discounted: calculateRegionalPrice(
          PRICING_TIERS_CLIENT.business.monthlyPrice,
          pricingInfo.region
        ),
      },
      yearly: {
        original: PRICING_TIERS_CLIENT.business.yearlyPrice,
        discounted: calculateRegionalPrice(
          PRICING_TIERS_CLIENT.business.yearlyPrice,
          pricingInfo.region
        ),
      },
    },
  };

  const response: RegionalPricingResponse = {
    countryCode,
    countryName,
    region: pricingInfo.region,
    regionName: pricingInfo.regionName,
    discountPercentage: pricingInfo.discountPercentage,
    hasDiscount: pricingInfo.hasDiscount,
    prices,
  };

  return NextResponse.json(response);
});
