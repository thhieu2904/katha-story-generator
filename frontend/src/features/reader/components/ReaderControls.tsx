import React, { useEffect, useCallback, useRef } from 'react';
import { READER_CREDIT } from '../constants';

interface ReaderControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  narrationState?: 'idle' | 'preparing' | 'loading' | 'playing' | 'paused' | 'finished' | 'error';
  canNarrate?: boolean;
  onNarrationToggle?: () => void;
  navigationDisabled?: boolean;
}

export function ReaderControls({
  currentPage,
  totalPages,
  onPageChange,
  narrationState = 'idle',
  canNarrate = false,
  onNarrationToggle,
  navigationDisabled = false,
}: ReaderControlsProps) {
  const gestureRef = useRef<{ x: number; y: number } | null>(null);

  const handlePrev = useCallback(() => {
    if (!navigationDisabled && currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, navigationDisabled, onPageChange]);

  const handleNext = useCallback(() => {
    if (navigationDisabled) return;
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    } else {
      onPageChange(0);
    }
  }, [currentPage, navigationDisabled, totalPages, onPageChange]);

  const navigationRef = useRef({ handlePrev, handleNext });

  useEffect(() => {
    navigationRef.current = { handlePrev, handleNext };
  }, [handlePrev, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'button') {
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        navigationRef.current.handlePrev();
      } else if (e.key === 'ArrowRight') {
        navigationRef.current.handleNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Swipe navigation
  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => {
      return target instanceof Element && Boolean(
        target.closest('button, a, input, textarea, select, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'),
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isInteractiveTarget(e.target) || e.targetTouches.length === 0) {
        gestureRef.current = null;
        return;
      }

      const touch = e.targetTouches[0];
      gestureRef.current = { x: touch.clientX, y: touch.clientY };
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture || e.changedTouches.length === 0) return;
      
      const touchEnd = e.changedTouches[0];
      const dx = gesture.x - touchEnd.clientX;
      const dy = gesture.y - touchEnd.clientY;
      const isHorizontalSwipe = Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.25;
      
      if (isHorizontalSwipe) {
        if (dx > 0) {
          navigationRef.current.handleNext(); // Swipe left -> next
        } else {
          navigationRef.current.handlePrev(); // Swipe right -> prev
        }
      }
    };
    
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div className="relative z-40 shrink-0 bg-gradient-to-t from-katha-surface via-katha-surface to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={navigationDisabled || currentPage === 0}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-katha-text/10 hover:bg-katha-text/20 disabled:opacity-30 disabled:hover:bg-katha-text/10 transition-colors focus:outline-none focus:ring-2 focus:ring-katha-primary"
          aria-label="Trang trước"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        
        <div className="flex items-center gap-3">
          {onNarrationToggle && (
            <button
              type="button"
              onClick={onNarrationToggle}
              disabled={!canNarrate || narrationState === 'preparing'}
              className="flex min-h-[44px] items-center gap-2 rounded-full bg-katha-primary px-4 text-sm font-semibold text-katha-text transition-colors hover:bg-katha-primary/85 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={
                narrationState === 'preparing'
                  ? 'Đang tải giọng đọc'
                  : narrationState === 'playing' || narrationState === 'loading'
                  ? 'Tạm dừng đọc truyện'
                  : narrationState === 'paused'
                    ? 'Tiếp tục đọc truyện'
                    : 'Bắt đầu đọc truyện'
              }
            >
              {narrationState === 'preparing' ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : narrationState === 'playing' || narrationState === 'loading' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              <span className="hidden sm:inline">
                {narrationState === 'preparing'
                  ? 'Đang tải'
                  : narrationState === 'playing' || narrationState === 'loading'
                  ? 'Tạm dừng'
                  : narrationState === 'paused'
                    ? 'Tiếp tục'
                    : 'Bắt đầu nghe'}
              </span>
            </button>
          )}

          <div
            className="text-sm font-medium text-katha-text/55"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentPage === 0 ? 'Bìa' : `Trang ${currentPage}/${totalPages}`}
          </div>
        </div>
        
        <button
          onClick={handleNext}
          disabled={navigationDisabled}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-katha-text/10 hover:bg-katha-text/20 transition-colors focus:outline-none focus:ring-2 focus:ring-katha-primary"
          aria-label={currentPage === totalPages ? 'Về bìa' : 'Trang tiếp'}
        >
          {currentPage === totalPages ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-[1400px] text-center text-[11px] leading-relaxed text-katha-text/30">
        {READER_CREDIT}
      </p>
    </div>
  );
}
