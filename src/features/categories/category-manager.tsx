'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button, IconButton } from '@/components/ui';
import type { CategoryTag } from '@/lib/domain';
import {
  createCategoryTag,
  reorderCategoryTag,
  softDeleteCategoryTag,
  updateCategoryTag,
} from '@/lib/db';
import { useAppContext } from '@/providers';
import { useCategoryTags } from './use-category-tags';

function normalizeCategoryDraftName(name: string): string {
  return name.normalize('NFC').toLocaleUpperCase();
}

export function CategoryManager() {
  const { dictionary, scope } = useAppContext();
  const categoryTags = useCategoryTags(scope);

  async function addCategory() {
    if (!scope) {
      return;
    }

    await createCategoryTag({
      scope,
      name: dictionary.dayEditor.newCategory,
      colorHex: '#71717a',
    });
  }

  return (
    <section className="flex w-full flex-col">
      <div className="flex items-center justify-end gap-2">
        <Button className="min-h-11 px-4" onClick={() => void addCategory()}>
          <Plus aria-hidden="true" className="size-4" />
          {dictionary.dayEditor.addCategory}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {categoryTags.map((tag, index) => (
          <CategoryManagerRow
            key={`${tag.id}:${tag.name}`}
            isFirst={index === 0}
            isLast={index === categoryTags.length - 1}
            tag={tag}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryManagerRow({
  isFirst,
  isLast,
  tag,
}: {
  isFirst: boolean;
  isLast: boolean;
  tag: CategoryTag;
}) {
  const { dictionary, scope } = useAppContext();
  const [draftName, setDraftName] = useState(tag.name);
  const [isComposing, setIsComposing] = useState(false);

  async function commitName() {
    if (!scope) {
      return;
    }

    const normalizedName = normalizeCategoryDraftName(draftName).trim();

    if (!normalizedName) {
      setDraftName(tag.name);
      return;
    }

    setDraftName(normalizedName);

    if (normalizedName === tag.name) {
      return;
    }

    await updateCategoryTag({
      scope,
      categoryTagId: tag.id,
      name: normalizedName,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setDraftName(tag.name);
      event.currentTarget.blur();
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm shadow-sm">
      <label className="relative block size-7 shrink-0 rounded-full border border-border shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foreground">
        <input
          aria-label={`${dictionary.dayEditor.assignCategory}: ${tag.name}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="color"
          value={tag.colorHex}
          onChange={(event) => {
            if (scope) {
              void updateCategoryTag({
                scope,
                categoryTagId: tag.id,
                colorHex: event.target.value,
              });
            }
          }}
        />
        <span
          aria-hidden="true"
          className="block size-full rounded-full border border-white/40"
          style={{ backgroundColor: tag.colorHex }}
        />
      </label>

      <input
        aria-label={dictionary.dayEditor.categoryNamePlaceholder}
        className="min-w-0 rounded bg-transparent px-1 py-1 uppercase outline-none transition focus:bg-background"
        placeholder={dictionary.dayEditor.categoryNamePlaceholder}
        value={draftName}
        onBlur={() => void commitName()}
        onChange={(event) => {
          const nextValue = event.target.value;

          setDraftName(
            isComposing ? nextValue : normalizeCategoryDraftName(nextValue),
          );
        }}
        onCompositionEnd={(event) => {
          setIsComposing(false);
          setDraftName(normalizeCategoryDraftName(event.currentTarget.value));
        }}
        onCompositionStart={() => setIsComposing(true)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center justify-end gap-0.5">
        <IconButton
          aria-label={dictionary.dayEditor.moveCategoryUp}
          className="size-8"
          disabled={isFirst}
          onClick={() => {
            if (scope) {
              void reorderCategoryTag({
                scope,
                categoryTagId: tag.id,
                direction: 'up',
              });
            }
          }}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </IconButton>

        <IconButton
          aria-label={dictionary.dayEditor.moveCategoryDown}
          className="size-8"
          disabled={isLast}
          onClick={() => {
            if (scope) {
              void reorderCategoryTag({
                scope,
                categoryTagId: tag.id,
                direction: 'down',
              });
            }
          }}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </IconButton>

        <IconButton
          aria-label={dictionary.dayEditor.deleteCategory}
          className="size-8"
          onClick={() => {
            if (scope) {
              void softDeleteCategoryTag({
                scope,
                categoryTagId: tag.id,
              });
            }
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
