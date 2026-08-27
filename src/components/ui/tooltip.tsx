'use client';

import {
  cloneElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { ReactElement, ReactNode } from 'react';

type TooltipSide = 'bottom' | 'top';

interface TooltipPosition {
  arrowLeft: number;
  left: number;
  side: TooltipSide;
  top: number;
}

const tooltipGap = 10;
const viewportPadding = 10;
const clippingOverflow = new Set(['auto', 'clip', 'hidden', 'scroll']);

function isTextClipped(element: HTMLElement) {
  if (element.scrollWidth <= element.clientWidth + 1) {
    return false;
  }

  return clippingOverflow.has(window.getComputedStyle(element).overflowX);
}

function hasClippedText(container: HTMLElement | null) {
  if (!container) {
    return false;
  }

  return [container, ...container.querySelectorAll('*')].some(
    (element) => element instanceof HTMLElement && isTextClipped(element),
  );
}

export function Tooltip({
  children,
  className,
  content,
  delay = 320,
  side = 'top',
  whenTruncated = false,
}: {
  children: ReactElement;
  className?: string;
  content: ReactNode;
  delay?: number;
  side?: TooltipSide;
  whenTruncated?: boolean;
}) {
  const tooltipId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const closeTooltip = useCallback(() => {
    clearOpenTimer();
    setIsOpen(false);
    setPosition(null);
  }, [clearOpenTimer]);

  const openTooltip = useCallback(() => {
    clearOpenTimer();

    if (whenTruncated && !hasClippedText(containerRef.current)) {
      return;
    }

    setIsOpen(true);
  }, [clearOpenTimer, whenTruncated]);

  const scheduleTooltip = useCallback(() => {
    clearOpenTimer();
    openTimerRef.current = setTimeout(openTooltip, delay);
  }, [clearOpenTimer, delay, openTooltip]);

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;

    if (!container || !tooltip) {
      return;
    }

    const triggerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const fitsAbove =
      triggerRect.top - tooltipGap - tooltipRect.height >= viewportPadding;
    const fitsBelow =
      triggerRect.bottom + tooltipGap + tooltipRect.height <=
      window.innerHeight - viewportPadding;
    const resolvedSide =
      side === 'top'
        ? fitsAbove || !fitsBelow
          ? 'top'
          : 'bottom'
        : fitsBelow || !fitsAbove
          ? 'bottom'
          : 'top';
    const unclampedLeft =
      triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const left = Math.min(
      Math.max(viewportPadding, unclampedLeft),
      Math.max(
        viewportPadding,
        window.innerWidth - viewportPadding - tooltipRect.width,
      ),
    );
    const top =
      resolvedSide === 'top'
        ? triggerRect.top - tooltipGap - tooltipRect.height
        : triggerRect.bottom + tooltipGap;
    const arrowLeft = Math.min(
      Math.max(12, triggerRect.left + triggerRect.width / 2 - left),
      Math.max(12, tooltipRect.width - 12),
    );

    setPosition({ arrowLeft, left, side: resolvedSide, top });
  }, [side]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useLayoutEffect(() => clearOpenTimer, [clearOpenTimer]);

  const childProps = children.props as { 'aria-describedby'?: string };
  const describedBy = isOpen
    ? [childProps['aria-describedby'], tooltipId].filter(Boolean).join(' ')
    : childProps['aria-describedby'];
  const trigger = cloneElement(children, {
    'aria-describedby': describedBy || undefined,
  } as Record<string, unknown>);

  return (
    <span
      ref={containerRef}
      className={`inline-flex min-w-0 ${className ?? 'shrink-0'}`}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeTooltip();
        }
      }}
      onClickCapture={closeTooltip}
      onFocusCapture={openTooltip}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          closeTooltip();
        }
      }}
      onMouseEnter={scheduleTooltip}
      onMouseLeave={closeTooltip}
      onPointerDown={closeTooltip}
    >
      {trigger}
      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className="tick-tooltip pointer-events-none fixed z-[100] max-w-72 rounded-xl inset-ring-hairline inset-ring-[#f0c38e]/25 bg-[#16202c]/96 px-3 py-2 text-center text-xs font-medium leading-4 text-[#fff9f2] shadow-[0_14px_36px_rgba(5,8,13,0.48)] backdrop-blur-xl"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              {content}
              {position ? (
                <span
                  aria-hidden="true"
                  className={`absolute size-2 rotate-45 border-[#f0c38e]/25 bg-[#16202c] ${
                    position.side === 'top'
                      ? '-bottom-1 border-b border-r'
                      : '-top-1 border-l border-t'
                  }`}
                  style={{ left: position.arrowLeft - 4 }}
                />
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
