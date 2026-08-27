import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { detectRequestLocale, LOCALE_COOKIE_KEY } from '@/lib/i18n';
import { AppProvider } from '@/providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const appName = 'Tick';
const appDescription =
  'An offline-first personal productivity PWA for daily tasks and goals.';

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appName,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: appName,
    title: appName,
    description: appDescription,
  },
  twitter: {
    card: 'summary',
    title: appName,
    description: appDescription,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#253241',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const initialLocale = detectRequestLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_KEY)?.value ?? null,
    acceptLanguage: headerStore.get('accept-language'),
  });

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProvider initialLocale={initialLocale}>{children}</AppProvider>
      </body>
    </html>
  );
}
