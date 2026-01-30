import React from 'react';
import { cn } from './utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  // ✅ status variants
  | 'active'
  | 'paused'
  | 'inactive'
  | 'info';

export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-input text-foreground',

    // ✅ status colors (기존 statusBadge() 색상 그대로)
    active: 'bg-emerald-100 text-emerald-800',
    paused: 'bg-amber-100 text-amber-800',
    inactive: 'bg-slate-200 text-slate-800',
    info: 'bg-indigo-100 text-indigo-800',
  };

  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', variants[variant], className)} {...props} />;
}
