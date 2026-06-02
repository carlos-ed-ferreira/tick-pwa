import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input(
  {
    autoCapitalize = 'none',
    autoCorrect = 'off',
    className = '',
    spellCheck = false,
    ...props
  },
  ref,
) {
  return (
    <input
      ref={ref}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      className={className}
      {...props}
    />
  );
});
