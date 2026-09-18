import { Navigation } from '@/components/navigation';
import { PricingCards } from '@/components/pricing/pricing-cards';
import { PricingFAQ } from '@/components/pricing/pricing-faq';
import { PricingComparison } from '@/components/pricing/pricing-comparison';
import type { Metadata } from "next";
import { getSiteName } from "@/lib/settings";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const description = `Simple, transparent pricing for ${siteName}. Choose the plan that fits your AI-powered Android automation needs.`;

  return {
    title: `Pricing - ${siteName}`,
    description,
    openGraph: {
      title: `Pricing - ${siteName}`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Pricing - ${siteName}`,
      description,
    },
  };
}

export default async function PricingPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }
  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-24 pb-12">
        {/* Hero Section */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include access to our marketplace and device management.
            </p>
          </div>

          {/* Pricing Cards */}
          <PricingCards />

          {/* Feature Comparison Table */}
          <div className="mt-24">
            <h2 className="text-3xl font-bold text-center mb-12">Compare Plans</h2>
            <PricingComparison />
          </div>

          {/* FAQ Section */}
          <div className="mt-24">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <PricingFAQ />
          </div>
        </div>
      </div>
    </>
  );
}
