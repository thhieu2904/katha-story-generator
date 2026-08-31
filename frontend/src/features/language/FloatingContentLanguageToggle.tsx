'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePathname } from 'next/navigation';
import { ReaderLanguageToggle } from '@/features/reader/components/ReaderLanguageToggle';
import type { ReaderLanguage } from '@/features/reader/types';
import { useContentLanguage } from './useContentLanguage';
import { getUiCopy } from './uiCopy';
import {
  loadFloatingLanguagePosition,
  saveFloatingLanguagePosition,
  type FloatingLanguagePosition,
} from './floatingLanguagePosition';

const COLLAPSED_STORAGE_KEY = 'katha-language-toggle-collapsed-v1';
const COLLAPSED_CHANGE_EVENT = 'katha-language-toggle-collapsed-change';
const VIEWPORT_PADDING = 8;

function subscribeToCollapsedState(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(COLLAPSED_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(COLLAPSED_CHANGE_EVENT, onStoreChange);
  };
}

function getCollapsedState() {
  return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
}

export function FloatingContentLanguageControl({
  language,
  onLanguageChange,
  elevated = false,
}: {
  language: ReaderLanguage;
  onLanguageChange: (language: ReaderLanguage) => void;
  elevated?: boolean;
}) {
  const copy = getUiCopy(language);
  const collapsed = useSyncExternalStore(subscribeToCollapsedState, getCollapsedState, () => false);
  const containerRef = useRef<HTMLElement>(null);
  const positionRef = useRef<FloatingLanguagePosition | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [position, setPosition] = useState<FloatingLanguagePosition | null>(null);
  const [dragging, setDragging] = useState(false);

  const updatePosition = useCallback((left: number, top: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 0;
    const height = rect?.height ?? 0;
    const next = {
      left: Math.min(
        Math.max(left, VIEWPORT_PADDING),
        Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING),
      ),
      top: Math.min(
        Math.max(top, VIEWPORT_PADDING),
        Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING),
      ),
    };

    positionRef.current = next;
    setPosition((current) =>
      current?.left === next.left && current.top === next.top ? current : next,
    );
  }, []);

  useEffect(() => {
    const saved = loadFloatingLanguagePosition();
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
      updatePosition(saved!.left!, saved!.top!);
    }
  }, [updatePosition]);

  useEffect(() => {
    const keepInsideViewport = () => {
      const current = positionRef.current;
      if (current) updatePosition(current.left, current.top);
    };
    window.addEventListener('resize', keepInsideViewport);
    const container = containerRef.current;
    const observer = typeof ResizeObserver === 'undefined' || !container
      ? null
      : new ResizeObserver(keepInsideViewport);
    if (container) observer?.observe(container);

    return () => {
      window.removeEventListener('resize', keepInsideViewport);
      observer?.disconnect();
    };
  }, [updatePosition]);

  function startDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    positionRef.current = { left: rect.left, top: rect.top };
    setPosition(positionRef.current);
    setDragging(true);
  }

  function moveWhileDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updatePosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
  }

  function finishDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const current = positionRef.current;
    if (!current) return;
    try {
      saveFloatingLanguagePosition(current);
    } catch {
      // Keep the position for this page when browser storage is unavailable.
    }
  }

  function toggleCollapsed() {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new Event(COLLAPSED_CHANGE_EVENT));
  }

  return (
    <aside
      ref={containerRef}
      className={`fixed right-3 z-[60] flex items-center gap-1 rounded-full bg-katha-surface/90 p-1 shadow-xl shadow-black/15 backdrop-blur-md sm:right-5 ${
        elevated ? 'bottom-24' : 'bottom-4 sm:bottom-5'
      } ${dragging ? 'select-none shadow-2xl ring-2 ring-katha-primary/45' : ''}`}
      style={position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : undefined}
      aria-label={copy.contentLanguage}
    >
      <button
        type="button"
        onPointerDown={startDragging}
        onPointerMove={moveWhileDragging}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
        aria-label={language === 'km' ? 'ផ្លាស់ទីជម្រើសភាសា' : 'Di chuyển bộ chọn ngôn ngữ'}
        title={language === 'km' ? 'អូសដើម្បីផ្លាស់ទី' : 'Kéo để di chuyển'}
        className={`grid size-9 shrink-0 touch-none place-items-center rounded-full border border-katha-text/10 bg-katha-field text-katha-text/50 transition hover:bg-katha-primary/15 hover:text-katha-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4"
          fill="currentColor"
        >
          <circle cx="6" cy="5" r="1.25" />
          <circle cx="14" cy="5" r="1.25" />
          <circle cx="6" cy="10" r="1.25" />
          <circle cx="14" cy="10" r="1.25" />
          <circle cx="6" cy="15" r="1.25" />
          <circle cx="14" cy="15" r="1.25" />
        </svg>
      </button>
      {!collapsed ? (
        <ReaderLanguageToggle language={language} onChange={onLanguageChange} compact />
      ) : null}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={
          collapsed
            ? language === 'km'
              ? 'បើកជម្រើសភាសា'
              : 'Mở bộ chọn ngôn ngữ'
            : language === 'km'
              ? 'បង្រួមជម្រើសភាសា'
              : 'Thu gọn bộ chọn ngôn ngữ'
        }
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-katha-text/10 bg-katha-field text-katha-text/65 transition hover:bg-katha-primary/15 hover:text-katha-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${
            collapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12.5 5-5 5 5 5" />
        </svg>
      </button>
    </aside>
  );
}

export function FloatingContentLanguageToggle() {
  const pathname = usePathname();
  const { language, setLanguage } = useContentLanguage();

  if (
    pathname.startsWith('/stories/') ||
    /^\/admin\/stories\/[^/]+\/read$/.test(pathname)
  ) {
    return null;
  }

  const isStoryWorkflow =
    pathname === '/admin/stories/new' ||
    /^\/admin\/stories\/[^/]+\/(setup|edit|images|review)$/.test(pathname);

  return (
    <FloatingContentLanguageControl
      language={language}
      onLanguageChange={setLanguage}
      elevated={isStoryWorkflow}
    />
  );
}
