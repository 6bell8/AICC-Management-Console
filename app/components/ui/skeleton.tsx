import * as React from 'react';
import { cn } from './utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-slate-200/70 after:absolute after:inset-y-0 after:-left-1/2 after:w-1/2 after:animate-[skeleton-shimmer_1.4s_ease-in-out_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent dark:bg-slate-800/60 dark:after:via-white/10',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
