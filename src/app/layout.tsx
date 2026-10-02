import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from '@/components/layout/ThemeProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#070E1A' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Cruvels Internal Portal — Workplace Management System',
    template: '%s | Cruvels Internal Portal',
  },
  description: 'Cruvels Internal Portal — Official enterprise workspace, employee directory, and internal operations management platform.',
  applicationName: 'Cruvels Internal Portal',
  authors: [{ name: 'Cruvels Technologies' }],
  keywords: ['Cruvels', 'Cruvels Internal Portal', 'Internal Portal', 'Workplace Management', 'Employee Portal'],
  openGraph: {
    title: 'Cruvels Internal Portal',
    description: 'Cruvels Internal Portal — Official enterprise workspace, employee directory, and internal operations management platform.',
    siteName: 'Cruvels Internal Portal',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Cruvels Internal Portal',
    description: 'Cruvels Internal Portal — Official enterprise workspace and internal operations platform.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/cruvels-logo-transparent.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Inline script: apply stored theme BEFORE first paint to avoid flash.
          This runs synchronously so there is zero FOUC.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var cookieTheme=(document.cookie.match(/(?:^|;\\s*)cruvels-theme=([^;]*)/))||[];
  var t=cookieTheme[1]||localStorage.getItem('cruvels-theme');
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme','dark');
  }else{
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme','light');
  }
  if(t){localStorage.setItem('cruvels-theme',t);document.cookie='cruvels-theme='+t+';path=/;max-age=31536000;SameSite=Lax';}
}catch(e){}})();`,
          }}
        />
        {/* Bricolage Grotesque + Archivo — preconnect for speed */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Archivo:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen antialiased"
        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
