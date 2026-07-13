'use client';

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';

interface AutoResizeTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onHeightChange?: (height: number) => void;
}

export const AutoResizeTextarea = forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(function AutoResizeTextarea(
  {
    autoCapitalize = 'none',
    autoCorrect = 'off',
    className = '',
    onChange,
    onHeightChange,
    rows = 1,
    spellCheck = false,
    value,
    ...props
  },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(forwardedRef, () => textareaRef.current!, []);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    onHeightChange?.(textarea.scrollHeight);
  }, [onHeightChange]);

  useLayoutEffect(() => {
    resize();
  }, [resize, value]);

  useLayoutEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  return (
    <textarea
      ref={textareaRef}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      rows={rows}
      value={value}
      className={`resize-none overflow-hidden ${className}`}
      onChange={(event) => {
        onChange?.(event);
        resize();
      }}
      {...props}
    />
  );
});
