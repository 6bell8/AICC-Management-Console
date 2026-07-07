'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';

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

type MobileSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export type RichSelectOption = {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
};

type RichSelectProps = {
  name?: string;
  value: string;
  options: RichSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  emptyText?: string;
  'aria-label'?: string;
};

export function SimpleSelect({ className, tone, ...props }: SimpleSelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-[240px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        tone ? statusTextClass[tone] : '',
        className,
      )}
      {...props}
    />
  );
}

export function MobileSelect({ className, ...props }: MobileSelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition',
        'hover:border-sky-100 hover:bg-sky-50/40 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400',
        'max-[480px]:h-12 max-[480px]:text-base',
        className,
      )}
      {...props}
    />
  );
}

export function RichSelect({
  name,
  value,
  options,
  onChange,
  placeholder = '선택',
  disabled = false,
  className,
  buttonClassName,
  menuClassName,
  optionClassName,
  emptyText = '선택 가능한 항목이 없습니다.',
  'aria-label': ariaLabel,
}: RichSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value);
  const currentValue = internalValue;
  const selectedOption = options.find((option) => option.value === currentValue) ?? null;

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <div
      className={cn('relative', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white/95 px-3.5 text-left text-sm text-slate-700 shadow-sm transition',
          'hover:border-sky-100 hover:bg-sky-50/30 focus:border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          'max-[480px]:min-h-12',
          buttonClassName,
        )}
      >
        <span className={cn('min-w-0 truncate', selectedOption ? 'font-medium text-slate-800' : 'text-slate-500')}>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition', open ? 'rotate-180 text-sky-600' : '')} />
      </button>

      {open ? (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 right-0 z-30 mt-1 max-h-72 origin-top overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10',
            'animate-[richSelectSlide_220ms_cubic-bezier(0.22,1,0.36,1)_both]',
            menuClassName,
          )}
        >
          {options.length === 0 ? <div className="px-3.5 py-2.5 text-sm text-slate-500">{emptyText}</div> : null}
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  setInternalValue(option.value);
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                  selected ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-50',
                  optionClassName,
                )}
              >
                <span className="min-w-0">
                  <span className="block break-keep text-sm font-semibold">{option.label}</span>
                  {option.description ? <span className="mt-0.5 block truncate text-xs text-slate-500">{option.description}</span> : null}
                </span>
                {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
