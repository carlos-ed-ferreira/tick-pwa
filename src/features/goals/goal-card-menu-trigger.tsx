import { MoreHorizontal } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { IconButton } from '@/components/ui';

export const GoalCardMenuTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function GoalCardMenuTrigger(props, ref) {
  return (
    <IconButton
      ref={ref}
      size="compact"
      className="rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
      {...props}
    >
      <MoreHorizontal aria-hidden="true" className="size-4" />
    </IconButton>
  );
});
