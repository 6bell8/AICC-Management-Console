'use client';

import React, { createContext, useCallback, useContext, useId, useState } from 'react';

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
  contentId: string;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext() {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error('Collapsible components must be used inside <Collapsible>.');
  return ctx;
}

type CollapsibleProps = {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Collapsible({ children, className, defaultOpen = false, open: openProp, onOpenChange }: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = typeof openProp === 'boolean';
  const open = isControlled ? (openProp as boolean) : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const contentId = useId();

  return (
    <CollapsibleContext.Provider value={{ open, setOpen, contentId }}>
      <div className={className} data-state={open ? 'open' : 'closed'}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

type CollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export function CollapsibleTrigger({ className, onClick, type, ...props }: CollapsibleTriggerProps) {
  const { open, setOpen, contentId } = useCollapsibleContext();

  return (
    <button
      {...props}
      type={type ?? 'button'}
      className={className}
      aria-expanded={open}
      aria-controls={contentId}
      data-state={open ? 'open' : 'closed'}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        setOpen(!open);
      }}
    />
  );
}

type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export function CollapsibleContent({ className, children, ...props }: CollapsibleContentProps) {
  const { open, contentId } = useCollapsibleContext();

  return (
    <div
      className={['grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]', className ?? ''].join(
        ' ',
      )}
      data-state={open ? 'open' : 'closed'}
      {...props}
    >
      <div id={contentId} className="overflow-hidden" aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}
