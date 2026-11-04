const headerControlBaseClassName =
  'touch-target inline-flex shrink-0 items-center justify-center rounded-full shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const headerControlNeutralFillClassName =
  'bg-white/8 text-[#f8f3ea] hover:bg-white/12 focus-visible:outline-[#f7d9b0]';

export const headerRoundControlClassName = `${headerControlBaseClassName} size-10`;

export const headerPillControlClassName = `${headerControlBaseClassName} ${headerControlNeutralFillClassName} h-10 gap-1.5 px-3.5 text-sm font-medium`;

export const pillTabListClassName =
  'flex items-center gap-1 rounded-full bg-white/6 p-1 shadow-sm shadow-[#253241]/10';

const pillTabBaseClassName =
  'touch-target inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]';

export const activePillTabClassName = `${pillTabBaseClassName} bg-[#f0c38e] font-semibold text-[#253241] shadow-[0_12px_28px_rgba(240,195,142,0.16)] hover:bg-[#f5d09f] hover:shadow-[0_16px_34px_rgba(240,195,142,0.22)]`;

export const pillTabClassName = `${pillTabBaseClassName} font-medium text-[#b4c1ce] hover:bg-white/8 hover:text-[#fff9f2]`;
