import type { Metadata } from 'next';
import './globals.css';

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
