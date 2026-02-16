import * as React from 'react';
import { cn } from './utils';

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'destructive' | 'oHGhost' | 'ghost' | 'hoverGhost' | 'dlOutline' | 'link' | 'draft';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-100 cursor-pointer',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 cursor-pointer',
  draft: 'bg-amber-50 text-amber-900 hover:bg-amber-100 ring-1 ring-amber-200 cursor-pointer',
  ghost: 'bg-gray-200 text-foreground cursor-pointer dark:bg-gray-800 dark:hover:bg-gray-700',
  oHGhost: 'bg-gray-100 text-foreground hover:bg-gray-200 cursor-pointer dark:bg-gray-800 dark:hover:bg-gray-700',
  hoverGhost: 'text-foreground hover:bg-gray-200 cursor-pointer dark:bg-gray-800 dark:hover:bg-gray-700',
  dlOutline:
    'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer',
  link: 'text-primary underline-offset-4 hover:underline cursor-pointer',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
  icon: 'h-10 w-10',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'md', disabled, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        'whitespace-nowrap truncate',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
});

export function buttonVariants(opts?: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  const variant = opts?.variant ?? 'default';
  const size = opts?.size ?? 'md';

  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    'whitespace-nowrap truncate',
    variantClass[variant],
    sizeClass[size],
    opts?.className,
  );
}

Button.displayName = 'Button';
