import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Noto_Sans_Khmer, Noto_Serif_Khmer } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/AuthProvider';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-be-vietnam',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ['khmer'],
  variable: '--font-noto-khmer',
  display: 'swap',
  weight: ['400', '600', '700'],
});

const notoSerifKhmer = Noto_Serif_Khmer({
  subsets: ['khmer'],
  variable: '--font-noto-serif-khmer',
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
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${notoSansKhmer.variable} ${notoSerifKhmer.variable}`}
    >
      <body className="font-sans antialiased bg-katha-surface text-white min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
