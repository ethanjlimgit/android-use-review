import { Navigation } from "@/components/navigation";
import BlogPost from "@/components/pages/blog-post";
import { storage } from "@droiduse/shared-lib/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  // Generate static params for published posts
  // Returns empty array if database is unavailable (builds without DB connection)
  try {
    const posts = await storage.getBlogPosts({ status: "published" });
    return posts.map((post) => ({
      slug: post.slug,
    }));
  } catch {
    // Database not available at build time - pages will be generated on-demand
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await storage.getBlogPostBySlug(slug);

  if (!post || post.status !== "published") {
    return {
      title: "Post Not Found",
    };
  }

  const metadata: Metadata = {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || post.title,
    keywords: post.seoKeywords?.split(",").map((k) => k.trim()),
    authors: post.author ? [{ name: post.author.name || post.author.username || "Unknown" }] : undefined,
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || post.title,
      type: "article",
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      authors: post.author ? [post.author.name || post.author.username || "Unknown"] : undefined,
      images: post.featuredImage ? [post.featuredImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || post.title,
      images: post.featuredImage ? [post.featuredImage] : undefined,
    },
  };

  return metadata;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await storage.getBlogPostBySlug(slug, true);

  if (!post || post.status !== "published") {
    notFound();
  }

  return (
    <>
      <Navigation />
      <BlogPost post={post} />
    </>
  );
}

