import React, { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLockedRegion } from '../hooks/useLockedRegion';

/**
 * The visible half of a layer lock: the Inspector's controls are disabled
 * while the layer is locked, except disclosure toggles and exempt controls,
 * and exactly those the hook disabled come back when the lock lifts.
 */
interface PanelProps {
  locked: boolean;
  applyDisabled?: boolean;
  showExtra?: boolean;
}

const Panel = ({ locked, applyDisabled = false, showExtra = false }: PanelProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useLockedRegion(ref, locked);
  return (
    <div ref={ref}>
      <input aria-label="X" />
      <select aria-label="Blend"><option>Normal</option></select>
      <textarea aria-label="Notes" />
      <button type="button" disabled={applyDisabled}>Apply</button>
      <button type="button" aria-expanded="false">Transform</button>
      <button type="button" data-lock-exempt>Go to source</button>
      {showExtra && <input aria-label="Feather" />}
    </div>
  );
};

const control = (name: string) => screen.getByRole(name === 'Blend' ? 'combobox' : name === 'Notes' ? 'textbox' : name === 'X' || name === 'Feather' ? 'textbox' : 'button', { name });
const flush = () => act(() => Promise.resolve());

describe('useLockedRegion', () => {
  it('disables form controls while locked and keeps disclosure and exempt controls usable', () => {
    render(<Panel locked />);
    for (const name of ['X', 'Blend', 'Notes', 'Apply']) expect(control(name)).toBeDisabled();
    expect(control('Transform')).toBeEnabled();
    expect(control('Go to source')).toBeEnabled();
  });

  it('does nothing while unlocked', () => {
    render(<Panel locked={false} />);
    for (const name of ['X', 'Blend', 'Notes', 'Apply']) expect(control(name)).toBeEnabled();
  });

  it('lifting the lock re-enables what it disabled, but not a control disabled for its own reason', () => {
    const view = render(<Panel locked applyDisabled />);
    expect(control('Apply')).toBeDisabled();
    view.rerender(<Panel locked={false} applyDisabled />);
    expect(control('X')).toBeEnabled();
    expect(control('Apply')).toBeDisabled();
  });

  it('a control mounted while locked (a card opened) is disabled too', async () => {
    const view = render(<Panel locked />);
    view.rerender(<Panel locked showExtra />);
    await flush();
    expect(control('Feather')).toBeDisabled();
    view.rerender(<Panel locked={false} showExtra />);
    expect(control('Feather')).toBeEnabled();
  });

  it('a control that becomes disabled for its own reason while locked stays disabled after unlock', async () => {
    const view = render(<Panel locked />);
    view.rerender(<Panel locked applyDisabled />);
    await flush();
    view.rerender(<Panel locked={false} applyDisabled />);
    expect(control('Apply')).toBeDisabled();
  });

  it('a control its owner re-enables while locked is locked again', async () => {
    const view = render(<Panel locked applyDisabled />);
    view.rerender(<Panel locked applyDisabled={false} />);
    await flush();
    expect(control('Apply')).toBeDisabled();
    view.rerender(<Panel locked={false} applyDisabled={false} />);
    expect(control('Apply')).toBeEnabled();
  });
});
