'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

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
  const destructive = variant === 'destructive';

  return (
    <div
      data-toast
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'soft-flow-hover w-full rounded-2xl border bg-white/95 p-3.5 shadow-[0_16px_40px_rgb(15_23_42/0.14)] backdrop-blur',
        destructive ? 'border-rose-100' : 'border-slate-100',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
            destructive ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-sky-100 bg-sky-50 text-sky-600',
          )}
        >
          {destructive ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {title ? <div className={cn('text-sm font-semibold text-slate-950', destructive && 'text-rose-700')}>{title}</div> : null}
          {description ? <div className="whitespace-pre-line text-sm leading-5 text-slate-500">{description}</div> : null}
        </div>
        <button type="button" onClick={onClose} className="soft-icon-button h-7 w-7 shrink-0" aria-label="닫기">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          title={t.title}
          description={t.description}
          variant={t.variant}
          open={t.open !== false}
          onClose={() => dismiss(t.id)}
        />
      ))}
    </div>
  );
}
