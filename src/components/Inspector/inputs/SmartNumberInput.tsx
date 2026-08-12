import React from 'react';

export interface SmartNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  displayScale?: number; // Display value = internal value * displayScale (e.g. 0.01 shows px/100)
  precision?: number;    // Decimal places for display
  onChange: (val: number) => void;
}

/**
 * Shared numeric input with deferred editing: keeps a local string while
 * focused, commits (clamped + rounded) on blur or Enter, and supports an
 * optional display scale/precision (internal value vs. displayed value).
 */
export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ value, min, max, step = 1, displayScale, precision, onChange }) => {
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
    // BUGFIX: every keystroke already commits via handleChange, so blur must
    // NOT re-commit `editingValue`. Re-committing here leaked the OLD
    // selection's value into the NEW selection: when the user typed a value,
    // then clicked another object, the browser fires mousedown (selection
    // change, React re-renders with the new selectedPartId) BEFORE the input
    // blur event — handleBlur then wrote the old editingValue into the NEW
    // object's transform (e.g. object A y=6 leaked into object B's y).
    // Blur only re-syncs the local display string to the committed prop.
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(displayVal));
    } else {
      const rounded = Math.round(parsed * Math.pow(10, decimals)) / Math.pow(10, decimals);
      setEditingValue(String(rounded));
    }
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
