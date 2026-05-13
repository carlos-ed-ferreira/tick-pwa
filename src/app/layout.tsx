import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = "Tick";
const appDescription =
  "An offline-first personal productivity PWA for daily tasks and goals.";

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appName,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: appName,
    title: appName,
    description: appDescription,
  },
  twitter: {
    card: "summary",
    title: appName,
    description: appDescription,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f9faf9",
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
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
