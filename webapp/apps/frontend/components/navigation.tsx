"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useAnalytics } from "@/providers/analytics-provider";
import { useSettings } from "@/providers/settings-provider";
import { Button } from "@droiduse/shared-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@droiduse/shared-ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@droiduse/shared-ui/navigation-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@droiduse/shared-ui/avatar";
import { Menu, LogOut, User, Settings, Download, CreditCard, Heart, Car, TrendingUp, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@droiduse/shared-ui/sheet";
import { cn } from "@droiduse/shared-ui/utils";
import { PRODUCT_TAGLINES } from "@/lib/products";

const products = [
  {
    href: "/products/ask-boris",
    title: "For Everyday People",
    tagline: "Personal Automation",
    description: "Automatically handle grocery delivery, dating profiles, reminders, and more.",
    icon: Car,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    href: "/products/ask-charlie",
    title: "For Seniors & Family",
    tagline: "Elderly Assistance",
    description: "Help your parents use their smartphone with confidence. Just speak naturally.",
    icon: Heart,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    href: "/products/androiduse",
    title: "For Marketers & Businesses",
    tagline: "Marketing Automation",
    description: "Run TikTok campaigns, manage social media at scale, and automate device farms.",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
];

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
];

const authNavLinks = [
  { href: "/pricing", label: "Pricing" },
];

export type ProductBrand = "ask-boris" | "ask-charlie" | "androiduse";

const productBrands: Record<ProductBrand, { name: string; color: string; btnClass: string; showDownload: boolean }> = {
  "ask-boris": { name: "Ask Boris", color: "text-emerald-400", btnClass: "bg-emerald-600 hover:bg-emerald-700", showDownload: true },
  "ask-charlie": { name: "Ask Charlie", color: "text-purple-400", btnClass: "bg-purple-500 hover:bg-purple-600", showDownload: true },
  "androiduse": { name: "AndroidUse", color: "text-[#8F7FFF]", btnClass: "", showDownload: false },
};

interface NavigationProps {
  product?: ProductBrand;
}

export function Navigation({ product }: NavigationProps = {}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const analytics = useAnalytics();
  const { getSetting } = useSettings();
  const defaultSiteName = getSetting("site.name");
  const playstoreUrl = getSetting("url.playstore.internal.test");
  const brand = product ? productBrands[product] : null;
  const siteName = brand ? brand.name : defaultSiteName;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md overflow-hidden">
                <Image
                  src="/logo.png"
                  alt={`${siteName} Logo`}
                  width={32}
                  height={32}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span className={cn("text-lg font-semibold tracking-tight", brand?.color)} data-testid="text-logo">
                {siteName}
              </span>
            </Link>

            {/* Navigation with Product dropdown */}
            <nav className="hidden md:flex items-center gap-1">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-base bg-transparent">
                      Products
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[480px] gap-1 p-3">
                        {products.map((product) => (
                          <li key={product.href}>
                            <NavigationMenuLink asChild>
                              <Link
                                href={product.href}
                                className={cn(
                                  "flex items-center gap-4 rounded-md p-3 transition-colors hover:bg-accent"
                                )}
                              >
                                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", product.bg)}>
                                  <product.icon className={cn("h-5 w-5", product.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold leading-none">{product.title}</span>
                                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full bg-background/50", product.color)}>
                                      {product.tagline}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{product.description}</p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>

              {[...navLinks, ...(session ? authNavLinks : [])].map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={pathname === link.href ? "secondary" : "ghost"}
                    size="default"
                    className="text-base"
                    data-testid={`link-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Get the App button — hidden on AndroidUse B2B page */}
            {(!brand || brand.showDownload) && (
              <Button variant="default" size="default" className={cn("gap-2 text-base", brand?.btnClass)} asChild>
                <a
                  href={playstoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download the App</span>
                </a>
              </Button>
            )}

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || ""} />
                      <AvatarFallback>
                        {session?.user?.name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session?.user?.name || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/dashboard">
                      <User className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/settings/subscription">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Subscription</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      analytics.capture("user_signed_out")
                      analytics.reset()
                      signOut({ callbackUrl: "/" })
                    }}
                    className="cursor-pointer text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="default" className="text-base" asChild>
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <nav className="flex flex-col gap-2 mt-8">
                  {/* Products section */}
                  <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Products</p>
                  {products.map((product) => (
                    <Link key={product.href} href={product.href} onClick={() => setMobileOpen(false)}>
                      <Button
                        variant={pathname.startsWith(product.href) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 h-auto py-2.5"
                      >
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", product.bg)}>
                          <product.icon className={cn("h-3.5 w-3.5", product.color)} />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium leading-none">{product.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{product.tagline}</div>
                        </div>
                      </Button>
                    </Link>
                  ))}

                  <div className="my-2 border-t border-border" />

                  {/* Other nav links */}
                  {[...navLinks, ...(session ? authNavLinks : [])].map((link) => (
                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                      <Button
                        variant={pathname === link.href ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        data-testid={`link-mobile-${link.label.toLowerCase()}`}
                      >
                        {link.label}
                      </Button>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
