import { ChevronDown, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui';

export function TaskTreeCollapseButton({
  collapseLabel,
  expandLabel,
  hasChildren,
  isCollapsed,
  onClick,
}: {
  collapseLabel: string;
  expandLabel: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton
      aria-label={isCollapsed ? expandLabel : collapseLabel}
      className={`rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e] ${
        !hasChildren ? 'disabled:opacity-100' : ''
      }`}
      disabled={!hasChildren}
      onClick={onClick}
    >
      {isCollapsed || !hasChildren ? (
        <ChevronRight
          aria-hidden="true"
          className={`size-4 ${hasChildren ? '' : 'opacity-45'}`}
        />
      ) : (
        <ChevronDown aria-hidden="true" className="size-4" />
      )}
    </IconButton>
  );
}
