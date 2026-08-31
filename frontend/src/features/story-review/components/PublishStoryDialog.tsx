import React from 'react';
import { useUiCopy } from '@/features/language/useUiCopy';

interface PublishStoryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function PublishStoryDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: PublishStoryDialogProps) {
  const { copy } = useUiCopy();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-md rounded-2xl border border-katha-text/10 bg-katha-surface shadow-2xl p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-katha-primary/10 mb-4">
          <svg className="h-6 w-6 text-katha-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-katha-text mb-2">
          {copy.publishAndShare}
        </h3>
        
        <p className="text-sm text-katha-text/70 mb-2">
          {copy.publishHelp}
        </p>

        <p className="text-xs text-katha-text/55 mb-6 bg-katha-text/5 p-3 rounded-lg text-left border border-katha-text/5">
          <svg className="inline w-4 h-4 mr-1.5 align-text-bottom text-katha-text/55" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {copy.privateLinkNotice}
        </p>

        <div className="flex justify-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-katha-text/70 hover:bg-katha-text/5 transition-colors disabled:opacity-50"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-katha-primary text-katha-text hover:bg-katha-primary-light transition-colors disabled:opacity-50"
          >
            {isSubmitting ? copy.processing : copy.publish}
          </button>
        </div>
      </div>
    </div>
  );
}
