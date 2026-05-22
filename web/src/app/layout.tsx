import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
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
  title: "ArkivGate — Un paso controlado entre la intención y la respuesta",
  description:
    "El firewall de Claude Code corporativo. Reglas no-code, redacción en runtime y auditoría completa.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.svg",
  },
  openGraph: {
    title: "ArkivGate — Un paso controlado entre la intención y la respuesta",
    description:
      "El firewall de Claude Code corporativo. Reglas no-code, redacción en runtime y auditoría completa.",
    images: ["/logo.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ArkivGate",
    description:
      "El firewall de Claude Code corporativo. Reglas no-code, redacción en runtime y auditoría completa.",
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
      lang="es"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
