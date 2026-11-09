'use client';

import {
  TreeListPanel,
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
} from '@/components/app';
import { CategoryManagerAction } from '@/features/categories';
import { useAppContext } from '@/providers';

function noop() {}

export function RecurringEmptyState({ onCreate }: { onCreate: () => void }) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <section
      aria-label={labels.overviewTitle}
      className="flex flex-col gap-3 pt-4 sm:pt-5 lg:pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#fff9f2]">
          {labels.overviewTitle}
        </h2>
        <CategoryManagerAction
          className={filledMediumPillControlClassName}
          surface="recurrence"
          title={labels.categoriesTitle}
        />
      </div>
      <div className={taskListSurfaceClassName}>
        <TreeListPanel
          addLabel={labels.newActivity}
          clearSelectionLabel=""
          emptyLabel={labels.emptyCreate}
          hasRows={false}
          isSelectionMode={false}
          surface="none"
          onAddRoot={() => {
            onCreate();

            return null;
          }}
          onClearSelection={noop}
        >
          {null}
        </TreeListPanel>
      </div>
    </section>
  );
}
