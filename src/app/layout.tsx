import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ZoomGuard } from "@/components/ZoomGuard";
import { TelemetryReporter } from "@/components/TelemetryReporter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taxiro.vercel.app";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Taxiro",
      url: siteUrl,
      logo: `${siteUrl}/icons/taxiro-icon-512.png`,
      sameAs: [],
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: "Taxiro",
      applicationCategory: "TravelApplication",
      operatingSystem: "Web, iOS, Android, Windows, macOS",
      url: siteUrl,
      image: `${siteUrl}/og/taxiro-og.png`,
      description:
        "Map-first bike taxi booking for India with ready signals, live rider tracking, private ride-code verification, and transparent rider earnings.",
      inLanguage: "en-IN",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
      },
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
    {
      "@type": "Service",
      "@id": `${siteUrl}/#service`,
      name: "Taxiro Bike Taxi Booking",
      serviceType: "Bike taxi ride booking and rider matching",
      provider: {
        "@id": `${siteUrl}/#organization`,
      },
      areaServed: {
        "@type": "Place",
        name: "Hyderabad, Telangana, India",
        geo: {
          "@type": "GeoCoordinates",
          latitude: 17.385,
          longitude: 78.4867,
        },
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Taxiro | Predictive Bike Taxi App",
    template: "%s | Taxiro",
  },
  description:
    "Taxiro is a map-first bike taxi web app for India with ride-now booking, advance ready signals, live rider tracking, private ride-code verification, and transparent rider earnings.",
  applicationName: "Taxiro",
  generator: "Next.js",
  keywords: [
    "Taxiro",
    "bike taxi India",
    "bike taxi Hyderabad",
    "ride booking app",
    "rider ready signals",
    "live rider tracking",
    "advance bike taxi booking",
    "Supabase bike taxi MVP",
    "OpenStreetMap ride app",
  ],
  authors: [{ name: "Taxiro" }],
  creator: "Taxiro",
  publisher: "Taxiro",
  category: "mobility",
  classification: "Bike taxi, ride hailing, urban mobility",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/taxiro-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/taxiro-icon-32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/icons/taxiro-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/taxiro-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/taxiro-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Taxiro",
  },
  openGraph: {
    type: "website",
    siteName: "Taxiro",
    title: "Taxiro | Predictive Bike Taxi App",
    description:
      "Book, track, verify, and ride with Taxiro: a map-first bike taxi MVP for India with live rider tracking and ready demand signals.",
    url: "/",
    locale: "en_IN",
    images: [
      {
        url: "/og/taxiro-og.png",
        width: 1200,
        height: 630,
        alt: "Taxiro bike taxi app preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Taxiro | Predictive Bike Taxi App",
    description:
      "Map-first bike taxi booking with ready signals, live rider tracking, private ride codes, and transparent rider earnings.",
    images: ["/og/taxiro-og.png"],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  other: {
    "geo.region": "IN-TG",
    "geo.placename": "Hyderabad, Telangana, India",
    "geo.position": "17.3850;78.4867",
    ICBM: "17.3850, 78.4867",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Taxiro",
    "theme-color": "#101713",
    "msapplication-TileColor": "#101713",
    "msapplication-TileImage": "/icons/taxiro-icon-192.png",
    "llms-txt": "/llms.txt",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  width: "device-width",
  themeColor: "#101713",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key='taxiro-theme';var stored=localStorage.getItem(key);var theme=stored==='dark'||stored==='light'?stored:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          type="application/ld+json"
        />
        <ZoomGuard />
        <TelemetryReporter />
        {children}
      </body>
    </html>
  );
}
