// app/layout.tsx
import './globals.css';

import localFont from 'next/font/local';
import { Inter } from 'next/font/google';

const pretendard = localFont({
  src: [
    { path: '../node_modules/pretendard/dist/web/static/woff2/Pretendard-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/pretendard/dist/web/static/woff2/Pretendard-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../node_modules/pretendard/dist/web/static/woff2/Pretendard-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../node_modules/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

import Providers from './providers';
import { Toaster } from './components/ui/toaster';
import { ScrollToTopButton } from './components/ui/scroll-to-top-button';
import type { Metadata } from 'next';

const sharedTitle = 'AICC Managed Console';
const sharedDescription = 'AICC 운영, ERP 업무, 승인과 현황을 한곳에서 관리하는 업무 콘솔입니다.';
const sharedImage = '/aicc-share-image.png';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://aicc-management-console.vercel.app'),
  title: {
    default: sharedTitle,
    template: '%s | AICC Managed Console',
  },
  description: sharedDescription,
  openGraph: {
    title: sharedTitle,
    description: sharedDescription,
    url: '/',
    siteName: sharedTitle,
    images: [
      {
        url: sharedImage,
        width: 1260,
        height: 1260,
        alt: 'AICC works',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: sharedTitle,
    description: sharedDescription,
    images: [sharedImage],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${inter.variable}`}>
      <body suppressHydrationWarning>
        <Providers>
          <div className="relative min-h-screen overflow-hidden bg-white">
            {/* 배경 블랍 */}
            <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-black/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-black/5 blur-3xl" />

            {/* 은은한 그리드 */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />

            {/* 여기서 각 라우트 그룹 레이아웃이 렌더링됨 */}
            <div className="relative min-h-screen">{children}</div>
            <ScrollToTopButton />
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
