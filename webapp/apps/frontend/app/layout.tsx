import "./globals.css";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import { Footer } from "@/components/footer";
import { auth } from "@/lib/auth";
import { getSiteName } from "@/lib/settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const description = "The personal assistant that actually does the work for you. No more tapping, scrolling, or copy-pasting. AI-powered Android automation made simple.";

  return {
    title: {
      default: `${siteName} - PhoneGPT, The Better Siri`,
      template: `%s | ${siteName}`,
    },
    description,
    keywords: [
      "Android automation",
      "AI assistant",
      "mobile automation",
      "Android AI",
      "phone automation",
      "task automation",
      "Android control",
      "AI agent",
      "mobile AI",
      siteName,
    ],
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://androiduse.com"),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: "/",
      siteName,
      title: `${siteName} - PhoneGPT, The Better Siri`,
      description,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `${siteName} - AI-Powered Android Automation`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} - PhoneGPT, The Better Siri`,
      description,
      images: ["/og-image.png"],
      creator: "@androiduse",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon.png", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png" },
      ],
    },
    manifest: "/site.webmanifest",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${plusJakartaSans.variable}`}>
        <Providers session={session}>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

