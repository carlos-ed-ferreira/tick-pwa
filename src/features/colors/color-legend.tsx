'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui';
import {
  createColorTag,
  reorderColorTag,
  softDeleteColorTag,
  updateColorTag,
} from '@/lib/db';
import { useAppContext } from '@/providers';
import { useColorTags } from './use-color-tags';

export function ColorLegend() {
  const { dictionary, scope } = useAppContext();
  const colorTags = useColorTags(scope);

  async function addColorTag() {
    if (!scope) {
      return;
    }

    await createColorTag({
      scope,
      name: dictionary.dayEditor.newColor,
      hex: '#71717a',
    });
  }

  return (
    <aside className="rounded-lg border border-border bg-background/50 p-3 sm:sticky sm:top-3 sm:w-56 sm:self-start">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted">
          {dictionary.dayEditor.colors}
        </h3>
        <IconButton
          aria-label={dictionary.dayEditor.addColor}
          className="size-8"
          onClick={() => void addColorTag()}
        >
          <Plus aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto sm:grid sm:overflow-visible">
        {colorTags.map((tag, index) => (
          <div
            key={tag.id}
            className="inline-grid min-w-52 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-sm sm:min-w-0"
          >
            <input
              aria-label={`${tag.name} color`}
              className="size-6 cursor-pointer rounded border border-border bg-transparent"
              type="color"
              value={tag.hex}
              onChange={(event) => {
                if (scope) {
                  void updateColorTag({
                    scope,
                    colorTagId: tag.id,
                    hex: event.target.value,
                  });
                }
              }}
            />
            <input
              aria-label={dictionary.dayEditor.colorNamePlaceholder}
              className="min-w-0 rounded bg-transparent px-1 py-1 outline-none transition focus:bg-background"
              placeholder={dictionary.dayEditor.colorNamePlaceholder}
              value={tag.name}
              onChange={(event) => {
                if (scope) {
                  void updateColorTag({
                    scope,
                    colorTagId: tag.id,
                    name: event.target.value,
                  });
                }
              }}
            />
            <div className="flex items-center justify-end gap-0.5">
              <IconButton
                aria-label={dictionary.dayEditor.moveColorUp}
                className="size-8"
                disabled={index === 0}
                onClick={() => {
                  if (scope) {
                    void reorderColorTag({
                      scope,
                      colorTagId: tag.id,
                      direction: 'up',
                    });
                  }
                }}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
              </IconButton>
              <IconButton
                aria-label={dictionary.dayEditor.moveColorDown}
                className="size-8"
                disabled={index === colorTags.length - 1}
                onClick={() => {
                  if (scope) {
                    void reorderColorTag({
                      scope,
                      colorTagId: tag.id,
                      direction: 'down',
                    });
                  }
                }}
              >
                <ArrowDown aria-hidden="true" className="size-4" />
              </IconButton>
              <IconButton
                aria-label={dictionary.dayEditor.deleteColor}
                className="size-8"
                onClick={() => {
                  if (scope) {
                    void softDeleteColorTag({ scope, colorTagId: tag.id });
                  }
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
