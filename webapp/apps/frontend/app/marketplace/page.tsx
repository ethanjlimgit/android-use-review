import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { getSiteName } from "@/lib/settings";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@droiduse/shared-ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const description = `Browse and discover automation apps, knowledge packs, and integrations on the ${siteName} marketplace.`;

  return {
    title: `Marketplace - ${siteName}`,
    description,
    openGraph: {
      title: `Marketplace - ${siteName}`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Marketplace - ${siteName}`,
      description,
    },
  };
}

// Dynamic import for Marketplace - heavy component with filtering logic
const Marketplace = dynamic(() => import("@/components/pages/marketplace"), {
  loading: () => <MarketplaceSkeleton />,
});

function MarketplaceSkeleton() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 space-y-2">
          <div className="h-9 w-48 bg-muted animate-pulse rounded" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="mb-6">
          <div className="h-10 w-full max-w-md bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="h-4 w-4/5 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Navigation />
      <Marketplace />
    </>
  );
}
