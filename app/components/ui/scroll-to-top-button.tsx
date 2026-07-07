'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 480px)');

    const updateMobile = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateMobile();
    mediaQuery.addEventListener('change', updateMobile);

    return () => mediaQuery.removeEventListener('change', updateMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setVisible(false);
      return;
    }

    const updateVisible = () => {
      setVisible(window.scrollY > 160);
    };

    updateVisible();
    window.addEventListener('scroll', updateVisible, { passive: true });

    return () => window.removeEventListener('scroll', updateVisible);
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <button
      type="button"
      aria-label="맨 위로 이동"
      title="맨 위로 이동"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={[
        'fixed bottom-[calc(env(safe-area-inset-bottom)+18px)] left-1/2 z-40 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full',
        'bg-slate-950/50 text-white shadow-lg shadow-slate-900/10 ring-1 ring-white/45 backdrop-blur-md',
        'transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'active:scale-95',
        visible ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-3 opacity-0',
      ].join(' ')}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
