"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@droiduse/shared-ui/tooltip";
import { Toaster } from "@droiduse/shared-ui/toaster";
import { SessionProvider } from "@/components/auth/session-provider";
import { getQueryClient } from "@droiduse/shared-lib";
import { AnalyticsProvider } from "@/providers/analytics-provider";
import { SettingsProvider } from "@/providers/settings-provider";
import { useState } from "react";
import type { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

export function Providers({ children, session }: ProvidersProps) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <AnalyticsProvider>
          <SettingsProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </SettingsProvider>
        </AnalyticsProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

