import React from 'react';
import { useUiCopy } from '@/features/language/useUiCopy';

interface StopSharingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function StopSharingDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: StopSharingDialogProps) {
  const { copy } = useUiCopy();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-md rounded-2xl border border-katha-text/10 bg-katha-surface shadow-2xl p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-katha-error/10 mb-4">
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-katha-text mb-2">
          {copy.stopSharing}
        </h3>
        
        <p className="text-sm text-katha-text/70 mb-2">
          {copy.stopSharingHelp}
        </p>

        <p className="text-xs text-red-300 mb-6 bg-katha-error/10 p-3 rounded-lg text-left border border-katha-error/20">
          <svg className="inline w-4 h-4 mr-1.5 align-text-bottom" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {copy.stopSharingWarning}
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
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-katha-error text-katha-text hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? copy.processing : copy.stopSharing}
          </button>
        </div>
      </div>
    </div>
  );
}
