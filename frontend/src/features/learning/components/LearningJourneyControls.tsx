'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReaderLanguage } from '@/features/reader/types';
import { getUiCopy } from '@/features/language/uiCopy';

interface LearningJourneyControlsProps {
  language: ReaderLanguage;
  onReset: () => void;
  disabled?: boolean;
  className?: string;
}

export function LearningJourneyControls({
  language,
  onReset,
  disabled = false,
  className = '',
}: LearningJourneyControlsProps) {
  const copy = getUiCopy(language);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmingReset) return;
    cancelButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmingReset(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [confirmingReset]);

  return (
    <>
      <div
        className={`flex items-center justify-start ${className}`}
        aria-label={copy.learningJourneyActions}
      >
        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          disabled={disabled}
          className="min-h-10 cursor-pointer rounded-xl border border-katha-error/25 bg-katha-error/[0.07] px-4 text-sm font-semibold text-rose-200 transition hover:border-katha-error/40 hover:bg-katha-error/12 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copy.resetLearningProgress}
        </button>
      </div>

      {confirmingReset && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/65 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmingReset(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-learning-title"
            aria-describedby="reset-learning-description"
            className="w-full max-w-md rounded-3xl border border-katha-text/10 bg-katha-surface p-6 shadow-2xl sm:p-7"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-katha-error/10 text-xl text-rose-200" aria-hidden="true">
              ↺
            </div>
            <h2 id="reset-learning-title" className="mt-5 text-xl font-bold text-katha-text">
              {copy.resetLearningTitle}
            </h2>
            <p id="reset-learning-description" className="mt-3 text-sm leading-6 text-katha-text/60">
              {copy.resetLearningHelp}
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="min-h-11 cursor-pointer rounded-xl border border-katha-text/15 px-5 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.06]"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingReset(false);
                  onReset();
                }}
                className="min-h-11 cursor-pointer rounded-xl bg-katha-error px-5 text-sm font-bold text-white transition hover:brightness-110"
              >
                {copy.resetLearningConfirm}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
