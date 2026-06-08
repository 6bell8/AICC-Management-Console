'use client';

import * as React from 'react';
import { cn } from './utils';
import type { PublishStatus } from '@/app/lib/types/common';

type Props = {
  value: PublishStatus;
  onChange: (next: PublishStatus) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
};

export function StatusToggle({ value, onChange, size = 'md', disabled, className }: Props) {
  const base = 'inline-flex items-center rounded-lg border border-slate-200/60 bg-white p-1 gap-1';

  const btnBase = 'inline-flex items-center justify-center select-none rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none';

  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
  } as const;

  // ✅ Badge variants와 톤 맞춤
  function itemClass(kind: PublishStatus, active: boolean) {
    if (active) {
      if (kind === 'PUBLISHED') {
        // published: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      }
      // draft: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
    }
    return 'text-slate-500 hover:bg-slate-50';
  }

  return (
    <div className={cn(base, className)} aria-disabled={disabled ? 'true' : undefined}>
      <button
        type="button"
        disabled={disabled}
        className={cn(btnBase, sizes[size], itemClass('PUBLISHED', value === 'PUBLISHED'))}
        onClick={() => onChange('PUBLISHED')}
      >
        공개
      </button>

      <button
        type="button"
        disabled={disabled}
        className={cn(btnBase, sizes[size], itemClass('DRAFT', value === 'DRAFT'))}
        onClick={() => onChange('DRAFT')}
      >
        임시
      </button>
    </div>
  );
}
