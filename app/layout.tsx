import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://creditclaw.com"),
  title: "CreditClaw - Give your bot a card",
  description: "The fun, safe way to give your OpenClaw agent an allowance. Virtual Visa/Mastercard for AI agents, funded by their humans.",
  openGraph: {
    title: "CreditClaw - Give your bot a card",
    description: "The fun, safe way to give your OpenClaw agent an allowance. Virtual Visa/Mastercard for AI agents, funded by their humans.",
    type: "website",
    siteName: "CreditClaw",
    images: [
      {
        url: "/og/og-image.png",
        width: 1200,
        height: 675,
        alt: "CreditClaw - Virtual cards for AI agents",
      },
      {
        url: "/og/og-square.png",
        width: 1200,
        height: 1200,
        alt: "CreditClaw - Virtual cards for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@creditclaw",
    title: "CreditClaw - Give your bot a card",
    description: "The fun, safe way to give your OpenClaw agent an allowance. Virtual Visa/Mastercard for AI agents, funded by their humans.",
    images: [
      {
        url: "/og/og-twitter.png",
        width: 1200,
        height: 675,
        alt: "CreditClaw - Virtual cards for AI agents",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
