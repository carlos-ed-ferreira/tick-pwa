import { ChevronDown, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui';

export function TaskTreeCollapseButton({
  collapseLabel,
  disabled = false,
  expandLabel,
  hasChildren,
  isCollapsed,
  onClick,
}: {
  collapseLabel: string;
  disabled?: boolean;
  expandLabel: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton
      aria-label={isCollapsed ? expandLabel : collapseLabel}
      className="ml-1 -mr-2 rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
      disabled={disabled || !hasChildren}
      onClick={onClick}
    >
      {isCollapsed || !hasChildren ? (
        <ChevronRight aria-hidden="true" className="size-4" />
      ) : (
        <ChevronDown aria-hidden="true" className="size-4" />
      )}
    </IconButton>
  );
}
