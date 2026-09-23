import type { CSSProperties } from 'react';
import type { DailyEntryCategorySummary } from '@/lib/domain';

export const ignoredProgressFillStyle: CSSProperties = {
  backgroundColor: 'rgba(192, 199, 209, 0.46)',
};

export function getProgressTone(completedRatio: number) {
  if (completedRatio >= 1) {
    return {
      badgeStyle: {
        color: '#15803d',
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
        '--calendar-chip-edge': 'rgba(34, 197, 94, 0.22)',
      },
      trackStyle: {
        backgroundColor: 'rgba(34, 197, 94, 0.16)',
      },
      fillStyle: {
        background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
        boxShadow: '0 0 14px rgba(34, 197, 94, 0.28)',
      },
    };
  }

  if (completedRatio > 0) {
    return {
      badgeStyle: {
        color: '#b45309',
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        '--calendar-chip-edge': 'rgba(245, 158, 11, 0.24)',
      },
      trackStyle: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
      },
      fillStyle: {
        background: 'linear-gradient(90deg, #fcd34d 0%, #f59e0b 100%)',
        boxShadow: '0 0 14px rgba(245, 158, 11, 0.24)',
      },
    };
  }

  return {
    badgeStyle: {
      color: 'var(--muted)',
      backgroundColor: 'rgba(113, 113, 122, 0.12)',
      '--calendar-chip-edge': 'rgba(113, 113, 122, 0.18)',
    },
    trackStyle: {
      backgroundColor: 'rgba(113, 113, 122, 0.14)',
    },
    fillStyle: {
      background: 'linear-gradient(90deg, #a1a1aa 0%, #71717a 100%)',
      boxShadow: 'none',
    },
  };
}

export function isCategoryComplete(
  summary: DailyEntryCategorySummary | undefined,
): boolean {
  return Boolean(
    summary &&
    summary.itemCount > 0 &&
    summary.completedCount >= summary.itemCount,
  );
}
