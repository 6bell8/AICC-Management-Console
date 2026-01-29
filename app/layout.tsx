// app/layout.tsx
import './globals.css';
import Providers from './providers';
import { Toaster } from './components/ui/toaster';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'AICC Console',
    template: 'AICC Console - %s',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
