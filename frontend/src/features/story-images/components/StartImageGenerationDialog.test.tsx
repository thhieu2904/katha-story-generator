import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartImageGenerationDialog } from './StartImageGenerationDialog';

describe('StartImageGenerationDialog', () => {
  it('shows generation errors inside the modal', () => {
    render(
      <StartImageGenerationDialog
        mode="retry"
        pageCount={1}
        finalizationOnly={false}
        pending={false}
        error="Dịch vụ AI hiện chưa sẵn sàng."
        blocked={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onReconcile={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Dịch vụ AI hiện chưa sẵn sàng.');
  });

  it('offers canonical reconciliation instead of a blocked no-op confirm', () => {
    const onConfirm = vi.fn();
    const onReconcile = vi.fn();
    render(
      <StartImageGenerationDialog
        mode="start"
        pageCount={1}
        finalizationOnly={false}
        pending={false}
        error="Chưa thể đối soát trạng thái mới nhất."
        blocked
        onClose={vi.fn()}
        onConfirm={onConfirm}
        onReconcile={onReconcile}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại trạng thái' }));

    expect(onReconcile).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});