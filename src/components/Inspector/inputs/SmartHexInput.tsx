import React from 'react';

export interface SmartHexInputProps {
  value: string;
  fallback: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Shared hex color input: commits only valid hex strings (on change) and
 * reverts to the fallback on blur when the value is invalid or empty.
 */
export const SmartHexInput: React.FC<SmartHexInputProps> = ({
  value,
  fallback,
  onChange,
  placeholder,
  className,
}) => {
  const [editingValue, setEditingValue] = React.useState<string>(value || fallback);
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(value || fallback);
    }
  }, [value, fallback, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);

    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(valStr)) {
      onChange(valStr);
    } else if (valStr === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!editingValue || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(editingValue)) {
      setEditingValue(value || fallback);
    } else {
      onChange(editingValue);
    }
  };

  return (
    <input
      type="text"
      className={className || "input-control color-hex-input"}
      value={isFocused ? editingValue : (value || fallback)}
      placeholder={placeholder}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
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
