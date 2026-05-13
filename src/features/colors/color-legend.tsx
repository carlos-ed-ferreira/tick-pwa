'use client';

import { useAppContext } from '@/providers';
import { useColorTags } from './use-color-tags';

export function ColorLegend() {
  const { dictionary, scope } = useAppContext();
  const colorTags = useColorTags(scope);

  return (
    <aside className="rounded-lg border border-border bg-background/50 p-3 sm:sticky sm:top-3 sm:w-56 sm:self-start">
      <h3 className="text-sm font-medium text-muted">
        {dictionary.dayEditor.colors}
      </h3>
      <div className="mt-3 flex gap-2 overflow-x-auto sm:grid sm:overflow-visible">
        {colorTags.map((tag) => (
          <div
            key={tag.id}
            className="inline-flex min-w-max items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-sm sm:min-w-0"
          >
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: tag.hex }}
            />
            <span className="truncate">{tag.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
