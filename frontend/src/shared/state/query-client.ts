import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // An exhibit's figures are a pure function of its build, and the build
      // is the query key: a cached answer can only be replaced, never stale.
      staleTime: Infinity,
    },
  },
});
