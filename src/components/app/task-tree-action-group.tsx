import type { ReactNode } from 'react';

export function TaskTreeActionGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-0 touch:order-3">
      {children}
    </div>
  );
}
