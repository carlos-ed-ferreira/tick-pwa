import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BottomSheet,
  BottomSheetAction,
  BottomSheetSection,
  Dialog,
} from '@/components/ui';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function getPanel(title: string) {
  return screen.getByRole('dialog', { name: title });
}

describe('Dialog', () => {
  it('keeps the full screen panel for the default size', () => {
    render(
      <Dialog open title="Full dialog" onClose={vi.fn()}>
        <p>content</p>
      </Dialog>,
    );

    const panel = getPanel('Full dialog');

    expect(panel.className).toContain('h-dvh');
    expect(panel.className).toContain('sm:h-[min(92vh,900px)]');
    expect(panel.className).toContain('sm:max-w-6xl');
  });

  it('caps the sheet panel below the full viewport', () => {
    render(
      <Dialog open size="sheet" title="Sheet dialog" onClose={vi.fn()}>
        <p>content</p>
      </Dialog>,
    );

    const panel = getPanel('Sheet dialog');

    expect(panel.className).not.toContain('h-dvh');
    expect(panel.className).toContain('max-h-[85dvh]');
  });

  it('gives the sheet panel its own scroll region', () => {
    render(
      <Dialog open size="sheet" title="Scrollable" onClose={vi.fn()}>
        <p data-testid="sheet-content">content</p>
      </Dialog>,
    );

    const region = screen.getByTestId('sheet-content').parentElement;

    expect(region?.className).toContain('overflow-y-auto');
    expect(region?.className).toContain('min-h-0');
  });

  it('names the dialog by its visible heading', () => {
    render(
      <Dialog open title="Named dialog" onClose={vi.fn()}>
        <p>content</p>
      </Dialog>,
    );

    const panel = getPanel('Named dialog');
    const headingId = panel.getAttribute('aria-labelledby');

    expect(headingId).toBeTruthy();
    expect(document.getElementById(headingId as string)?.tagName).toBe('H2');
    expect(panel.getAttribute('aria-label')).toBeNull();
  });

  it('keeps the tab sequence inside the panel', () => {
    render(
      <Dialog open title="Trapped" onClose={vi.fn()}>
        <button type="button">first</button>
        <button type="button">last</button>
      </Dialog>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close' });
    const lastButton = screen.getByRole('button', { name: 'last' });

    lastButton.focus();
    fireEvent.keyDown(lastButton, { key: 'Tab' });

    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(lastButton);
  });

  it('closes only the topmost dialog on escape', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();

    render(
      <>
        <Dialog open title="Outer" onClose={closeOuter}>
          <p>outer</p>
        </Dialog>
        <Dialog open title="Inner" onClose={closeInner}>
          <p>inner</p>
        </Dialog>
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it('unlocks the page scroll only when the last dialog closes', () => {
    const { rerender } = render(
      <>
        <Dialog open title="Outer" onClose={vi.fn()}>
          <p>outer</p>
        </Dialog>
        <Dialog open title="Inner" onClose={vi.fn()}>
          <p>inner</p>
        </Dialog>
      </>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Dialog open title="Outer" onClose={vi.fn()}>
          <p>outer</p>
        </Dialog>
        <Dialog open={false} title="Inner" onClose={vi.fn()}>
          <p>inner</p>
        </Dialog>
      </>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Dialog open={false} title="Outer" onClose={vi.fn()}>
          <p>outer</p>
        </Dialog>
        <Dialog open={false} title="Inner" onClose={vi.fn()}>
          <p>inner</p>
        </Dialog>
      </>,
    );

    expect(document.body.style.overflow).toBe('');
  });
});

describe('BottomSheet', () => {
  it('renders actions with a touch sized hit area', () => {
    const onSelect = vi.fn();

    render(
      <BottomSheet
        closeLabel="Close"
        open
        title="Row actions"
        onClose={vi.fn()}
      >
        <BottomSheetSection label="Structure">
          <BottomSheetAction onSelect={onSelect}>Add subtask</BottomSheetAction>
        </BottomSheetSection>
      </BottomSheet>,
    );

    const action = screen.getByRole('button', { name: 'Add subtask' });

    expect(action.className).toContain('touch-target');
    expect(action.className).toContain('min-h-11');

    fireEvent.click(action);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('labels a section for assistive technology', () => {
    render(
      <BottomSheet
        closeLabel="Close"
        open
        title="Row actions"
        onClose={vi.fn()}
      >
        <BottomSheetSection label="Structure">
          <BottomSheetAction onSelect={vi.fn()}>Add subtask</BottomSheetAction>
        </BottomSheetSection>
      </BottomSheet>,
    );

    expect(screen.getByRole('group', { name: 'Structure' })).toBeTruthy();
  });

  it('does not take the whole viewport', () => {
    render(
      <BottomSheet
        closeLabel="Close"
        open
        title="Row actions"
        onClose={vi.fn()}
      >
        <BottomSheetAction onSelect={vi.fn()}>Add subtask</BottomSheetAction>
      </BottomSheet>,
    );

    expect(getPanel('Row actions').className).not.toContain('h-dvh');
  });
});
