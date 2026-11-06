export const filledControlAccentClassName =
  'bg-[#f0c38e]/14 text-[#f7d7ad] hover:bg-[#f0c38e]/22 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';

const filledControlBaseClassName =
  'touch-target inline-flex shrink-0 items-center justify-center rounded-full shadow-sm shadow-[#253241]/10 transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const filledControlNeutralClassName =
  'bg-white/8 text-[#f8f3ea] hover:bg-white/12 focus-visible:outline-[#f7d9b0]';

export const filledRoundControlClassName = `${filledControlBaseClassName} size-10`;

export const filledMediumRoundControlClassName = `${filledControlBaseClassName} size-9`;

export const filledPillControlClassName = `${filledControlBaseClassName} ${filledControlNeutralClassName} h-10 gap-1.5 px-3.5 text-sm font-medium`;

export const filledMediumPillControlClassName = `${filledControlBaseClassName} ${filledControlNeutralClassName} h-9 gap-1.5 px-3.5 text-sm font-medium`;

export const filledAccentPillControlClassName = `${filledControlBaseClassName} ${filledControlAccentClassName} h-9 gap-1.5 px-3.5 text-sm font-medium`;

export const filledCompactPillControlClassName = `${filledControlBaseClassName} h-8 gap-1.5 px-3 text-sm font-medium`;

export const taskListSurfaceClassName =
  'rounded-[0.75rem] bg-white/[0.035] p-3 shadow-[0_18px_44px_rgba(5,8,13,0.16)] sm:p-4';

export const pillTabListClassName =
  'flex items-center gap-1 rounded-full bg-white/6 p-1 shadow-sm shadow-[#253241]/10';

export const compactPillTabListClassName =
  'flex items-center gap-1 rounded-full bg-white/6 p-0.5 shadow-sm shadow-[#253241]/10';

const pillTabShapeClassName =
  'touch-target inline-flex items-center justify-center gap-2 rounded-full text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]';

const pillTabBaseClassName = `${pillTabShapeClassName} min-h-9 px-4`;

const compactPillTabBaseClassName = `${pillTabShapeClassName} h-8 px-3`;

const activePillTabToneClassName =
  'bg-[#f0c38e] font-semibold text-[#253241] shadow-[0_12px_28px_rgba(240,195,142,0.16)] hover:bg-[#f5d09f] hover:shadow-[0_16px_34px_rgba(240,195,142,0.22)]';

export const activePillTabClassName = `${pillTabBaseClassName} ${activePillTabToneClassName}`;

export const compactActivePillTabClassName = `${compactPillTabBaseClassName} ${activePillTabToneClassName}`;

const pillTabToneClassName =
  'font-medium text-[#b4c1ce] hover:bg-white/8 hover:text-[#fff9f2]';

export const pillTabClassName = `${pillTabBaseClassName} ${pillTabToneClassName}`;

export const compactPillTabClassName = `${compactPillTabBaseClassName} ${pillTabToneClassName}`;

export const filledControlDangerClassName =
  'bg-rose-400/14 text-rose-100 hover:bg-rose-400/22 hover:text-rose-50 focus-visible:outline-rose-200';
