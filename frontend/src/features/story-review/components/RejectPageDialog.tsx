import React, { useState } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

interface RejectPageDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
}

export function RejectPageDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: RejectPageDialogProps) {
  const [reason, setReason] = useState('');
  const { copy } = useUiCopy();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length >= 5 && trimmed.length <= 500) {
      onConfirm(trimmed);
    }
  };

  const isInvalid = reason.trim().length < 5 || reason.trim().length > 500;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-md rounded-2xl border border-katha-text/10 bg-katha-surface shadow-2xl p-6">
        <h3 className="text-xl font-semibold text-katha-text mb-2">
          {copy.rejectPage}
        </h3>
        <p className="text-sm text-katha-text/55 mb-6">
          {copy.rejectReasonHelp}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <textarea
            autoFocus
            className="w-full bg-katha-surface-light border border-katha-text/10 rounded-xl p-3 text-katha-text text-sm focus:outline-none focus:border-katha-primary transition-colors min-h-[120px] resize-y"
            placeholder={copy.rejectReasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            maxLength={500}
          />
          
          <div className="flex items-center justify-between">
            <span className={`text-xs ${reason.length > 0 && isInvalid ? 'text-red-400' : 'text-katha-text/55'}`}>
              {formatCopy(copy.rejectReasonCount, { count: reason.trim().length })}
            </span>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-katha-text/70 hover:bg-katha-text/5 transition-colors disabled:opacity-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInvalid}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-katha-error/20 text-red-300 hover:bg-katha-error/30 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? copy.processing : copy.reject}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
