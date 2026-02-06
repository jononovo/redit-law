import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/query-provider";

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
  title: "CreditClaw - Give your bot a card",
  description: "The fun, safe way to give your OpenClaw agent an allowance.",
  openGraph: {
    title: "CreditClaw - Give your bot a card",
    description: "The fun, safe way to give your OpenClaw agent an allowance.",
    type: "website",
    images: ["/images/fun-claw-card.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@creditclaw",
    title: "CreditClaw",
    description: "The fun, safe way to give your OpenClaw agent an allowance.",
    images: ["/images/fun-claw-card.png"],
  },
  icons: {
    icon: "/favicon.png",
  },
};

function AnnouncementBar() {
  return (
    <div className="bg-neutral-800 text-white text-xs font-medium py-2 text-center fixed top-0 w-full z-[60]">
      <span>Get ready for the launch party on 11 February, 2026</span>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body>
        <QueryProvider>
          <TooltipProvider>
            <Toaster />
            <AnnouncementBar />
            {children}
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
