import type { ChecklistItem } from '@/lib/domain';
import { buildVisibleTreeRows, type VisibleTreeRow } from '@/lib/domain';

export type VisibleChecklistRow = VisibleTreeRow<ChecklistItem>;

export function buildVisibleChecklistRows(
  items: ChecklistItem[],
): VisibleChecklistRow[] {
  return buildVisibleTreeRows(items);
}
