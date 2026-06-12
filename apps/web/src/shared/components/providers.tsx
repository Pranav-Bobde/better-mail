"use client";

import { Toaster } from "@code-main/ui/components/sonner";
import { TooltipProvider } from "@code-main/ui/components/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/shared/utils/orpc";

import { ThemeProvider } from "@/shared/components/theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
