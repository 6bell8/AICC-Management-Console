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

type RichSelectOption = {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
};

type RichSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  value: string;
  options: RichSelectOption[];
  onChange: (value: string) => void;
  buttonClassName?: string;
  emptyText?: string;
  placeholder?: string;
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

export function RichSelect({ buttonClassName, className, emptyText, options, onChange, placeholder, ...props }: RichSelectProps) {
  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <select
      className={cn(
        'h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition',
        'focus:border-blue-300 focus:ring-2 focus:ring-blue-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
        buttonClassName,
      )}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    >
      {placeholder && !hasEmptyOption ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.length === 0 && emptyText ? (
        <option value="" disabled>
          {emptyText}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
