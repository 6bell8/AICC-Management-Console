import * as React from 'react';
import { cn } from './utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative overflow-hidden rounded-md bg-slate-200/70 dark:bg-slate-800/60 animate-pulse', className)} {...props} />;
}

export { Skeleton };
