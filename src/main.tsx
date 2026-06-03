import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { reportClientError } from "./api";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 20_000,
      // The dashboard already polls on refreshInSec; refetching on every window
      // focus just adds redundant fetches and re-renders ~90 cards.
      refetchOnWindowFocus: false,
    },
  },
});

if (import.meta.env.PROD) {
  window.addEventListener("error", (event) => {
    void reportClientError({
      source: "window-error",
      message: event.message || "Unhandled window error",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    const stack = event.reason instanceof Error ? event.reason.stack : undefined;
    void reportClientError({
      source: "unhandledrejection",
      message: reason,
      stack,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
