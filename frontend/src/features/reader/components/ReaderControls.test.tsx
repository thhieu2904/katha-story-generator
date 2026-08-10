import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderControls } from './ReaderControls';

function renderControls(currentPage = 0, totalPages = 3) {
  const onPageChange = vi.fn();
  render(
    <ReaderControls
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />,
  );
  return onPageChange;
}

function swipe(startX: number, startY: number, endX: number, endY: number) {
  fireEvent.touchStart(window, { targetTouches: [{ clientX: startX, clientY: startY }] });
  fireEvent.touchEnd(window, { changedTouches: [{ clientX: endX, clientY: endY }] });
}

describe('ReaderControls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('disables Previous on the cover and moves Next to page one', () => {
    const onPageChange = renderControls();

    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('moves Previous and Next relative to the active page', () => {
    const onPageChange = renderControls(2);

    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('returns to the cover after Next on the last page', () => {
    const onPageChange = renderControls(3);

    fireEvent.click(screen.getByRole('button', { name: 'Về bìa' }));

    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('moves to the next page for a valid left swipe', () => {
    const onPageChange = renderControls(1);

    swipe(240, 120, 160, 124);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('moves to the previous page for a valid right swipe', () => {
    const onPageChange = renderControls(2);

    swipe(120, 120, 190, 116);

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not change page for vertical or vertically dominated diagonal gestures', () => {
    const onPageChange = renderControls(2);

    swipe(120, 100, 124, 220);
    swipe(240, 100, 170, 180);

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('accepts a valid gesture that starts at x = 0', () => {
    const onPageChange = renderControls(2);

    swipe(0, 120, 70, 122);

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('ignores a gesture that starts on an interactive control', () => {
    const onPageChange = renderControls(1);
    const next = screen.getByRole('button', { name: 'Trang tiếp' });

    fireEvent.touchStart(next, { targetTouches: [{ clientX: 240, clientY: 120 }] });
    fireEvent.touchEnd(next, { changedTouches: [{ clientX: 160, clientY: 120 }] });
    fireEvent.click(next);

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('keeps ArrowLeft and ArrowRight keyboard navigation', () => {
    const onPageChange = renderControls(1);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onPageChange).toHaveBeenNthCalledWith(1, 0);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
  });
});
