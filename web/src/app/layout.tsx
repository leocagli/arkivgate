import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { Web3Providers } from "./_components/web3-providers";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArkivGate - A controlled step between agent intent and execution",
  description:
    "A security gateway for AI agents: prompt firewall, x402 payment guard, wallet threat checks, and Arkiv evidence.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.svg",
  },
  openGraph: {
    title: "ArkivGate - A controlled step between agent intent and execution",
    description:
      "A security gateway for AI agents: prompt firewall, x402 payment guard, wallet threat checks, and Arkiv evidence.",
    images: ["/logo.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ArkivGate",
    description:
      "A security gateway for AI agents: prompt firewall, x402 payment guard, wallet threat checks, and Arkiv evidence.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <Web3Providers>{children}</Web3Providers>
      </body>
    </html>
  );
}
