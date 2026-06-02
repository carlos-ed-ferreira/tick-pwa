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
      className="group inline-flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-background/60"
      onClick={(event) => onToggle(event.shiftKey)}
    >
      <span
        className={`flex size-3.5 items-center justify-center rounded-full shadow-sm transition ${
          isSelected
            ? 'bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(49,44,81,0.24)]'
            : 'bg-background/70 text-muted group-hover:bg-accent/20 group-hover:text-foreground'
        }`}
      >
        {isSelected && <Check aria-hidden="true" className="size-2" />}
      </span>
    </button>
  );
}
