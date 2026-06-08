import * as React from 'react';
import { cn } from './utils';

type Status = 'ALL' | 'DRAFT' | 'RUNNING' | 'PAUSED' | 'ARCHIVED';

const statusTextClass: Record<Status, string> = {
  ALL: 'text-foreground',
  DRAFT: 'text-slate-500',
  RUNNING: 'text-emerald-600',
  PAUSED: 'text-amber-600',
  ARCHIVED: 'text-zinc-500',
};

type SimpleSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  tone?: Status; // ✅ 선택된 값에 따라 색 적용
};

export function SimpleSelect({ className, tone, ...props }: SimpleSelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-[240px] rounded-md border border-input bg-background px-3 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        tone ? statusTextClass[tone] : '',
        className,
      )}
      {...props}
    />
  );
}
