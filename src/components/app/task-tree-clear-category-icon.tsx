import { Tag } from 'lucide-react';

export function TaskTreeClearCategoryIcon({
  className = 'size-4',
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center ${className}`}
      data-clear-category-icon
    >
      <Tag className="size-full" />
      <span className="absolute h-px w-[125%] -rotate-45 rounded-full bg-current ring-1 ring-[#1d252f]" />
    </span>
  );
}
