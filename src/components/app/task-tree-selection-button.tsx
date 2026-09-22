import { CheckboxIndicator, IconButton } from '@/components/ui';

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
    <IconButton
      aria-label={isSelected ? deselectLabel : selectLabel}
      className="group inline-flex size-9 shrink-0 items-center justify-center rounded-md transition hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
      onClick={(event) => onToggle(event.shiftKey)}
    >
      <CheckboxIndicator checked={isSelected} size="compact" />
    </IconButton>
  );
}
