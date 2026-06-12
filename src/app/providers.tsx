import { PropsWithChildren, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { GlobalErrorCenter } from "@/components/common/global-error-center";
import { authApi } from "@/lib/api/services/auth";

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
    void authApi.me();
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
      <GlobalErrorCenter />
    </QueryClientProvider>
  );
}
