import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirstExportGuide } from '../components/Header/FirstExportGuide';

/**
 * Milestone C — the first-export guidance is a compact, non-blocking panel that
 * explains the existing export path and offers the readiness check. It never
 * claims that a package was written.
 */

describe('FirstExportGuide', () => {
  it('names itself and lists the steps to a first export', () => {
    render(<FirstExportGuide onCheckReadiness={vi.fn()} isChecking={false} />);

    const group = screen.getByRole('group', { name: 'First export help' });
    expect(group).toBeTruthy();
    expect(screen.getByText(/Keep at least one visible layer/)).toBeTruthy();
    expect(screen.getByText(/readiness check/)).toBeTruthy();
    expect(screen.getByText(/OGraf Package/)).toBeTruthy();
    expect(screen.getByText(/Nothing is written until you export/)).toBeTruthy();
  });

  it('offers a labelled readiness action that reports its running state', () => {
    const onCheckReadiness = vi.fn();
    const { rerender } = render(<FirstExportGuide onCheckReadiness={onCheckReadiness} isChecking={false} />);

    const button = screen.getByRole('button', { name: 'Check export readiness' });
    fireEvent.click(button);
    expect(onCheckReadiness).toHaveBeenCalledTimes(1);

    rerender(<FirstExportGuide onCheckReadiness={onCheckReadiness} isChecking />);
    expect(screen.getByRole('button', { name: 'Check export readiness' })).toBeDisabled();
    expect(screen.getByText('Checking export…')).toBeTruthy();
  });

  it('never renders success or completion wording', () => {
    const { container } = render(<FirstExportGuide onCheckReadiness={vi.fn()} isChecking={false} />);
    const text = container.textContent ?? '';

    expect(text).not.toContain('Exported');
    expect(text).not.toContain('Export complete');
    expect(text).not.toContain('Ready');
  });
});
