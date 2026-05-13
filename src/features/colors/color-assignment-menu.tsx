'use client';

import { Palette, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui';
import { assignChecklistItemColor } from '@/lib/db';
import type { ChecklistItem } from '@/lib/domain';
import { useAppContext } from '@/providers';
import { useColorTags } from './use-color-tags';

export function ColorAssignmentMenu({ item }: { item: ChecklistItem }) {
  const { dictionary, scope } = useAppContext();
  const colorTags = useColorTags(scope);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedColorTag = colorTags.find((tag) => tag.id === item.colorTagId);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function assignColor(colorTagId: string | null) {
    if (!scope) {
      return;
    }

    await assignChecklistItemColor({ scope, itemId: item.id, colorTagId });
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        aria-expanded={isOpen}
        aria-label={dictionary.dayEditor.assignColor}
        className={selectedColorTag ? 'text-foreground' : ''}
        ref={triggerRef}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        {selectedColorTag ? (
          <span
            aria-hidden="true"
            className="size-4 rounded-full border border-border"
            style={{ backgroundColor: selectedColorTag.hex }}
          />
        ) : (
          <Palette aria-hidden="true" className="size-4" />
        )}
      </IconButton>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-20 grid min-w-48 gap-1 rounded-lg border border-border bg-surface p-2 text-sm shadow-xl">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-muted transition hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={() => void assignColor(null)}
          >
            <X aria-hidden="true" className="size-4" />
            {dictionary.dayEditor.clearColor}
          </button>
          {colorTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onClick={() => void assignColor(tag.id)}
            >
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: tag.hex }}
              />
              <span className="truncate">{tag.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
