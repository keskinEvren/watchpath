import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f7f3',
};

export const metadata: Metadata = {
  title: 'WatchPath - YouTube Öğrenme Yol Haritası',
  description:
    'Herhangi bir konu veya YouTube linki gir, AI ile yapılandırılmış interaktif öğrenme yol haritası oluştur.',
  openGraph: {
    title: 'WatchPath - YouTube Öğrenme Yol Haritası',
    description:
      'Herhangi bir konu gir, AI ile yapılandırılmış interaktif öğrenme yol haritası oluştur.',
    type: 'website',
    locale: 'tr_TR',
    siteName: 'WatchPath',
  },
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
