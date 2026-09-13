import type { Metadata } from 'next';
import './globals.css';

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
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-cruvels-dark text-cruvels-text antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
