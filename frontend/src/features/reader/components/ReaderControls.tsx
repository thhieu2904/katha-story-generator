import React, { useEffect, useCallback, useRef } from 'react';
import { READER_CREDIT } from '../constants';

interface ReaderControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ReaderControls({ currentPage, totalPages, onPageChange }: ReaderControlsProps) {
  const gestureRef = useRef<{ x: number; y: number } | null>(null);

  const handlePrev = useCallback(() => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    } else {
      onPageChange(0);
    }
  }, [currentPage, totalPages, onPageChange]);

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
    <div className="relative z-40 bg-gradient-to-t from-katha-surface via-katha-surface to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentPage === 0}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-katha-primary"
          aria-label="Trang trước"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        
        <div 
          className="text-sm font-medium text-gray-400"
          aria-live="polite"
          aria-atomic="true"
        >
          {currentPage === 0 ? 'Bìa' : `Trang ${currentPage}/${totalPages}`}
        </div>
        
        <button
          onClick={handleNext}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-katha-primary"
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
      <p className="mx-auto mt-2 max-w-[1400px] text-center text-[11px] leading-relaxed text-white/30">
        {READER_CREDIT}
      </p>
    </div>
  );
}
