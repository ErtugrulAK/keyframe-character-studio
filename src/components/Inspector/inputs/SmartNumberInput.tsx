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
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(displayVal));
    } else {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      const rounded = Math.round(parsed * Math.pow(10, decimals)) / Math.pow(10, decimals);
      setEditingValue(String(rounded));
      onChange(rounded / scale);
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
