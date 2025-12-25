/**
 * Root layout for the archival system.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file layout.tsx
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Metadata for the archival system.
 *
 * @returns {Metadata} The metadata.
 */
export const metadata: Metadata = {
  title: {
    default: "Digital Archival System - The Daily Princetonian",
    template: "%s | The Daily Princetonian",
  },
  description: "End-to-end tooling to generate archives of The Daily Princetonian offical media and articles.",
  keywords: [
    "Daily Princetonian",
    "digital archive",
    "newspaper archive",
    "METS",
    "ALTO",
    "PDF archive",
    "Princeton University",
    "newsletter archive",
  ],
  authors: [{ name: "The Daily Princetonian" }],
  creator: "The Daily Princetonian",
  publisher: "The Daily Princetonian",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Digital Archival System - The Daily Princetonian",
    title: "Digital Archival System - The Daily Princetonian",
    description: "End-to-end tooling to generate archives of The Daily Princetonian offical media and articles.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Archival System - The Daily Princetonian",
    description: "End-to-end tooling to generate archives of The Daily Princetonian offical media and articles.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/**
 * Root layout for the archival system.
 *
 * @param {React.ReactNode} children - The children.
 *
 * @returns {React.ReactNode} The root layout.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
