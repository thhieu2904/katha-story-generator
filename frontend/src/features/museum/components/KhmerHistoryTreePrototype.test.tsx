import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KhmerHistoryTreePrototype } from './KhmerHistoryTreePrototype';

describe('KhmerHistoryTreePrototype', () => {
  it('opens a content-free prototype card from a history point', async () => {
    render(<KhmerHistoryTreePrototype />);

    const firstStage = await screen.findByRole('button', {
      name: 'Giai đoạn thử nghiệm 01',
    });
    fireEvent.click(firstStage);

    expect(screen.getByRole('dialog', { name: 'Giai đoạn thử nghiệm 01' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nội dung sẽ được bổ sung' })).toBeInTheDocument();
    expect(screen.getByText(/Chưa có thông tin lịch sử\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông tin' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
