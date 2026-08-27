export type CalendarDayDensity = 'comfortable' | 'compact';

const compactCellWidthThreshold = 72;
const categoryDotSize = 10;
const categoryDotGap = 8;
const horizontalPaddingByDensity: Record<CalendarDayDensity, number> = {
  comfortable: 10.4,
  compact: 6.4,
};

export function getCalendarDayDensity(cellWidth: number): CalendarDayDensity {
  return cellWidth > 0 && cellWidth < compactCellWidthThreshold
    ? 'compact'
    : 'comfortable';
}

export function getVisibleCategoryLimit(cellWidth: number): number {
  if (cellWidth <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const availableWidth =
    cellWidth -
    horizontalPaddingByDensity[getCalendarDayDensity(cellWidth)] * 2;

  return Math.max(
    1,
    Math.floor(
      (availableWidth + categoryDotGap) / (categoryDotSize + categoryDotGap),
    ),
  );
}
