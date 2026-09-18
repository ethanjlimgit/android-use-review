"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Twitter, Linkedin, MessageCircle, FileText, Briefcase, BookOpen, Store, Mail, Smartphone, LayoutDashboard, DollarSign, ShieldCheck, ScrollText } from "lucide-react";
import { useSettings } from "@/providers/settings-provider";

export function Footer() {
  const pathname = usePathname();
  const { getSetting } = useSettings();

  const siteName = getSetting("site.name");
  const githubUrl = getSetting("url.social.github");
  const twitterUrl = getSetting("url.social.twitter");
  const linkedinUrl = getSetting("url.social.linkedin");
  const discordUrl = getSetting("url.social.discord");

  // Hide footer on dashboard, settings, and auth pages
  const hideFooter = pathname.startsWith('/dashboard') ||
                     pathname.startsWith('/settings') ||
                     pathname.startsWith('/auth');

  if (hideFooter) {
    return null;
  }

  // Show footer on all other pages
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              </li>
              {/*<li>
                <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Store className="h-3.5 w-3.5" />
                  Marketplace
                </Link>
              </li>*/}
              <li>
                <Link href="/devices" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5" />
                  Devices
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5" />
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" />
                  Blog
                </Link>
              </li>
              <li>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Github className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </li>
              <li>
                <Link href="/careers" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/legal/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <ScrollText className="h-3.5 w-3.5" />
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Connect</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Github className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Twitter className="h-3.5 w-3.5" />
                  X (Twitter)
                </a>
              </li>
              <li>
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* Bottom Bar - Full Width */}
      <div className="border-t border-border w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {siteName} © 2026 Action State Labs
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground transition-colors">
                Documentation
              </Link>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
