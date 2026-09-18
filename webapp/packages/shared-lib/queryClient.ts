import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey, handling objects as query parameters
    const urlParts: string[] = [];
    let queryParams: Record<string, string> = {};

    for (const key of queryKey) {
      if (typeof key === "string") {
        urlParts.push(key);
      } else if (typeof key === "object" && key !== null) {
        // Convert object to query parameters
        for (const [k, v] of Object.entries(key)) {
          if (v !== undefined && v !== null) {
            if (Array.isArray(v)) {
              queryParams[k] = JSON.stringify(v);
            } else if (typeof v === "object") {
              queryParams[k] = JSON.stringify(v);
            } else {
              queryParams[k] = String(v);
            }
          }
        }
      }
    }

    const baseUrl = urlParts.join("/");
    
    // Build URL - handle both client and server environments
    let url: URL;
    if (typeof window !== "undefined") {
      url = new URL(baseUrl, window.location.origin);
    } else {
      // Server-side: use a relative URL or environment variable for base URL
      const baseUrlEnv = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      url = new URL(baseUrl, baseUrlEnv);
    }
    
    // Add query parameters
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: getQueryFn({ on401: "throw" }),
        refetchInterval: false,
        refetchOnWindowFocus: false,
        // Data is considered fresh for 5 minutes, then stale
        // Stale data will be refetched in the background on next component mount
        staleTime: 5 * 60 * 1000, // 5 minutes
        // Cache unused data for 10 minutes before garbage collection
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// For client-side: create a singleton instance
let browserQueryClient: QueryClient | undefined = undefined;
export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: use singleton pattern to keep the same query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// Export a singleton for backward compatibility with existing code
export const queryClient = getQueryClient();

