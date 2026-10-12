import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: { default: "Secret Vault — Le parole che contano, al sicuro", template: "%s · Secret Vault" },
  description: "Scrivi messaggi cifrati e programmane la consegna alle persone che ami: in una data speciale o quando non ci sarai più.",
  applicationName: "Secret Vault",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a12" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh grain">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
