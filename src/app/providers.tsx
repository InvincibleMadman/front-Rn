import { PropsWithChildren, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { GlobalErrorCenter } from "@/components/common/global-error-center";
import { authApi } from "@/lib/api/services/auth";
import { useAuthStore } from "@/stores/auth-store";

function shouldProbeSession(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login") return false;
  return true;
}

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  useThemeSync();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 5_000,
          },
        },
      }),
  );

  useEffect(() => {
    void authApi.getCsrfToken().catch(() => undefined);

    const pathname = window.location.pathname;
    if (shouldProbeSession(pathname)) {
      void authApi.me();
      return;
    }

    useAuthStore.getState().setHydrated(true);
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
      <GlobalErrorCenter />
    </QueryClientProvider>
  );
}