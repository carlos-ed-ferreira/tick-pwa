import { Check } from 'lucide-react';

export function TaskTreeSelectionButton({
  deselectLabel,
  isSelected,
  onToggle,
  selectLabel,
}: {
  deselectLabel: string;
  isSelected: boolean;
  onToggle: (shiftKey: boolean) => void;
  selectLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={isSelected ? deselectLabel : selectLabel}
      className="group inline-flex size-9 shrink-0 items-center justify-center rounded-md transition hover:bg-background"
      onClick={(event) => onToggle(event.shiftKey)}
    >
      <span
        className={`flex size-3.5 items-center justify-center rounded-full border-2 transition ${
          isSelected
            ? 'border-foreground bg-foreground text-background'
            : 'border-muted group-hover:border-foreground'
        }`}
      >
        {isSelected && <Check aria-hidden="true" className="size-2" />}
      </span>
    </button>
  );
}
