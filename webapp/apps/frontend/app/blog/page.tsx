import { Navigation } from "@/components/navigation";
import BlogList from "@/components/pages/blog-list";
import type { Metadata } from "next";
import { getSiteName } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const description = `Read the latest articles, tutorials, and updates from the ${siteName} team`;

  return {
    title: `Blog - ${siteName}`,
    description,
    openGraph: {
      title: `Blog - ${siteName}`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Blog - ${siteName}`,
      description,
    },
  };
}

export default function BlogPage() {
  return (
    <>
      <Navigation />
      <BlogList />
    </>
  );
}

