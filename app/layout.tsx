import type { Metadata } from "next";
import "./globals.css";

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(productionHost),
  title: {
    default: "Dinny — Dinner, decided.",
    template: "%s · Dinny",
  },
  description: "Three practical dinner ideas, picked for you.",
  applicationName: "Dinny",
  openGraph: {
    title: "Dinny — Dinner, decided.",
    description: "Three practical dinner ideas, picked for you.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "food recc",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dinny — Dinner, decided.",
    description: "Three practical dinner ideas, picked for you.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
