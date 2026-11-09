'use client';

import type { CSSProperties } from 'react';
import type { CategoryTab } from '@/lib/domain';
import { toAlphaColor } from '@/lib/color';

export function TaskTreeCategoryTabs({
  activeTabId,
  label,
  tabs,
  onSelect,
}: {
  activeTabId: string | null;
  label: string;
  tabs: readonly CategoryTab[];
  onSelect: (tabId: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-my-1 flex shrink-0 items-center gap-2 overflow-x-auto py-1"
    >
      {tabs.map((tab) => {
        const isActiveTab = tab.id === activeTabId;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActiveTab}
            className={`touch-target inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium leading-none whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
              isActiveTab
                ? 'bg-[#f0c38e] text-[#253241]'
                : 'bg-white/8 text-[#b4c1ce] hover:bg-white/12 hover:text-[#fff9f2] active:bg-white/14'
            }`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.colorHex ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full inset-ring-hairline inset-ring-(--tab-dot-edge)"
                style={
                  {
                    '--tab-dot-edge': toAlphaColor(tab.colorHex, 0.45),
                    backgroundColor: tab.colorHex,
                  } as CSSProperties
                }
              />
            ) : null}
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
