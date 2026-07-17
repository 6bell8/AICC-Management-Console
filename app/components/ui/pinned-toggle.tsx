'use client';

import { Pin } from 'lucide-react';

import { cn } from './utils';

type PinnedToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label?: string;
  onCheckedChange: (checked: boolean) => void;
};

export function PinnedToggle({ checked, disabled, label = '', onCheckedChange }: PinnedToggleProps) {
  const hasLabel = label.trim().length > 0;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-9 items-center rounded-lg border text-sm font-medium shadow-sm transition',
        hasLabel ? 'gap-2 px-2.5' : 'w-9 justify-center p-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 focus-visible:ring-offset-0',
        'disabled:pointer-events-none disabled:opacity-45',
        checked
          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-600 hover:border-sky-100 hover:bg-slate-50 hover:text-slate-900',
      )}
      title={hasLabel ? label : '상단 고정'}
    >
      <span
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-md transition',
          checked ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400',
        )}
        aria-hidden="true"
      >
        <Pin className={cn('h-3.5 w-3.5 transition', checked ? 'fill-current' : '')} />
      </span>
      {hasLabel ? <span>{label}</span> : null}
    </button>
  );
}
