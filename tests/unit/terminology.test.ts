import { describe, expect, it } from 'vitest';
import { formatProgressLabel } from '@/lib/i18n';
import { enDictionary } from '@/lib/i18n/dictionaries/en';
import { ptBRDictionary } from '@/lib/i18n/dictionaries/pt-BR';

describe('product terminology', () => {
  it('uses tasks and subtasks throughout the daily task UI', () => {
    expect(ptBRDictionary.navigation.calendar).toBe('Tarefas do dia');
    expect(ptBRDictionary.calendar.editCategories).toBe(
      'Editar categorias de tarefas',
    );
    expect(ptBRDictionary.dayEditor.backToCalendar).toBe(
      'Voltar para o calendário',
    );
    expect(ptBRDictionary.dayEditor.addItem).toBe('Adicionar tarefa');
    expect(ptBRDictionary.dayEditor.addChild).toBe('Criar subtarefa');
    expect(ptBRDictionary.dayEditor.emptyChecklist).toBe(
      'Comece este dia com uma tarefa',
    );
    expect(ptBRDictionary.dayEditor.deleteItem).toBe('Excluir tarefa');
    expect(ptBRDictionary.dayEditor.preferencesTitle).toBe(
      'Preferências das tarefas',
    );

    expect(enDictionary.navigation.calendar).toBe('Daily Tasks');
    expect(enDictionary.calendar.editCategories).toBe('Edit task categories');
    expect(enDictionary.dayEditor.backToCalendar).toBe('Back to calendar');
    expect(enDictionary.dayEditor.title).toBe('Daily tasks');
    expect(enDictionary.dayEditor.addItem).toBe('Add task');
    expect(enDictionary.dayEditor.addChild).toBe('Create subtask');
    expect(enDictionary.dayEditor.emptyChecklist).toBe(
      'Start this day with a task',
    );
    expect(enDictionary.dayEditor.preferencesTitle).toBe('Task preferences');
  });

  it('calls the overflow menu extra options instead of three dots', () => {
    expect(ptBRDictionary.dayEditor.moreActions).toBe('Opções extras');
    expect(ptBRDictionary.dayEditor.actionInMenu).toBe('Opções extras');
    expect(ptBRDictionary.goalStepEditor.moreActions).toBe('Opções extras');
    expect(ptBRDictionary.goalStepEditor.actionInMenu).toBe('Opções extras');

    expect(enDictionary.dayEditor.moreActions).toBe('Extra options');
    expect(enDictionary.dayEditor.actionInMenu).toBe('Extra options');
    expect(enDictionary.goalStepEditor.moreActions).toBe('Extra options');
    expect(enDictionary.goalStepEditor.actionInMenu).toBe('Extra options');
  });

  it('uses steps and substeps throughout the goal UI', () => {
    expect(ptBRDictionary.goals.addStep).toBe('Adicionar etapa');
    expect(ptBRDictionary.goals.itemCategories).toBe('Etapas');
    expect(ptBRDictionary.goals.emptyGoal).toBe(
      'Comece esta meta adicionando uma etapa',
    );
    expect(ptBRDictionary.goals.goalProgressStep).toBe(
      '{completed} de {total} concluída',
    );
    expect(ptBRDictionary.goals.goalProgressSteps).toBe(
      '{completed} de {total} concluídas',
    );
    expect(
      formatProgressLabel({
        completed: 7,
        plural: ptBRDictionary.goals.goalProgressSteps,
        singular: ptBRDictionary.goals.goalProgressStep,
        total: 12,
      }),
    ).toBe('7 de 12 concluídas');
    expect(ptBRDictionary.goalStepEditor.addChild).toBe('Criar subetapa');
    expect(ptBRDictionary.goalStepEditor.itemPlaceholder).toBe(
      'Escreva uma etapa',
    );
    expect(ptBRDictionary.goalStepEditor.preferencesTitle).toBe(
      'Preferências das etapas',
    );

    expect(enDictionary.goals.addStep).toBe('Add step');
    expect(enDictionary.goals.itemCategories).toBe('Steps');
    expect(enDictionary.goals.goalProgressStep).toBe(
      '{completed} of {total} completed',
    );
    expect(enDictionary.goals.goalProgressSteps).toBe(
      '{completed} of {total} completed',
    );
    expect(enDictionary.goalStepEditor.addChild).toBe('Create substep');
    expect(enDictionary.goalStepEditor.itemPlaceholder).toBe('Write a step');
    expect(enDictionary.goalStepEditor.preferencesTitle).toBe(
      'Step preferences',
    );
  });
});
