import React, { useEffect, useCallback, useState } from 'react';

interface ReaderControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ReaderControls({ currentPage, totalPages, onPageChange }: ReaderControlsProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'button') {
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  // Swipe navigation
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      setTouchStart(e.targetTouches[0].clientX);
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return;
      
      const touchEnd = e.changedTouches[0].clientX;
      const distance = touchStart - touchEnd;
      const isSwipe = Math.abs(distance) > 50;
      
      if (isSwipe) {
        if (distance > 0) {
          handleNext(); // Swipe left -> next
        } else {
          handlePrev(); // Swipe right -> prev
        }
      }
      
      setTouchStart(null);
    };
    
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, handlePrev, handleNext]);

  return (
    <div className="sticky bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-katha-surface via-katha-surface to-transparent z-40">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
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
    </div>
  );
}
