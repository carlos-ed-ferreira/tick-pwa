'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button, Dialog, IconButton, Input } from '@/components/ui';
import type { CategoryTag, CategoryTagSurface } from '@/lib/domain';
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

export function CategoryManager({ surface }: { surface: CategoryTagSurface }) {
  const { dictionary, scope, requestSync } = useAppContext();
  const categoryTags = useCategoryTags(scope, surface);

  async function addCategory() {
    if (!scope) {
      return;
    }

    await createCategoryTag({
      scope,
      surface,
      name: dictionary.dayEditor.newCategory,
      colorHex: '#71717a',
    });
    await requestSync();
  }

  return (
    <section className="flex w-full flex-col">
      <div className="flex items-center justify-end gap-2">
        <Button
          className="h-12 rounded-[1.15rem] px-5 shadow-[0_16px_32px_rgba(240,195,142,0.18)]"
          tone="accent"
          onClick={() => void addCategory()}
        >
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

export function CategoryManagerDialog({
  open,
  onClose,
  surface,
  title,
}: {
  open: boolean;
  onClose: () => void;
  surface: CategoryTagSurface;
  title: string;
}) {
  const { dictionary } = useAppContext();

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open={open}
      title={title}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <CategoryManager surface={surface} />
      </div>
    </Dialog>
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
  const { dictionary, scope, requestSync } = useAppContext();
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
    await requestSync();
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
    <div className="modal-panel grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 text-sm transition hover:border-[#f0c38e]/20 hover:bg-white/[0.055]">
      <label className="relative block size-8 shrink-0 rounded-full border border-white/10 bg-white/5 p-1 shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f0c38e]">
        <input
          aria-label={`${dictionary.dayEditor.assignCategory}: ${tag.name}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="color"
          value={tag.colorHex}
          onChange={(event) => {
            if (scope) {
              void (async () => {
                await updateCategoryTag({
                  scope,
                  categoryTagId: tag.id,
                  colorHex: event.target.value,
                });
                await requestSync();
              })();
            }
          }}
        />
        <span
          aria-hidden="true"
          className="block size-full rounded-full border border-white/30 shadow-[0_6px_14px_rgba(8,6,20,0.24)]"
          style={{ backgroundColor: tag.colorHex }}
        />
      </label>

      <Input
        aria-label={dictionary.dayEditor.categoryNamePlaceholder}
        className="min-w-0 rounded-xl border border-transparent bg-transparent px-2 py-2 uppercase text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] focus:border-[#f0c38e]/30 focus:bg-white/[0.055] focus:shadow-sm"
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
          className="size-8 rounded-full text-[#bdb4d4] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          disabled={isFirst}
          onClick={() => {
            if (scope) {
              void (async () => {
                await reorderCategoryTag({
                  scope,
                  categoryTagId: tag.id,
                  direction: 'up',
                });
                await requestSync();
              })();
            }
          }}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </IconButton>

        <IconButton
          aria-label={dictionary.dayEditor.moveCategoryDown}
          className="size-8 rounded-full text-[#bdb4d4] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          disabled={isLast}
          onClick={() => {
            if (scope) {
              void (async () => {
                await reorderCategoryTag({
                  scope,
                  categoryTagId: tag.id,
                  direction: 'down',
                });
                await requestSync();
              })();
            }
          }}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </IconButton>

        <IconButton
          aria-label={dictionary.dayEditor.deleteCategory}
          className="size-8 rounded-full text-[#bdb4d4] hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-[#f0c38e]"
          onClick={() => {
            if (scope) {
              void (async () => {
                await softDeleteCategoryTag({
                  scope,
                  categoryTagId: tag.id,
                });
                await requestSync();
              })();
            }
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
