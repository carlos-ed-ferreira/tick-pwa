import type { ComponentPropsWithoutRef, ElementType } from 'react';

const sizeClassNames = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
} as const;

const toneClassNames = {
  default: 'text-foreground',
  muted: 'text-muted',
  danger: 'text-rose-600',
  inverseMuted: 'text-background/70',
} as const;

const weightClassNames = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const;

const leadingClassNames = {
  normal: '',
  relaxed: 'leading-6',
  loose: 'leading-7',
} as const;

type TextProps<TElement extends ElementType> = {
  as?: TElement;
  className?: string;
  leading?: keyof typeof leadingClassNames;
  size?: keyof typeof sizeClassNames;
  tone?: keyof typeof toneClassNames;
  weight?: keyof typeof weightClassNames;
} & Omit<ComponentPropsWithoutRef<TElement>, 'as' | 'className'>;

export function Text<TElement extends ElementType = 'p'>({
  as,
  className = '',
  leading = 'normal',
  size = 'sm',
  tone = 'default',
  weight = 'normal',
  ...props
}: TextProps<TElement>) {
  const Component = as ?? 'p';

  return (
    <Component
      className={`${sizeClassNames[size]} ${toneClassNames[tone]} ${weightClassNames[weight]} ${leadingClassNames[leading]} ${className}`}
      {...props}
    />
  );
}
