import { Text } from '@/components/ui';
import type { CategoryTag, LocalDateString } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { formatShortDate, formatScheduledTime } from '@/lib/time';
import { TaskTreeCategoryChip } from './task-tree-category-chip';

export function TaskTreeRowMetadata({
  category,
  scheduledTime,
  scheduledDate,
}: {
  category: Pick<CategoryTag, 'name' | 'colorHex'> | null;
  scheduledTime?: string | null;
  scheduledDate?: LocalDateString | null;
}) {
  const { locale } = useAppContext();
  if (!category && !scheduledTime && !scheduledDate) {
    return null;
  }
  return (
    <div
      data-task-metadata
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-1 pt-1"
    >
      {scheduledTime ? (
        <Text as="span" size="xs" tone="muted" className="tabular-nums">
          {formatScheduledTime(scheduledTime, locale)}
        </Text>
      ) : null}
      {scheduledDate ? (
        <Text as="span" size="xs" tone="muted" className="tabular-nums">
          {formatShortDate(scheduledDate, locale)}
        </Text>
      ) : null}
      {category ? (
        <TaskTreeCategoryChip
          colorHex={category.colorHex}
          name={category.name}
        />
      ) : null}
    </div>
  );
}
