import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aura.bynoor.io'),
  title: "Aura — Every stock analyst. One clear signal.",
  description: "Discover market-moving conviction by tracking real-time sentiment across top YouTube finance channels.",
  openGraph: {
    siteName: "Aura",
    title: "Aura — Every stock analyst. One clear signal.",
    description: "Discover market-moving conviction by tracking real-time sentiment across top YouTube finance channels.",
    url: "https://aura.bynoor.io",
    type: "website",
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Aura — Every stock analyst. One clear signal.',
        type: 'image/png',
      }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0A0F1A] text-[#F1F5F9] font-[family-name:var(--font-geist-sans)]" suppressHydrationWarning>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
