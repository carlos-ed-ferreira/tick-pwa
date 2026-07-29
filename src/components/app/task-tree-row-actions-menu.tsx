'use client';

import {
  ArrowDown,
  ArrowUp,
  Clock3,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { Checkbox, Dialog, IconButton } from '@/components/ui';
import {
  defaultTaskTreeRowActionPreferences,
  type TaskTreeRowActionPlacement,
  type TaskTreeRowActionPreferences,
} from './task-tree-row-action-visibility';
import { TaskTreeClearCategoryIcon } from './task-tree-clear-category-icon';

interface TaskTreeRowActionsMenuLabels {
  actions: {
    add: string;
    bold: string;
    category: string;
    clearCategory: string;
    delete: string;
    drag: string;
    indent: string;
    moveDown: string;
    moveUp: string;
    outdent: string;
    priority: string;
    scheduledTime: string;
  };
  applyToOtherSurface: string;
  close: string;
  configure: string;
  hidden: string;
  inline: string;
  menu: string;
  reset: string;
  title: string;
  visible: string;
}

const placementActions: Array<{
  icon: ComponentType<{ className?: string }>;
  key:
    | 'add'
    | 'bold'
    | 'category'
    | 'clearCategory'
    | 'delete'
    | 'indent'
    | 'moveDown'
    | 'moveUp'
    | 'outdent'
    | 'priority';
}> = [
  { icon: Plus, key: 'add' },
  { icon: ArrowUp, key: 'moveUp' },
  { icon: ArrowDown, key: 'moveDown' },
  { icon: IndentDecrease, key: 'outdent' },
  { icon: IndentIncrease, key: 'indent' },
  { icon: Star, key: 'priority' },
  { icon: ({ ...props }) => <span {...props}>B</span>, key: 'bold' },
  { icon: Tag, key: 'category' },
  { icon: TaskTreeClearCategoryIcon, key: 'clearCategory' },
  { icon: Trash2, key: 'delete' },
];

const binaryActions = [
  { icon: GripVertical, key: 'drag' },
  { icon: Clock3, key: 'scheduledTime' },
] as const;

export function TaskTreeRowActionsMenu({
  labels,
  showScheduledTime = true,
  value,
  onApplyToOtherSurface = () => undefined,
  onChange,
}: {
  labels: TaskTreeRowActionsMenuLabels;
  showScheduledTime?: boolean;
  value: TaskTreeRowActionPreferences;
  onApplyToOtherSurface?: (value: TaskTreeRowActionPreferences) => void;
  onChange: (value: TaskTreeRowActionPreferences) => void;
}) {
  const [applyToOtherSurface, setApplyToOtherSurface] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const choices: Array<{
    label: string;
    value: TaskTreeRowActionPlacement;
  }> = [
    { label: labels.inline, value: 'inline' },
    { label: labels.menu, value: 'menu' },
    { label: labels.hidden, value: 'hidden' },
  ];
  const choiceClassName =
    'min-h-8 w-full whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]';

  function changePreferences(nextValue: TaskTreeRowActionPreferences) {
    onChange(nextValue);

    if (applyToOtherSurface) {
      onApplyToOtherSurface(nextValue);
    }
  }

  function closeDialog() {
    setApplyToOtherSurface(false);
    setIsOpen(false);
  }

  return (
    <>
      <IconButton
        aria-label={labels.configure}
        title={labels.configure}
        className="rounded-full border border-white/10 bg-white/5 text-[#bdb4d4] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
        onClick={() => {
          setApplyToOtherSurface(false);
          setIsOpen(true);
        }}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
      </IconButton>

      <Dialog
        closeLabel={labels.close}
        open={isOpen}
        panelClassName="sm:h-auto sm:max-h-[min(92vh,760px)] sm:max-w-[52rem]"
        title={labels.title}
        onClose={closeDialog}
      >
        <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#d8d0e8]">
              <Checkbox
                checked={applyToOtherSurface}
                className="border-[#f0c38e]/55 bg-[#f0c38e]/12 focus-visible:outline-[#f0c38e]"
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setApplyToOtherSurface(checked);

                  if (checked) {
                    onApplyToOtherSurface(value);
                  }
                }}
              />
              <span>{labels.applyToOtherSurface}</span>
            </label>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-[#f0c38e]/22 bg-[#f0c38e]/10 px-3 py-1.5 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:border-[#f0c38e]/36 hover:bg-[#f0c38e]/16 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onClick={() =>
                changePreferences({ ...defaultTaskTreeRowActionPreferences })
              }
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              {labels.reset}
            </button>
          </div>
          <div className="grid gap-2">
            {placementActions.map(({ icon: ActionIcon, key }) => (
              <div
                key={key}
                data-row-action-setting
                className="grid gap-2 rounded-xl bg-white/[0.035] p-2.5 sm:grid-cols-[minmax(10rem,1fr)_24rem] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#eee8f7]">
                  <ActionIcon className="size-4 shrink-0" />
                  <span className="truncate">{labels.actions[key]}</span>
                </div>
                <div
                  role="radiogroup"
                  aria-label={labels.actions[key]}
                  className="grid w-full grid-cols-3 gap-1 sm:w-[24rem]"
                >
                  {choices.map((choice) => {
                    const checked = value[key] === choice.value;

                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        data-row-action-choice
                        aria-checked={checked}
                        aria-label={`${labels.actions[key]}: ${choice.label}`}
                        className={`${choiceClassName} ${
                          checked
                            ? 'border-[#f0c38e]/40 bg-[#f0c38e]/14 text-[#fff9f2]'
                            : 'border-white/[0.08] bg-white/[0.025] text-[#aaa0bf] hover:bg-white/[0.07] hover:text-[#fff9f2]'
                        }`}
                        onClick={() =>
                          changePreferences({ ...value, [key]: choice.value })
                        }
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {binaryActions
              .filter(({ key }) => key !== 'scheduledTime' || showScheduledTime)
              .map(({ icon: ActionIcon, key }) => (
                <div
                  key={key}
                  data-row-action-setting
                  className="grid gap-2 rounded-xl bg-white/[0.035] p-2.5 sm:grid-cols-[minmax(10rem,1fr)_24rem] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#eee8f7]">
                    <ActionIcon className="size-4 shrink-0" />
                    <span className="truncate">{labels.actions[key]}</span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={labels.actions[key]}
                    className="grid w-full grid-cols-3 gap-1 sm:w-[24rem]"
                  >
                    {[
                      { label: labels.visible, value: true },
                      { label: labels.hidden, value: false },
                    ].map((choice) => {
                      const checked = value[key] === choice.value;

                      return (
                        <button
                          key={String(choice.value)}
                          type="button"
                          role="radio"
                          data-row-action-choice
                          aria-checked={checked}
                          aria-label={`${labels.actions[key]}: ${choice.label}`}
                          className={`${choiceClassName} ${
                            checked
                              ? 'border-[#f0c38e]/40 bg-[#f0c38e]/14 text-[#fff9f2]'
                              : 'border-white/[0.08] bg-white/[0.025] text-[#aaa0bf] hover:bg-white/[0.07] hover:text-[#fff9f2]'
                          }`}
                          onClick={() =>
                            changePreferences({ ...value, [key]: choice.value })
                          }
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </Dialog>
    </>
  );
}
