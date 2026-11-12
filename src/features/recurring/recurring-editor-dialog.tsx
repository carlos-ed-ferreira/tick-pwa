'use client';

import { Bold, Check, Star, Tag, X } from 'lucide-react';
import { useState } from 'react';
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
  type SupportedLocale,
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
  collectEditorMeasures,
  createMeasureDraft,
  createDefaultRecurrenceForm,
  createFormFromRule,
  draftItemsToChildren,
  type EditorMeasureErrors,
  type MeasureDraft,
  type RecurrenceForm,
} from './recurrence-form';
import { RecurringChildrenEditor } from './recurring-children-editor';
import {
  ChildMeasureFields,
  RootMeasureFields,
} from './recurring-measure-fields';
import { RecurringFrequencyFields } from './recurring-frequency-fields';
import { RecurringTogglePill } from './recurring-toggle-pill';

interface EditorFormat {
  bold: boolean;
  categoryTagId: string | null;
  priority: boolean;
}

function getDraftSignature(
  measureDraft: MeasureDraft,
  childDrafts: Readonly<Record<string, MeasureDraft>>,
): string {
  return JSON.stringify([
    measureDraft.enabled ? measureDraft : null,
    Object.entries(childDrafts)
      .filter(([, draft]) => draft.enabled)
      .sort(([left], [right]) => left.localeCompare(right)),
  ]);
}

function withoutMeasures(content: RecurrenceContent): RecurrenceContent {
  return {
    ...content,
    children: content.children.map((child) => ({ ...child, measure: null })),
    measure: null,
  };
}

interface PendingUpdate {
  content: RecurrenceContent;
  rule: RecurrenceRule | undefined;
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
      <RecurringTogglePill
        active={format.bold}
        label={dictionary.recurring.bold}
        onToggle={() => onChange({ bold: !format.bold })}
      >
        <Bold aria-hidden="true" className="size-3.5" />
      </RecurringTogglePill>
      <RecurringTogglePill
        active={format.priority}
        label={dictionary.recurring.priority}
        onToggle={() => onChange({ priority: !format.priority })}
      >
        <Star aria-hidden="true" className="size-3.5" />
      </RecurringTogglePill>
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
  locale: SupportedLocale,
): RecurrenceForm {
  const rule = recurrence ? getLatestRule(recurrence.schedule) : null;

  return rule
    ? createFormFromRule(rule, today, locale)
    : createDefaultRecurrenceForm(today, locale);
}

function readRuleResult(
  form: RecurrenceForm,
  isPaused: boolean,
  today: LocalDateString,
  locale: SupportedLocale,
): { error: RecurrenceRuleError | null; rule: RecurrenceRule | undefined } {
  if (isPaused) {
    return { error: null, rule: undefined };
  }

  const result = buildRuleFromForm(form, today, locale);

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

function createChildMeasureDrafts(
  recurrence: Recurrence | null,
  locale: string,
): Record<string, MeasureDraft> {
  return Object.fromEntries(
    (recurrence?.children ?? []).flatMap((child) =>
      child.measure
        ? [[child.id, createMeasureDraft(child.measure, locale)]]
        : [],
    ),
  );
}

function readEditorSubmission(
  draft: Pick<
    ReturnType<typeof useEditorDraft>,
    | 'childDrafts'
    | 'form'
    | 'format'
    | 'isPaused'
    | 'items'
    | 'measureDraft'
    | 'text'
  >,
  today: LocalDateString,
  locale: SupportedLocale,
) {
  const name = draft.text.trim();
  const { error, rule } = readRuleResult(
    draft.form,
    draft.isPaused,
    today,
    locale,
  );
  const { errors, measures } = collectEditorMeasures(draft);
  const update: PendingUpdate | null =
    name && !error && !errors
      ? {
          content: {
            ...draft.format,
            text: name,
            children: draftItemsToChildren(draft.items, measures.childMeasures),
            measure: measures.measure,
          },
          rule,
        }
      : null;

  return { measureErrors: errors, name, ruleError: error, update };
}

function useMeasureDrafts(recurrence: Recurrence | null) {
  const { locale } = useAppContext();
  const [measureDraft, setMeasureDraft] = useState(() =>
    createMeasureDraft(recurrence?.measure, locale),
  );
  const [childDrafts, setChildDrafts] = useState(() =>
    createChildMeasureDrafts(recurrence, locale),
  );
  const [initialSignature] = useState(() =>
    getDraftSignature(measureDraft, childDrafts),
  );

  return {
    childDrafts,
    measureChanged:
      recurrence !== null &&
      getDraftSignature(measureDraft, childDrafts) !== initialSignature,
    measureDraft,
    setChildDrafts,
    setMeasureDraft,
  };
}

function useEditorDraft(recurrence: Recurrence | null, today: LocalDateString) {
  const { locale } = useAppContext();
  const [text, setText] = useState(recurrence?.text ?? '');
  const measures = useMeasureDrafts(recurrence);
  const [format, setFormat] = useState<EditorFormat>({
    bold: recurrence?.bold ?? false,
    categoryTagId: recurrence?.categoryTagId ?? null,
    priority: recurrence?.priority ?? false,
  });
  const [items, setItems] = useState(() =>
    childrenToDraftItems(recurrence?.children ?? []),
  );
  const [form, setForm] = useState(() =>
    createInitialForm(recurrence, today, locale),
  );

  return {
    ...measures,
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
  const { dictionary, locale, scope } = useAppContext();
  const labels = dictionary.recurring;
  const draft = useEditorDraft(recurrence, today);
  const [nameError, setNameError] = useState<string | null>(null);
  const [measureErrors, setMeasureErrors] =
    useState<EditorMeasureErrors | null>(null);
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
    const submission = readEditorSubmission(draft, today, locale);

    setNameError(submission.name ? null : labels.nameRequired);
    setRuleError(submission.ruleError);
    setMeasureErrors(submission.measureErrors);

    if (!submission.update) {
      return;
    }

    const { update } = submission;
    const contentChanged =
      recurrence !== null &&
      !isSameRecurrenceContent(
        withoutMeasures(recurrence),
        withoutMeasures(update.content),
      );

    if (hasAnswers && contentChanged) {
      setPending(update);
      return;
    }

    void persist(update, 'all');
  }

  return {
    ...draft,
    hasAnswers,
    isSaving,
    measureErrors,
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
      <RootMeasureFields
        draft={editor.measureDraft}
        error={editor.measureErrors?.root}
        hasChildren={editor.items.some((item) => item.text.trim())}
        showForwardNote={editor.hasAnswers && editor.measureChanged}
        onChange={editor.setMeasureDraft}
      />
      <RecurringChildrenEditor
        items={editor.items}
        setItems={editor.setItems}
      />
      <ChildMeasureFields
        drafts={editor.childDrafts}
        errors={editor.measureErrors?.children ?? {}}
        items={editor.items}
        onChange={(itemId, measure) =>
          editor.setChildDrafts((current) => ({
            ...current,
            [itemId]: measure,
          }))
        }
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
