import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApproveWarningDialog } from './ApproveWarningDialog';

describe('ApproveWarningDialog', () => {
  it('requires an explicit Khmer warning acknowledgement before approval', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ApproveWarningDialog
        open
        pageNo={2}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        isSubmitting={false}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Đồng ý duyệt' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  });
});
