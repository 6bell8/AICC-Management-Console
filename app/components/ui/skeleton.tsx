import * as React from 'react';
import { cn } from './utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted border border-gray-200/80', className)} {...props} />;
}

export { Skeleton };
