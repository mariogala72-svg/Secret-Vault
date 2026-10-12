"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/client/auth";
import { VaultProvider } from "@/lib/client/vault";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <AuthProvider>
        <VaultProvider>
          {children}
          <Toaster position="top-center" richColors closeButton toastOptions={{ style: { borderRadius: 14 } }} />
        </VaultProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
