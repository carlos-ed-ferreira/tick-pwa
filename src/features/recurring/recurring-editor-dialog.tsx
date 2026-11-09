'use client';

import { Bold, Check, Star, Tag, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { TaskTreeClearCategoryIcon } from '@/components/app';
import {
  Dialog,
  FormField,
  ModalActionButton,
  filledMediumPillControlClassName,
  toast,
} from '@/components/ui';
import {
  createRecurrence,
  updateRecurrence,
  type RecurrenceContentMode,
} from '@/lib/db';
import {
  getLatestRule,
  isRecurrencePaused,
  isSameRecurrenceContent,
  type AppScope,
  type LocalDateString,
  type Recurrence,
  type RecurrenceContent,
  type RecurrenceRule,
  type RecurrenceRuleError,
} from '@/lib/domain';
import {
  CategoryAssignmentMenu,
  CategoryManagerAction,
  useCategoryTags,
} from '@/features/categories';
import { useAppContext } from '@/providers';
import {
  buildRuleFromForm,
  childrenToDraftItems,
  createDefaultRecurrenceForm,
  createFormFromRule,
  draftItemsToChildren,
  type RecurrenceForm,
} from './recurrence-form';
import { RecurringChildrenEditor } from './recurring-children-editor';
import { RecurringFrequencyFields } from './recurring-frequency-fields';

interface EditorFormat {
  bold: boolean;
  categoryTagId: string | null;
  priority: boolean;
}

interface PendingUpdate {
  content: RecurrenceContent;
  rule: RecurrenceRule | undefined;
}

function FormatToggle({
  active,
  children,
  label,
  onToggle,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`touch-target inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
        active
          ? 'bg-[#f0c38e] text-[#253241]'
          : 'bg-white/8 text-[#aebac8] hover:bg-white/12 hover:text-[#fff9f2]'
      }`}
      onClick={onToggle}
    >
      {children}
      {label}
    </button>
  );
}

function EditorFormatRow({
  format,
  onChange,
}: {
  format: EditorFormat;
  onChange: (change: Partial<EditorFormat>) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const selectedCategory = useCategoryTags(scope, 'recurrence').find(
    (tag) => tag.id === format.categoryTagId,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormatToggle
        active={format.bold}
        label={dictionary.recurring.bold}
        onToggle={() => onChange({ bold: !format.bold })}
      >
        <Bold aria-hidden="true" className="size-3.5" />
      </FormatToggle>
      <FormatToggle
        active={format.priority}
        label={dictionary.recurring.priority}
        onToggle={() => onChange({ priority: !format.priority })}
      >
        <Star aria-hidden="true" className="size-3.5" />
      </FormatToggle>
      <CategoryAssignmentMenu
        assignLabel={
          selectedCategory
            ? `${dictionary.dayEditor.assignCategory}: ${selectedCategory.name}`
            : dictionary.dayEditor.assignCategory
        }
        clearLabel={dictionary.dayEditor.clearCategory}
        renderTriggerContent={({ selectedCategory: current }) =>
          current ? (
            <>
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: current.colorHex }}
              />
              <span className="max-w-40 truncate">{current.name}</span>
            </>
          ) : (
            <>
              <Tag aria-hidden="true" className="size-4" />
              {dictionary.recurring.categoryField}
            </>
          )
        }
        selectedCategoryTagId={format.categoryTagId}
        surface="recurrence"
        showClearButton={false}
        tooltip={dictionary.dayEditor.assignCategory}
        triggerClassName={filledMediumPillControlClassName}
        onAssign={(categoryTagId) => onChange({ categoryTagId })}
      />
      {selectedCategory ? (
        <button
          type="button"
          className={filledMediumPillControlClassName}
          onClick={() => onChange({ categoryTagId: null })}
        >
          <TaskTreeClearCategoryIcon className="size-4" />
          {dictionary.dayEditor.clearCategory}
        </button>
      ) : null}
      <CategoryManagerAction
        className={filledMediumPillControlClassName}
        surface="recurrence"
        title={dictionary.recurring.categoriesTitle}
      />
    </div>
  );
}

function ApplyChangesDialog({
  onChoose,
  onClose,
}: {
  onChoose: (mode: RecurrenceContentMode) => void;
  onClose: () => void;
}) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open
      size="sheet"
      title={labels.applyTitle}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <p className="px-1 text-sm leading-6 text-muted">
          {labels.applyDescription}
        </p>
        <div className="flex flex-col gap-2">
          <ModalActionButton tone="neutral" onClick={() => onChoose('all')}>
            {labels.applyAll}
          </ModalActionButton>
          <ModalActionButton tone="accent" onClick={() => onChoose('forward')}>
            {labels.applyForward}
          </ModalActionButton>
        </div>
      </div>
    </Dialog>
  );
}

function createInitialForm(
  recurrence: Recurrence | null,
  today: LocalDateString,
): RecurrenceForm {
  const rule = recurrence ? getLatestRule(recurrence.schedule) : null;

  return rule
    ? createFormFromRule(rule, today)
    : createDefaultRecurrenceForm(today);
}

function readRuleResult(
  form: RecurrenceForm,
  isPaused: boolean,
  today: LocalDateString,
): { error: RecurrenceRuleError | null; rule: RecurrenceRule | undefined } {
  if (isPaused) {
    return { error: null, rule: undefined };
  }

  const result = buildRuleFromForm(form, today);

  return 'error' in result
    ? { error: result.error, rule: undefined }
    : { error: null, rule: result.rule };
}

async function saveRecurrence({
  contentMode,
  recurrence,
  scope,
  today,
  update,
}: {
  contentMode: RecurrenceContentMode;
  recurrence: Recurrence | null;
  scope: AppScope;
  today: LocalDateString;
  update: PendingUpdate;
}): Promise<void> {
  if (recurrence) {
    await updateRecurrence({
      content: update.content,
      contentMode,
      recurrenceId: recurrence.id,
      rule: update.rule,
      scope,
      today,
    });
  } else if (update.rule) {
    await createRecurrence({
      content: update.content,
      rule: update.rule,
      scope,
    });
  }
}

function useEditorDraft(recurrence: Recurrence | null, today: LocalDateString) {
  const [text, setText] = useState(recurrence?.text ?? '');
  const [format, setFormat] = useState<EditorFormat>({
    bold: recurrence?.bold ?? false,
    categoryTagId: recurrence?.categoryTagId ?? null,
    priority: recurrence?.priority ?? false,
  });
  const [items, setItems] = useState(() =>
    childrenToDraftItems(recurrence?.children ?? []),
  );
  const [form, setForm] = useState(() => createInitialForm(recurrence, today));

  return {
    form,
    format,
    isPaused: recurrence ? isRecurrencePaused(recurrence.schedule) : false,
    items,
    setForm,
    setFormat,
    setItems,
    setText,
    text,
  };
}

function useRecurringEditor({
  hasAnswers,
  recurrence,
  today,
  onClose,
}: {
  hasAnswers: boolean;
  recurrence: Recurrence | null;
  today: LocalDateString;
  onClose: () => void;
}) {
  const { dictionary, scope } = useAppContext();
  const labels = dictionary.recurring;
  const draft = useEditorDraft(recurrence, today);
  const { format, form, isPaused, items, text } = draft;
  const [nameError, setNameError] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<RecurrenceRuleError | null>(null);
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function persist(
    update: PendingUpdate,
    contentMode: RecurrenceContentMode,
  ) {
    if (!scope) {
      return;
    }

    setPending(null);
    setIsSaving(true);

    try {
      await saveRecurrence({ contentMode, recurrence, scope, today, update });
      onClose();
    } catch (error) {
      console.error('Failed to save a recurrence.', error);
      toast.error(labels.saveFailed);
      setIsSaving(false);
    }
  }

  function submit() {
    const name = text.trim();
    const { error, rule } = readRuleResult(form, isPaused, today);

    setNameError(name ? null : labels.nameRequired);
    setRuleError(error);

    if (!name || error) {
      return;
    }

    const content = {
      ...format,
      text: name,
      children: draftItemsToChildren(items),
    };
    const contentChanged =
      recurrence !== null && !isSameRecurrenceContent(recurrence, content);

    if (hasAnswers && contentChanged) {
      setPending({ content, rule });
      return;
    }

    void persist({ content, rule }, 'all');
  }

  return {
    ...draft,
    isSaving,
    nameError,
    pending,
    persist,
    ruleError,
    setPending,
    setRuleError,
    submit,
  };
}

type RecurringEditorState = ReturnType<typeof useRecurringEditor>;

function RecurringEditorFields({ editor }: { editor: RecurringEditorState }) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-5">
      <FormField
        autoComplete="off"
        error={editor.nameError}
        label={labels.nameLabel}
        value={editor.text}
        onChange={(event) => editor.setText(event.target.value)}
      />
      <EditorFormatRow
        format={editor.format}
        onChange={(change) =>
          editor.setFormat((current) => ({ ...current, ...change }))
        }
      />
      <RecurringFrequencyFields
        disabled={editor.isPaused}
        error={editor.ruleError}
        form={editor.form}
        onChange={(change) => {
          editor.setForm((current) => ({ ...current, ...change }));
          editor.setRuleError(null);
        }}
      />
      <RecurringChildrenEditor
        items={editor.items}
        setItems={editor.setItems}
      />
    </div>
  );
}

export function RecurringEditorDialog({
  hasAnswers,
  recurrence,
  today,
  onClose,
}: {
  hasAnswers: boolean;
  recurrence: Recurrence | null;
  today: LocalDateString;
  onClose: () => void;
}) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const editor = useRecurringEditor({ hasAnswers, recurrence, today, onClose });
  const { pending } = editor;

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open
      panelClassName="sm:max-w-3xl"
      title={recurrence ? labels.editTitle : labels.createTitle}
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          editor.submit();
        }}
      >
        <RecurringEditorFields editor={editor} />
        <div className="flex items-center justify-end gap-2 p-4 sm:p-5">
          <ModalActionButton onClick={onClose}>
            <X aria-hidden="true" className="size-3.5" />
            {dictionary.actions.cancel}
          </ModalActionButton>
          <ModalActionButton
            disabled={editor.isSaving}
            tone="accent"
            type="submit"
          >
            <Check aria-hidden="true" className="size-3.5" />
            {labels.save}
          </ModalActionButton>
        </div>
      </form>
      {pending ? (
        <ApplyChangesDialog
          onChoose={(mode) => void editor.persist(pending, mode)}
          onClose={() => editor.setPending(null)}
        />
      ) : null}
    </Dialog>
  );
}
