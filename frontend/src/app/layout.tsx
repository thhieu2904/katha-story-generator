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

const themeInitScript = `
  (() => {
    try {
      const savedTheme = localStorage.getItem('katha-theme-v2');
      const theme = savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : 'light';
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = 'light';
    }
  })();
`;

export const metadata: Metadata = {
  // Cần cho ảnh OpenGraph (src/app/opengraph-image.jpg) resolve ra URL tuyệt đối.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: 'Katha — កថា',
  description: 'Truyện tranh song ngữ Khmer – Việt · Bilingual Khmer–Vietnamese picture stories',
  openGraph: {
    title: 'Katha — កថា',
    description: 'Truyện tranh song ngữ Khmer – Việt · Bilingual Khmer–Vietnamese picture stories',
    siteName: 'Katha',
    type: 'website',
    locale: 'vi_VN',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${beVietnamPro.variable} ${notoSansKhmer.variable} ${notoSerifKhmer.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-katha-surface font-sans text-katha-text antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
