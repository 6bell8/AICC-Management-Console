import React from 'react';
import { cn } from './utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  // status
  | 'published'
  | 'draft'
  // notice
  | 'info';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: 'sm' | 'xs';
  shape?: 'rounded' | 'pill';
};

export function Badge({ className, variant = 'default', size = 'xs', shape = 'pill', ...props }: Props) {
  const base = 'inline-flex items-center font-medium leading-none select-none whitespace-nowrap';

  const sizes = {
    xs: 'px-2 py-0.5 text-[11px]',
    sm: 'px-2.5 py-1 text-xs',
  } as const;

  const shapes = {
    rounded: 'rounded-md',
    pill: 'rounded-full',
  } as const;

  const variants: Record<BadgeVariant, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-input text-foreground',

    // ✅ 지금 A안 느낌: 아주 연한 배경 + 얇은 ring
    published: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    draft: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  };

  return <span className={cn(base, sizes[size], shapes[shape], variants[variant], className)} {...props} />;
}
