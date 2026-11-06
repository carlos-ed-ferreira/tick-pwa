import { describe, expect, it } from 'vitest';
import type { Recurrence, RecurrenceRule } from '@/lib/domain';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  buildRuleFromForm,
  createDefaultRecurrenceForm,
  createFormFromRule,
  draftItemsToChildren,
  childrenToDraftItems,
} from '@/features/recurring/recurrence-form';
import {
  formatRecurrenceFrequency,
  formatRecurrenceRule,
} from '@/features/recurring/recurrence-format';

const today = '2026-11-06' as const;
const en = getDictionary('en');
const ptBR = getDictionary('pt-BR');

describe('recurrence form', () => {
  it('defaults to every day from today', () => {
    expect(
      buildRuleFromForm(createDefaultRecurrenceForm(today), today),
    ).toEqual({
      rule: { kind: 'interval', everyDays: 1, anchorDate: today },
    });
  });

  it.each<[RecurrenceRule]>([
    [{ kind: 'interval', everyDays: 15, anchorDate: '2026-11-01' }],
    [
      {
        kind: 'weekly',
        everyWeeks: 2,
        weekdays: [1, 3, 5],
        anchorDate: '2026-11-02',
      },
    ],
    [{ kind: 'weekly', everyWeeks: 1, weekdays: [2], anchorDate: null }],
    [{ kind: 'monthly_day', day: 10 }],
    [{ kind: 'monthly_last_day' }],
    [{ kind: 'monthly_weekday', ordinal: 'last', weekday: 5 }],
    [{ kind: 'monthly_weekday', ordinal: 3, weekday: 3 }],
  ])('round-trips %j', (rule) => {
    expect(buildRuleFromForm(createFormFromRule(rule, today), today)).toEqual({
      rule,
    });
  });

  it('requires the reference date only for a cycle longer than one day', () => {
    const form = createDefaultRecurrenceForm(today);

    expect(
      buildRuleFromForm({ ...form, everyDays: '1', intervalAnchor: '' }, today),
    ).toEqual({
      rule: { kind: 'interval', everyDays: 1, anchorDate: today },
    });
    expect(
      buildRuleFromForm(
        { ...form, everyDays: '15', intervalAnchor: '' },
        today,
      ),
    ).toEqual({ error: 'anchor' });
  });

  it('requires the reference week only for more than one week', () => {
    const form = {
      ...createDefaultRecurrenceForm(today),
      kind: 'weekly' as const,
      weekdays: [1 as const],
    };

    expect(
      buildRuleFromForm({ ...form, everyWeeks: '1', weeklyAnchor: '' }, today),
    ).toEqual({
      rule: { kind: 'weekly', everyWeeks: 1, weekdays: [1], anchorDate: null },
    });
    expect(
      buildRuleFromForm({ ...form, everyWeeks: '2', weeklyAnchor: '' }, today),
    ).toEqual({ error: 'anchor' });
  });

  it.each([
    ['interval', { everyDays: '0' }],
    ['interval', { everyDays: 'abc' }],
    ['interval', { everyDays: '' }],
  ])('rejects the %s input %j', (error, overrides) => {
    expect(
      buildRuleFromForm(
        { ...createDefaultRecurrenceForm(today), ...overrides },
        today,
      ),
    ).toEqual({ error });
  });

  it('rejects a weekly rule without weekdays and an out of range day', () => {
    const form = createDefaultRecurrenceForm(today);

    expect(
      buildRuleFromForm({ ...form, kind: 'weekly', weekdays: [] }, today),
    ).toEqual({ error: 'weekdays' });
    expect(
      buildRuleFromForm({ ...form, kind: 'monthly_day', day: '32' }, today),
    ).toEqual({ error: 'day' });
  });

  it('converts children to tree drafts and drops blank branches', () => {
    const drafts = childrenToDraftItems([
      {
        id: 'a',
        parentId: null,
        text: 'Keep',
        bold: true,
        priority: true,
        sortRank: 'a0',
      },
      {
        id: 'b',
        parentId: null,
        text: '   ',
        bold: false,
        priority: false,
        sortRank: 'a1',
      },
      {
        id: 'c',
        parentId: 'b',
        text: 'Under blank',
        bold: false,
        priority: false,
        sortRank: 'a0',
      },
    ]);

    expect(drafts[0]).toMatchObject({
      id: 'a',
      checked: false,
      collapsed: false,
    });
    expect(draftItemsToChildren(drafts)).toEqual([
      {
        id: 'a',
        parentId: null,
        text: 'Keep',
        bold: true,
        priority: true,
        sortRank: 'a0',
      },
    ]);
  });
});

describe('recurrence labels', () => {
  it.each<[RecurrenceRule, string, string]>([
    [
      { kind: 'interval', everyDays: 1, anchorDate: today },
      'Every day',
      'Todos os dias',
    ],
    [
      { kind: 'interval', everyDays: 15, anchorDate: today },
      'Every 15 days',
      'A cada 15 dias',
    ],
    [
      { kind: 'weekly', everyWeeks: 1, weekdays: [5, 1], anchorDate: null },
      'Every week: Mon, Fri',
      'Toda semana: Seg, Sex',
    ],
    [
      { kind: 'weekly', everyWeeks: 2, weekdays: [3], anchorDate: today },
      'Every 2 weeks: Wed',
      'A cada 2 semanas: Qua',
    ],
    [{ kind: 'monthly_day', day: 10 }, 'Monthly on day 10', 'Todo dia 10'],
    [
      { kind: 'monthly_last_day' },
      'Last day of the month',
      'Último dia do mês',
    ],
    [
      { kind: 'monthly_weekday', ordinal: 1, weekday: 1 },
      'First Monday of the month',
      'Primeira segunda-feira do mês',
    ],
    [
      { kind: 'monthly_weekday', ordinal: 'last', weekday: 0 },
      'Last Sunday of the month',
      'Último domingo do mês',
    ],
  ])('describes %j', (rule, english, portuguese) => {
    expect(formatRecurrenceRule(rule, en)).toBe(english);
    expect(formatRecurrenceRule(rule, ptBR)).toBe(portuguese);
  });

  it('shows the pause instead of the frequency of a paused activity', () => {
    const rule: RecurrenceRule = { kind: 'monthly_last_day' };
    const paused = {
      schedule: [
        { from: null, rule },
        { from: today, rule: null },
      ],
    } as Recurrence;

    expect(formatRecurrenceFrequency(paused, en)).toBe(
      'Paused · Last day of the month',
    );
  });
});
