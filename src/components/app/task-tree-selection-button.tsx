import { Check } from 'lucide-react';
import { IconButton } from '@/components/ui';

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
      <span
        className={`flex size-3.5 items-center justify-center rounded-full shadow-sm transition ${
          isSelected
            ? 'bg-[#f0c38e] text-[#241735] shadow-[0_8px_18px_rgba(240,195,142,0.24)]'
            : 'border border-white/15 bg-white/[0.08] text-[#bdb4d4]'
        }`}
      >
        {isSelected && <Check aria-hidden="true" className="size-2" />}
      </span>
    </IconButton>
  );
}
