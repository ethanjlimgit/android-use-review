"use client";

import { format } from "date-fns";
import { Calendar, User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@droiduse/shared-ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

type BlogPostWithContent = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  } | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

export default function BlogPost({ post }: { post: BlogPostWithContent }) {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/blog">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        <article>
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {post.title}
            </h1>
            
            {post.excerpt && (
              <p className="text-xl text-muted-foreground mb-6">{post.excerpt}</p>
            )}

            <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
              {post.author && (
                <div className="flex items-center gap-2">
                  {post.author.image && (
                    <img
                      src={post.author.image}
                      alt={post.author.name || post.author.username || "Author"}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <User className="h-4 w-4" />
                  <span>{post.author.name || post.author.username || "Unknown"}</span>
                </div>
              )}
              {post.publishedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <time dateTime={new Date(post.publishedAt).toISOString()}>
                    {format(new Date(post.publishedAt), "MMMM d, yyyy")}
                  </time>
                </div>
              )}
            </div>

            {post.featuredImage && (
              <div className="relative w-full h-96 mb-8 rounded-lg overflow-hidden">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="object-cover w-full h-full"
                />
              </div>
            )}
          </header>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  );
}

