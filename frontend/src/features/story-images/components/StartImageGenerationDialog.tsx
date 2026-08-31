import { useEffect, useRef } from 'react';
import type { ImageGenerationDialogMode } from '../types';
import { formatCopy, type UiCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

interface StartImageGenerationDialogProps {
  mode: ImageGenerationDialogMode;
  pageCount: number;
  finalizationOnly: boolean;
  pending: boolean;
  error: string | null;
  blocked: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReconcile: () => void;
}

function dialogCopy(mode: ImageGenerationDialogMode, finalizationOnly: boolean, copy: UiCopy) {
  if (finalizationOnly) {
    return {
      title: copy.syncResultsTitle,
      action: copy.syncResults,
    };
  }
  if (mode === 'retry') {
    return {
      title: copy.retryMissingPages,
      action: copy.retryImageGeneration,
    };
  }
  if (mode === 'resume') {
    return {
      title: copy.continueImageGeneration,
      action: copy.continueImageGeneration,
    };
  }
  return {
    title: copy.startImageGeneration,
    action: copy.startImageGeneration,
  };
}

export function StartImageGenerationDialog({
  mode,
  pageCount,
  finalizationOnly,
  pending,
  error,
  blocked,
  onClose,
  onConfirm,
  onReconcile,
}: StartImageGenerationDialogProps) {
  const isFinalizationOnly = mode === 'resume' && finalizationOnly;
  const { copy, language } = useUiCopy();
  const labels = dialogCopy(mode, isFinalizationOnly, copy);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement;
    return () => {
      previouslyFocusedElement.current?.focus();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !pending) {
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      if (!dialogRef.current) return;
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-image-generation-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
    >
      <div className="w-full max-w-lg rounded-2xl border border-katha-text/10 bg-katha-surface p-6 shadow-2xl space-y-4">
        <h2 id="start-image-generation-title" className="text-xl font-semibold text-katha-text">
          {labels.title}
        </h2>
        <p className="text-sm leading-6 text-katha-text/65">
          {isFinalizationOnly
            ? copy.syncResultsHelp
            : formatCopy(copy.imageCountHelp, { count: pageCount })}
        </p>
        <p className="rounded-xl border border-katha-primary/20 bg-katha-primary/10 p-3 text-xs leading-5 text-katha-primary-light">
          {isFinalizationOnly
            ? copy.syncOnlyHelp
            : copy.completedImagesKept}
        </p>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-3 text-sm leading-5 text-rose-200"
          >
            <p>{language === 'vi' ? error : copy.genericError}</p>
            {blocked && (
              <p className="mt-1 text-xs text-rose-100/75">
                {copy.reloadBeforeRequest}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm text-katha-text/60 hover:text-katha-text disabled:opacity-50 transition"
          >
            {copy.cancel}
          </button>
          <button
            autoFocus
            type="button"
            disabled={pending || (!blocked && !isFinalizationOnly && pageCount <= 0)}
            onClick={blocked ? onReconcile : onConfirm}
            className="min-h-[44px] rounded-xl bg-katha-primary px-4 py-2 text-sm font-semibold text-katha-text shadow-lg disabled:opacity-40 hover:bg-katha-primary-light transition"
          >
            {pending ? copy.sendingRequest : blocked ? copy.checkStateAgain : labels.action}
          </button>
        </div>
      </div>
    </div>
  );
}
