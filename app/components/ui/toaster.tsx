'use client';

import * as React from 'react';
import { useToast } from '../../components/ui/use-toast';
import { cn } from './utils';

function ToastCard({
  title,
  description,
  variant,
  open,
  onClose,
}: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      data-toast
      data-state={open ? 'open' : 'closed'}
      className={cn('w-full max-w-sm rounded-xl border bg-white p-4 shadow-lg', variant === 'destructive' && 'border-destructive/40')}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            {title ? <div className={cn('text-sm font-semibold', variant === 'destructive' && 'text-destructive')}>{title}</div> : <div />}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {description ? <div className="text-sm text-muted-foreground whitespace-pre-line">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          title={t.title}
          description={t.description}
          variant={t.variant}
          open={t.open !== false} // ✅
          onClose={() => dismiss(t.id)} // ✅ dismiss가 알아서 애니메이션 처리
        />
      ))}
    </div>
  );
}
