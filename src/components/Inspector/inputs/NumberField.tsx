import React from 'react';

type NativeNumberProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'>;

export interface NumberFieldProps extends NativeNumberProps {
  value: number;
  /** Receives every parsed number ('live') or the parsed number once on Enter/blur ('blur'). */
  onValue: (value: number) => void;
  /** 'live' (default) writes while typing; 'blur' writes once when the edit ends. */
  commit?: 'live' | 'blur';
}

/**
 * C10 — a numeric field that keeps what the user TYPES while it has focus.
 *
 * A plain controlled `<input type="number" value={n}>` re-renders the stored
 * number on every keystroke, so an emptied field jumps back to "0" (the 0
 * cannot be deleted) and "0." collapses to "0" (0.1 cannot be typed). Here the
 * text is the user's until the edit ends: only a complete number is written,
 * and an unfinished one ("", "-", "0.") never is. Clamping and rounding stay
 * with the caller, which already owns them.
 */
export const NumberField: React.FC<NumberFieldProps> = ({ value, onValue, commit = 'live', onFocus, onBlur, onKeyDown, ...rest }) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : '');

  const parse = (text: string): number | null => {
    if (text.trim() === '') return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <input
      {...rest}
      type="number"
      value={shown}
      onFocus={(event) => {
        setDraft(String(value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value;
        // The typed text is kept only during a focused edit (a value set
        // programmatically without focus shows the stored number again).
        if (draft !== null) setDraft(text);
        if (commit !== 'live') return;
        const parsed = parse(text);
        if (parsed !== null && parsed !== value) onValue(parsed);
      }}
      onBlur={(event) => {
        const parsed = draft === null ? null : parse(draft);
        setDraft(null);
        if (commit === 'blur' && parsed !== null && parsed !== value) onValue(parsed);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        onKeyDown?.(event);
      }}
    />
  );
};
