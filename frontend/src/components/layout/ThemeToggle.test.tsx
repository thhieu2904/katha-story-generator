import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark';
    window.localStorage.clear();
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    window.localStorage.clear();
  });

  it('chuyển theme và lưu lựa chọn', async () => {
    const { container } = render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Bật giao diện sáng' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelectorAll('.toggle__backdrop')).toHaveLength(3);
    expect(container.querySelectorAll('.stars path')).toHaveLength(11);
    expect(container.querySelector('.pilot-bear')).not.toBeNull();
    expect(container.querySelector('.astrobear')).not.toBeNull();

    fireEvent.click(button);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem('katha-theme-v2')).toBe('light');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleName('Bật giao diện tối');
  });
});
