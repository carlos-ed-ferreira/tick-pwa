import { type CSSProperties } from 'react';
import { type GoalStepSummary } from './use-goal-step-summaries';

export const neutralProgressTrackStyle: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
};

export const ignoredProgressFillStyle: CSSProperties = {
  backgroundColor: 'rgba(192, 199, 209, 0.46)',
};

export const goalMenuItemClassName =
  'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#e5ebf3] transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]';

export const goalMenuDangerItemClassName =
  'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-400/15 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200';

export function getProgressBadgeStyle(summary: GoalStepSummary): CSSProperties {
  const ratio =
    summary.itemCount > 0 ? summary.completedCount / summary.itemCount : 0;

  if (ratio >= 1 && summary.itemCount > 0) {
    return {
      color: '#15803d',
      backgroundColor: 'rgba(34, 197, 94, 0.14)',
      '--chip-edge': 'rgba(34, 197, 94, 0.22)',
    } as CSSProperties;
  }

  if (ratio > 0) {
    return {
      color: '#b45309',
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      '--chip-edge': 'rgba(245, 158, 11, 0.24)',
    } as CSSProperties;
  }

  return {
    color: 'var(--muted)',
    backgroundColor: 'rgba(113, 113, 122, 0.12)',
    '--chip-edge': 'rgba(113, 113, 122, 0.18)',
  } as CSSProperties;
}
