'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true if current viewport is Mobile Compact (width < 768px OR height < 600px).
 * Deep interactive controls (such as AI instruction editing, drag-reorder, deep character mapping checkboxes)
 * are disabled on Mobile Compact viewports per system design spec §10.
 */
export function useIsMobileCompact(): boolean {
  const [isMobileCompact, setIsMobileCompact] = useState(true);

  useEffect(() => {
    const check = () => {
      setIsMobileCompact(window.innerWidth < 768 || window.innerHeight < 600);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobileCompact;
}
