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
      className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg inset-ring-hairline inset-ring-white/10 bg-white/6 p-1 shadow-sm shadow-[#253241]/10"
    >
      {tabs.map((tab) => {
        const isActiveTab = tab.id === activeTabId;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActiveTab}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[0.35rem] inset-ring-hairline px-3 text-xs font-medium leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0] ${
              isActiveTab
                ? 'inset-ring-[#f8d7aa]/70 bg-[#f0c38e] text-[#253241] shadow-[0_12px_28px_rgba(240,195,142,0.16)]'
                : 'inset-ring-transparent bg-transparent text-[#b4c1ce] hover:inset-ring-white/10 hover:bg-white/8 hover:text-[#fff9f2] active:bg-white/10'
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
