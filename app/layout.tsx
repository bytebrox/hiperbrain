import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "hiperbrain - a brain that computes with 10,000-dimensional vectors";
const DESCRIPTION =
  "An interactive collective brain built on Hyperdimensional Computing (HDC / VSA). Teach it facts and ask it questions - it learns one-shot, reasons by analogy and is fault-tolerant, all in pure CPU math, live in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hiperbrain.com"),
  applicationName: "hiperbrain",
  title: {
    default: TITLE,
    template: "%s - hiperbrain",
  },
  description: DESCRIPTION,
  keywords: [
    "Hyperdimensional Computing",
    "HDC",
    "Vector Symbolic Architecture",
    "VSA",
    "collective brain",
    "associative memory",
    "neuro-symbolic AI",
    "hiperbrain",
  ],
  authors: [{ name: "hiperbrain" }],
  creator: "hiperbrain",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description:
      "A collective brain built on Hyperdimensional Computing. Teach it facts, ask it questions - the thinking happens live in your browser.",
    url: "https://www.hiperbrain.com",
    siteName: "hiperbrain",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "hiperbrain",
    site: "@hiperbrainx",
    creator: "@hiperbrainx",
    description:
      "A collective brain built on Hyperdimensional Computing. Teach it facts, ask it questions - the thinking happens live in your browser.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
