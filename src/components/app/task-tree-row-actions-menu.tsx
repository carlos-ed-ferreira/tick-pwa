'use client';

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
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

export interface TaskTreePreferenceSetting {
  choices: ReadonlyArray<{ label: string; value: string }>;
  defaultValue: string;
  icon: ComponentType<{ className?: string }>;
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

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
    scheduledDate: string;
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
  { icon: CalendarDays, key: 'scheduledDate' },
] as const;

export function TaskTreeRowActionsMenu({
  labels,
  settings = [],
  showScheduledTime = true,
  showScheduledDate = false,
  value,
  onApplyToOtherSurface = () => undefined,
  onChange,
}: {
  labels: TaskTreeRowActionsMenuLabels;
  settings?: readonly TaskTreePreferenceSetting[];
  showScheduledTime?: boolean;
  showScheduledDate?: boolean;
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

  function changePreferences(nextValue: TaskTreeRowActionPreferences) {
    onChange(nextValue);

    if (applyToOtherSurface) {
      onApplyToOtherSurface(nextValue);
    }
  }

  function restoreDefaults() {
    changePreferences({ ...defaultTaskTreeRowActionPreferences });

    for (const setting of settings) {
      setting.onChange(setting.defaultValue);
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
        className="rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#aebac8] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
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
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#cbd5e0]">
              <Checkbox
                checked={applyToOtherSurface}
                className="inset-ring-[#f0c38e]/55 bg-[#f0c38e]/12 focus-visible:outline-[#f0c38e]"
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
              className="flex items-center gap-1.5 rounded-full inset-ring-hairline inset-ring-[#f0c38e]/22 bg-[#f0c38e]/10 px-3 py-1.5 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:inset-ring-[#f0c38e]/36 hover:bg-[#f0c38e]/16 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onClick={restoreDefaults}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              {labels.reset}
            </button>
          </div>
          <div className="grid gap-2">
            {settings.map((setting) => (
              <PreferenceSettingRow
                key={setting.key}
                choices={setting.choices}
                icon={setting.icon}
                label={setting.label}
                value={setting.value}
                onSelect={setting.onChange}
              />
            ))}

            {settings.length > 0 ? (
              <span aria-hidden="true" className="my-1 h-px bg-white/8" />
            ) : null}

            {placementActions.map(({ icon: ActionIcon, key }) => (
              <PreferenceSettingRow
                key={key}
                choices={choices}
                icon={ActionIcon}
                label={labels.actions[key]}
                value={value[key]}
                onSelect={(nextValue) =>
                  changePreferences({ ...value, [key]: nextValue })
                }
              />
            ))}

            {binaryActions
              .filter(({ key }) => key !== 'scheduledTime' || showScheduledTime)
              .filter(({ key }) => key !== 'scheduledDate' || showScheduledDate)
              .map(({ icon: ActionIcon, key }) => (
                <PreferenceSettingRow
                  key={key}
                  choices={[
                    { label: labels.visible, value: 'true' },
                    { label: labels.hidden, value: 'false' },
                  ]}
                  icon={ActionIcon}
                  label={labels.actions[key]}
                  value={String(value[key])}
                  onSelect={(nextValue) =>
                    changePreferences({ ...value, [key]: nextValue === 'true' })
                  }
                />
              ))}
          </div>
        </div>
      </Dialog>
    </>
  );
}

function PreferenceSettingRow({
  choices,
  icon: SettingIcon,
  label,
  value,
  onSelect,
}: {
  choices: ReadonlyArray<{ label: string; value: string }>;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onSelect: (value: string) => void;
}) {
  const choiceClassName =
    'min-h-8 w-full whitespace-nowrap rounded-lg inset-ring-hairline px-2 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]';

  return (
    <div
      data-row-action-setting
      className="grid gap-2 rounded-xl bg-white/[0.035] p-2.5 sm:grid-cols-[minmax(10rem,1fr)_24rem] sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#e5ebf3]">
        <SettingIcon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid w-full grid-cols-3 gap-1 sm:w-[24rem]"
      >
        {choices.map((choice) => {
          const checked = value === choice.value;

          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              data-row-action-choice
              aria-checked={checked}
              aria-label={`${label}: ${choice.label}`}
              className={`${choiceClassName} ${
                checked
                  ? 'inset-ring-[#f0c38e]/40 bg-[#f0c38e]/14 text-[#fff9f2]'
                  : 'inset-ring-white/[0.08] bg-white/[0.025] text-[#9aa6b3] hover:bg-white/[0.07] hover:text-[#fff9f2]'
              }`}
              onClick={() => onSelect(choice.value)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
