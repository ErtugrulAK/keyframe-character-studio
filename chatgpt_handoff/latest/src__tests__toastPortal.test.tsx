import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastPortal } from '../components/Toast/ToastPortal';
import type { ToastItem } from '../hooks/useToast';

describe('ToastPortal', () => {
  it('renders a plain notification message without extra structure', () => {
    render(<ToastPortal toasts={[{ id: 'plain', message: 'Exported "graphic.zip"', type: 'success' }]} removeToast={vi.fn()} />);

    expect(screen.getByText('Exported "graphic.zip"')).toBeTruthy();
    expect(screen.queryByText('Unsupported video layer')).toBeNull();
  });

  it('renders the title, explanation, and next step of a structured notification', () => {
    const toast: ToastItem = {
      id: 'structured',
      title: 'Unsupported video layer [Intro]',
      message: 'Layer type "custom_video" is not supported by OGraf Export V1.',
      action: 'Remove the video layer or replace it with exported image frames.',
      type: 'error',
    };

    render(<ToastPortal toasts={[toast]} removeToast={vi.fn()} />);

    expect(screen.getByText('Unsupported video layer [Intro]')).toBeTruthy();
    expect(screen.getByText('Layer type "custom_video" is not supported by OGraf Export V1.')).toBeTruthy();
    expect(screen.getByText('Remove the video layer or replace it with exported image frames.')).toBeTruthy();
  });
});
