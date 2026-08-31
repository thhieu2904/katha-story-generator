import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentLanguageProvider } from './ContentLanguageProvider';
import {
  FloatingContentLanguageControl,
  FloatingContentLanguageToggle,
} from './FloatingContentLanguageToggle';
import { useContentLanguage } from './useContentLanguage';

let pathname = '/admin/vision';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

function LanguageProbe() {
  const { language } = useContentLanguage();
  return <output aria-label="Ngôn ngữ hiện tại">{language}</output>;
}

describe('FloatingContentLanguageToggle', () => {
  beforeEach(() => {
    pathname = '/admin/vision';
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('switches and persists the shared content language', () => {
    render(
      <ContentLanguageProvider>
        <LanguageProbe />
        <FloatingContentLanguageToggle />
      </ContentLanguageProvider>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'KH' }));

    expect(screen.getByLabelText('Ngôn ngữ hiện tại')).toHaveTextContent('km');
    expect(window.localStorage.getItem('katha-content-language-v1')).toBe('km');
    expect(document.documentElement.dataset.contentLanguage).toBe('km');
  });

  it('collapses and restores the compact language controls', () => {
    const { unmount } = render(
      <ContentLanguageProvider>
        <FloatingContentLanguageToggle />
      </ContentLanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn bộ chọn ngôn ngữ' }));

    expect(screen.queryByRole('radio', { name: 'KH' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở bộ chọn ngôn ngữ' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(window.localStorage.getItem('katha-language-toggle-collapsed-v1')).toBe('true');

    unmount();
    render(
      <ContentLanguageProvider>
        <FloatingContentLanguageToggle />
      </ContentLanguageProvider>,
    );

    expect(screen.getByRole('button', { name: 'Mở bộ chọn ngôn ngữ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ chọn ngôn ngữ' }));
    expect(screen.getByRole('radio', { name: 'KH' })).toBeInTheDocument();
  });

  it('does not add a second toggle to the public story reader', () => {
    pathname = '/stories/shared-token';

    render(
      <ContentLanguageProvider>
        <FloatingContentLanguageToggle />
      </ContentLanguageProvider>,
    );

    expect(screen.queryByLabelText('Ngôn ngữ nội dung')).not.toBeInTheDocument();
  });

  it('does not add a second toggle to the authenticated private reader', () => {
    pathname = '/admin/stories/s1_UkLWZg9D/read';

    render(
      <ContentLanguageProvider>
        <FloatingContentLanguageToggle />
      </ContentLanguageProvider>,
    );

    expect(screen.queryByLabelText('Ngôn ngữ nội dung')).not.toBeInTheDocument();
  });

  it('can render the same floating control inside a private learning stage', () => {
    pathname = '/admin/stories/s1_UkLWZg9D/read';
    const onLanguageChange = vi.fn();

    render(
      <ContentLanguageProvider>
        <FloatingContentLanguageControl
          language="vi"
          onLanguageChange={onLanguageChange}
        />
      </ContentLanguageProvider>,
    );

    expect(screen.getByLabelText('Ngôn ngữ nội dung')).toHaveClass('fixed');
    fireEvent.click(screen.getByRole('radio', { name: 'KH' }));
    expect(onLanguageChange).toHaveBeenCalledWith('km');
  });

  it('drags the language control, keeps it on screen, and saves its position', () => {
    render(
      <ContentLanguageProvider>
        <FloatingContentLanguageControl language="vi" onLanguageChange={vi.fn()} />
      </ContentLanguageProvider>,
    );

    const control = screen.getByLabelText('Ngôn ngữ nội dung');
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({
      left: 700,
      top: 600,
      width: 240,
      height: 44,
      right: 940,
      bottom: 644,
      x: 700,
      y: 600,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });

    const handle = screen.getByRole('button', { name: 'Di chuyển bộ chọn ngôn ngữ' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 710, clientY: 610 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 410, clientY: 210 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 410, clientY: 210 });

    expect(control).toHaveStyle({ left: '400px', top: '200px' });
    expect(JSON.parse(window.sessionStorage.getItem('katha-language-toggle-position-v1')!)).toEqual({
      left: 400,
      top: 200,
    });
    expect(window.localStorage.getItem('katha-language-toggle-position-v1')).toBeNull();
  });
});
