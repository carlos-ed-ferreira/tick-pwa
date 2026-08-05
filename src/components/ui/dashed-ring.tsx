'use client';

import { useLayoutEffect, useRef } from 'react';

const DASH_LENGTH = 7;
const GAP_LENGTH = 6;
const PATTERN_LENGTH = DASH_LENGTH + GAP_LENGTH;

export function fitDashedRingPathLength(perimeter: number) {
  if (!Number.isFinite(perimeter) || perimeter <= 0) {
    return PATTERN_LENGTH;
  }

  const cycleCount = Math.max(1, Math.round(perimeter / PATTERN_LENGTH));
  return cycleCount * PATTERN_LENGTH;
}

export function DashedRing({
  className = '',
  radius,
}: {
  className?: string;
  radius: number;
}) {
  const rectRef = useRef<SVGRectElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const rect = rectRef.current;
    const svg = svgRef.current;

    if (!rect || !svg) {
      return;
    }

    const updatePattern = () => {
      const perimeter =
        typeof rect.getTotalLength === 'function' ? rect.getTotalLength() : 0;

      if (perimeter <= 0) {
        return;
      }

      rect.setAttribute(
        'pathLength',
        String(fitDashedRingPathLength(perimeter)),
      );
    };

    updatePattern();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updatePattern);
    observer.observe(svg);

    return () => observer.disconnect();
  }, [radius]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-visible ${className}`}
      style={{
        inset: 'calc(var(--hairline) / 2)',
        width: 'calc(100% - var(--hairline))',
        height: 'calc(100% - var(--hairline))',
      }}
    >
      <rect
        ref={rectRef}
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        fill="none"
        style={{
          stroke: 'var(--dashed-ring-color, currentColor)',
          strokeDasharray: '7 6',
          strokeWidth: 'var(--hairline)',
        }}
      />
    </svg>
  );
}
