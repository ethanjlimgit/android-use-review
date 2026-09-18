import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Toaster } from "@droiduse/shared-ui/toaster";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Droid Use Admin - CMS",
  description: "Content Management System for Droid Use",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Try to get session, but don't fail if it doesn't exist (for login page)
  let session;
  try {
    session = await auth();
  } catch (error) {
    // If auth fails, session will be null
    session = null;
  }

  // Check if we're rendering the (auth) route group by checking if children
  // is a route segment that matches the login pattern
  // Since we can't easily detect this, we'll use a try-catch approach:
  // If session exists and is admin, show admin layout
  // If session doesn't exist, middleware will handle redirect to /login
  // If session exists but not admin, redirect to /login
  
  if (session && session.user.role === "admin") {
    // Authenticated admin - show admin layout with sidebar
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.variable}>
          <Providers>
            <div className="min-h-screen flex">
              <AdminSidebar />
              <main className="flex-1 p-8">
                {children}
              </main>
              <Toaster />
            </div>
          </Providers>
        </body>
      </html>
    );
  }

  // Not authenticated or not admin - show basic layout (for login page)
  // Middleware will redirect non-login pages to /login
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

