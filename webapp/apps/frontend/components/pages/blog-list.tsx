"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card";
import { Badge } from "@droiduse/shared-ui/badge";
import { Calendar, User, ArrowRight } from "lucide-react";
import { Skeleton } from "@droiduse/shared-ui/skeleton";
import { useSettings } from "@/providers/settings-provider";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  author: {
    id: string;
    name: string | null;
    username: string | null;
  } | null;
  publishedAt: Date | null;
  featured: boolean;
};

async function fetchBlogPosts(): Promise<BlogPost[]> {
  const response = await fetch("/api/blog");
  if (!response.ok) {
    throw new Error("Failed to fetch blog posts");
  }
  return response.json();
}

export default function BlogList() {
  const { getSetting } = useSettings();
  const siteName = getSetting("site.name");
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: fetchBlogPosts,
  });

  if (error) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Failed to load blog posts. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Blog</h1>
          <p className="text-lg text-muted-foreground">
            Read the latest articles, tutorials, and updates from the {siteName} team
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  {post.featuredImage && (
                    <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      {post.featured && (
                        <Badge variant="default" className="text-xs">
                          Featured
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {post.excerpt || "Read more..."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {post.author && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{post.author.name || post.author.username || "Unknown"}</span>
                        </div>
                      )}
                      {post.publishedAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(post.publishedAt), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center text-primary font-medium">
                      Read more <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No blog posts found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

