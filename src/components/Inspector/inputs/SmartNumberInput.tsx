import React from 'react';

export interface SmartNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  displayScale?: number; // Display value = internal value * displayScale (e.g. 0.01 shows px/100)
  precision?: number;    // Decimal places for display
  /** BUGFIX: when true, keystrokes only update the local edit buffer —
   *  onChange fires ONCE on Enter/blur (parsed + clamped). Used by inputs
   *  whose value must not be committed mid-typing (e.g. keyframe frame
   *  numbers: typing "4" must not commit 4 before "40" is complete). */
  deferCommit?: boolean;
  onChange: (val: number) => void;
}

/**
 * Shared numeric input with deferred editing: keeps a local string while
 * focused, commits (clamped + rounded) on blur or Enter, and supports an
 * optional display scale/precision (internal value vs. displayed value).
 */
export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ value, min, max, step = 1, displayScale, precision, deferCommit = false, onChange }) => {
  const scale = displayScale ?? 1;
  const decimals = precision ?? 2;
  const rawVal = (value ?? 0) * scale;
  const displayVal = isNaN(rawVal) ? 0 : Math.round(rawVal * Math.pow(10, decimals)) / Math.pow(10, decimals);

  const [editingValue, setEditingValue] = React.useState<string>(String(displayVal));
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(String(displayVal));
    }
  }, [displayVal, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);
    // Deferred mode: keep the raw intermediate string in the buffer (e.g. "4"
    // while the user intends "40"); commit happens on Enter/blur only.
    if (deferCommit) return;
    let parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      let internal = Math.round((parsed / scale) * 100) / 100;
      // Clamp while typing too, so out-of-range values (e.g. opacity > 1)
      // take effect immediately instead of only after blur.
      if (min !== undefined) internal = Math.max(min, internal);
      if (max !== undefined) internal = Math.min(max, internal);
      onChange(internal);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(displayVal));
      return;
    }
    if (deferCommit) {
      // Commit the parsed + clamped value ONCE (Enter/blur). Only fire when
      // the value actually changed — this also guards the selection-change
      // race: when the user clicks another object while focused, the blur
      // that follows the re-render must not re-commit the old buffer value
      // onto a different target.
      let clamped = parsed;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      const rounded = Math.round(clamped * Math.pow(10, decimals)) / Math.pow(10, decimals);
      setEditingValue(String(rounded));
      if (rounded / scale !== value) {
        onChange(rounded / scale);
      }
      return;
    }
    const rounded = Math.round(parsed * Math.pow(10, decimals)) / Math.pow(10, decimals);
    setEditingValue(String(rounded));
  };

  const displayStep = step !== undefined ? step * Math.abs(scale) : undefined;

  return (
    <input
      className="input-control"
      type="number"
      value={isFocused ? editingValue : displayVal}
      min={min !== undefined ? min * scale : undefined}
      max={max !== undefined ? max * scale : undefined}
      step={displayStep}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};
