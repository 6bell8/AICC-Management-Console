import * as React from 'react';

type ToastVariant = 'default' | 'destructive';

export type ToastOptions = {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
  open?: boolean; // 토스트 표시 상태(내부용)
};

type ToastItem = Required<Pick<ToastOptions, 'id'>> &
  Omit<ToastOptions, 'id'> & {
    createdAt: number;
  };

type ToastState = {
  toasts: ToastItem[];
};

type Listener = (state: ToastState) => void;

const DEFAULT_DURATION = 3000;
const MAX_TOASTS = 3;
const CLOSE_ANIM_MS = 180;

let state: ToastState = { toasts: [] };
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(state));
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function addToast(opts: ToastOptions) {
  const id = opts.id ?? genId();

  const item: ToastItem = {
    id,
    title: opts.title,
    description: opts.description,
    variant: opts.variant ?? 'default',
    duration: opts.duration ?? DEFAULT_DURATION,
    createdAt: Date.now(),
    open: true,
  };

  state = {
    toasts: [item, ...state.toasts].slice(0, MAX_TOASTS),
  };
  emit();

  // auto dismiss: duration 후 "닫힘 애니메이션" 시작
  window.setTimeout(() => dismissToast(id), item.duration);

  return id;
}

function updateToast(id: string, opts: Partial<ToastOptions>) {
  state = {
    toasts: state.toasts.map((t) => {
      if (t.id !== id) return t;

      // 여기선 opts.open을 명시적으로 준 경우에만 바꾸고, 아니면 기존 유지
      const nextOpen = typeof opts.open === 'boolean' ? opts.open : t.open;

      return {
        ...t,
        ...opts,
        id: t.id, // id는 고정
        open: nextOpen,
      };
    }),
  };
  emit();
}

function dismissToast(id: string) {
  // 이미 제거됐거나, 이미 닫힌 상태면 무시(중복 타이머 대비)
  const target = state.toasts.find((t) => t.id === id);
  if (!target) return;
  if (target.open === false) return;

  // 1) 먼저 닫힘 상태로 전환(open=false)
  state = {
    toasts: state.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)),
  };
  emit();

  // 2) 애니메이션 후 실제 제거
  window.setTimeout(() => {
    state = { toasts: state.toasts.filter((t) => t.id !== id) };
    emit();
  }, CLOSE_ANIM_MS);
}

export function useToast() {
  const [local, setLocal] = React.useState<ToastState>(state);

  React.useEffect(() => {
    const listener: Listener = (s) => setLocal(s);
    listeners.add(listener);
    setLocal(state);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    toasts: local.toasts,
    toast: (opts: ToastOptions) => {
      const id = addToast(opts);
      return {
        id,
        dismiss: () => dismissToast(id),
        update: (next: Partial<ToastOptions>) => updateToast(id, next),
      };
    },
    dismiss: (id: string) => dismissToast(id),
  };
}
