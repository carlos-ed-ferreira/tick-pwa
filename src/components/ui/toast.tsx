'use client';

import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { Tooltip } from './tooltip';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  details: readonly string[];
  durationMs: number;
  tone: ToastTone;
}

interface ToastOptions {
  details?: readonly string[];
  durationMs?: number;
}

const defaultDurationMs = 5_000;
const emptyToasts: readonly ToastItem[] = [];
const listeners = new Set<() => void>();
let nextToastId = 1;
let activeToasts: readonly ToastItem[] = emptyToasts;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot() {
  return activeToasts;
}

function showToast(
  tone: ToastTone,
  message: string,
  options: ToastOptions = {},
) {
  const item: ToastItem = {
    id: nextToastId,
    message,
    details: options.details ?? [],
    durationMs: options.durationMs ?? defaultDurationMs,
    tone,
  };

  nextToastId += 1;
  activeToasts = [...activeToasts, item].slice(-4);
  emitChange();

  return item.id;
}

export function dismissToast(id: number) {
  activeToasts = activeToasts.filter((item) => item.id !== id);
  emitChange();
}

export function dismissAllToasts() {
  activeToasts = emptyToasts;
  emitChange();
}

export const toast = {
  error(message: string, options?: ToastOptions) {
    return showToast('error', message, options);
  },
  success(message: string, options?: ToastOptions) {
    return showToast('success', message, options);
  },
};

export function ToastViewport({ closeLabel }: { closeLabel: string }) {
  const toasts = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => emptyToasts,
  );

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:top-5 sm:right-5 sm:bottom-auto sm:w-[min(24rem,calc(100vw-2.5rem))]">
      {toasts.map((item) => (
        <ToastCard key={item.id} closeLabel={closeLabel} item={item} />
      ))}
    </div>
  );
}

function ToastCard({
  closeLabel,
  item,
}: {
  closeLabel: string;
  item: ToastItem;
}) {
  const isError = item.tone === 'error';

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => dismissToast(item.id),
      item.durationMs,
    );

    return () => window.clearTimeout(timeoutId);
  }, [item.durationMs, item.id]);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`pointer-events-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-0 px-3 py-3 shadow-[0_20px_56px_rgba(5,8,13,0.42)] backdrop-blur-xl motion-safe:animate-[toast-in_180ms_ease-out] ${
        isError
          ? 'bg-[#4a293d]/95 text-rose-50'
          : 'bg-[#214131]/95 text-emerald-50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex size-8 items-center justify-center rounded-full ${
          isError
            ? 'bg-rose-300/12 text-rose-200'
            : 'bg-emerald-300/12 text-emerald-100'
        }`}
      >
        {isError ? (
          <AlertCircle className="size-4.5" />
        ) : (
          <CheckCircle2 className="size-4.5" />
        )}
      </span>

      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5">{item.message}</p>
        {item.details.length > 0 ? (
          <ul className="mt-1.5 grid max-h-40 list-disc gap-1 overflow-y-auto pl-4 text-xs leading-5 opacity-85">
            {item.details.map((detail, index) => (
              <li key={`${index}:${detail}`}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <Tooltip content={closeLabel}>
        <button
          type="button"
          aria-label={closeLabel}
          className="inline-flex size-8 items-center justify-center rounded-full text-current opacity-65 transition hover:bg-white/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          onClick={() => dismissToast(item.id)}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}
