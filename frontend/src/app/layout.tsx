import type { Metadata } from 'next';
import { Inter, Noto_Sans_Khmer } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ['khmer'],
  variable: '--font-noto-khmer',
  display: 'swap',
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Katha — កថា',
  description: 'AI-powered bilingual story generator for Cambodian children — Khmer & Vietnamese',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${notoSansKhmer.variable}`}>
      <body className="font-sans antialiased bg-katha-surface text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
