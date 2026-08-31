import { useState } from 'react';
import type { ReviewPageData, ReviewState } from '../types';
import { REVIEW_STATUS_COLORS } from '../constants';
import { KhmerTextEditor } from './KhmerTextEditor';
import { RejectPageDialog } from './RejectPageDialog';
import { RegenerateImageDialog } from './RegenerateImageDialog';
import { ApproveWarningDialog } from './ApproveWarningDialog';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

interface ReviewPageCardProps {
  page: ReviewPageData;
  reviewState: ReviewState;
  isMobileCompact: boolean;
  disabled: boolean;
  isEditing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: (text: string) => Promise<void>;
  onApprove: (acknowledgeKhmerWarnings: boolean) => Promise<boolean>;
  onReject: (reason: string) => Promise<boolean>;
  onRegenerate: () => Promise<boolean>;
  isMutating: boolean;
}

export function ReviewPageCard({
  page,
  reviewState,
  isMobileCompact,
  disabled,
  isEditing,
  onEditStart,
  onEditCancel,
  onEditSave,
  onApprove,
  onReject,
  onRegenerate,
  isMutating,
}: ReviewPageCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [approveWarningDialogOpen, setApproveWarningDialogOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRegeneratingLocal, setIsRegeneratingLocal] = useState(false);
  const { copy } = useUiCopy();

  const { capabilities } = reviewState;
  const canEdit =
    capabilities.can_edit_khmer && page.review_status !== 'approved';
  const canReview = capabilities.can_review_pages;

  const statusLabel =
    {
      pending: copy.statusPendingReview,
      approved: copy.statusApproved,
      rejected: copy.reject,
    }[page.review_status] || page.review_status;
  const statusColor =
    REVIEW_STATUS_COLORS[page.review_status] ||
    REVIEW_STATUS_COLORS.pending;

  const hasWarnings =
    (page.spellcheck_flags && page.spellcheck_flags.length > 0) ||
    !page.khmer_validated_at;

  const handleApproveClick = () => {
    if (hasWarnings) {
      setApproveWarningDialogOpen(true);
    } else {
      void executeApprove(false);
    }
  };

  const executeApprove = async (acknowledgeWarnings: boolean) => {
    try {
      setIsApproving(true);
      const approved = await onApprove(acknowledgeWarnings);
      if (approved) {
        setApproveWarningDialogOpen(false);
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    try {
      setIsRejecting(true);
      const rejected = await onReject(reason);
      if (rejected) {
        setRejectDialogOpen(false);
      }
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRegenerateConfirm = async () => {
    try {
      setIsRegeneratingLocal(true);
      const regenerated = await onRegenerate();
      if (regenerated) {
        setRegenDialogOpen(false);
      }
    } finally {
      setIsRegeneratingLocal(false);
    }
  };

  const isRegenerating =
    reviewState.job.is_running &&
    reviewState.job.active_page_id === page.id;
  const isStaleRecoveryTarget =
    reviewState.job.can_resume &&
    reviewState.job.active_page_id === page.id &&
    page.review_status === 'rejected';

  return (
    <div
      className={`katha-card flex flex-col rounded-2xl border bg-katha-surface-light transition-all ${
        isRegenerating
          ? 'border-katha-primary/30 ring-1 ring-katha-primary/20'
          : 'border-katha-text/8'
      } ${isMobileCompact ? 'p-3' : 'p-4 sm:p-5'}`}
    >
      {/* Page number */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="font-semibold text-katha-text/55">
          {formatCopy(copy.pageLabel, { page: page.page_no })}
        </span>
      </div>

      {/* Image with status badge */}
      <div className="relative rounded-xl overflow-hidden aspect-video bg-katha-text/5 border border-katha-text/5 mb-4 group">
        {page.image_url ? (
          <>
            <img
              src={page.image_url}
              alt={formatCopy(copy.pageLabel, { page: page.page_no })}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isRegenerating ? 'opacity-50' : ''
              }`}
              loading="lazy"
            />
            {isRegenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-katha-text text-sm font-medium">
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {copy.generatingReplacement}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-katha-text/5 to-transparent text-gray-500">
            <svg
              className="w-8 h-8 mb-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm">{copy.noImageAvailable}</span>
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur shadow-sm ${statusColor}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>
      </div>

      <div className="flex-1 flex flex-col space-y-4">
        {/* Khmer text (editable) */}
        {isEditing ? (
          <KhmerTextEditor
            value={page.text_km}
            onSave={onEditSave}
            onCancel={onEditCancel}
            maxLength={1200}
            disabled={disabled || isMutating}
          />
        ) : (
          <div className="group relative">
            <p className="text-katha-text font-khmer text-lg leading-relaxed pr-8">
              {page.text_km}
            </p>
            {canEdit && !isMobileCompact && (
              <button
                onClick={onEditStart}
                disabled={disabled}
                className="absolute top-0 right-0 p-1.5 text-katha-text/55 hover:text-katha-text bg-katha-text/5 hover:bg-katha-text/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                title={copy.editKhmerText}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Spellcheck warnings */}
        {hasWarnings && page.review_status !== 'approved' && (
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
            ⚠ {copy.khmerTextWarning}
          </div>
        )}

        {/* Vietnamese text (read-only) */}
        <div className="pt-3 border-t border-katha-text/5">
          <p className="text-sm text-katha-text/55 italic">{page.text_vi}</p>
        </div>

        {/* Rejection reason */}
        {page.review_status === 'rejected' && page.review_notes && (
          <div className="p-3 rounded-xl bg-katha-error/10 border border-katha-error/20">
            <p className="text-xs text-red-300 font-medium mb-1">
              {copy.rejectionReason}
            </p>
            <p className="text-sm text-red-200/90">{page.review_notes}</p>
          </div>
        )}

        {isStaleRecoveryTarget && (
          <button
            type="button"
            data-testid="stale-regeneration-recovery"
            onClick={() => setRegenDialogOpen(true)}
            disabled={disabled || isMutating || isRegenerating}
            className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-500/20 transition-colors disabled:opacity-50"
          >
            {copy.recoverRegeneration}
          </button>
        )}

        {page.review_status === 'rejected' && page.can_regenerate && !isMobileCompact && !isStaleRecoveryTarget && (
          <button
            onClick={() => setRegenDialogOpen(true)}
            disabled={disabled || isMutating || isRegenerating}
            className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/20 transition-colors disabled:opacity-50"
          >
            {copy.regenerateImage}
          </button>
        )}

        {/* Approve / Reject controls */}
        {canReview && !isMobileCompact && (
          <div className="mt-auto pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejectDialogOpen(true)}
                disabled={
                  disabled ||
                  isMutating ||
                  isApproving ||
                  isRejecting ||
                  !page.can_reject
                }
                className="flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-medium bg-katha-error/20 text-red-300 hover:bg-katha-error/30 transition-colors disabled:opacity-50"
              >
                {copy.reject}
              </button>
              <button
                type="button"
                onClick={handleApproveClick}
                disabled={
                  disabled ||
                  isMutating ||
                  isApproving ||
                  isRejecting ||
                  !page.can_approve ||
                  page.review_status === 'approved'
                }
                className="flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-medium bg-katha-success/20 text-emerald-300 hover:bg-katha-success/30 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {copy.approve}
              </button>
            </div>
            {!page.can_approve && (
              <p className="mt-2 text-center text-[11px] text-gray-500">
                {copy.reviewRequirements}
              </p>
            )}
            {page.can_approve && page.review_status === 'approved' && (
              <p className="mt-2 text-center text-[11px] text-gray-500">
                {copy.approvedPageHelp}
              </p>
            )}
          </div>
        )}
      </div>

      <RejectPageDialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={isRejecting}
      />

      <RegenerateImageDialog
        open={regenDialogOpen}
        onClose={() => setRegenDialogOpen(false)}
        onConfirm={handleRegenerateConfirm}
        isSubmitting={isRegeneratingLocal}
        pageNo={page.page_no}
      />

      <ApproveWarningDialog
        open={approveWarningDialogOpen}
        pageNo={page.page_no}
        onClose={() => setApproveWarningDialogOpen(false)}
        onConfirm={() => executeApprove(true)}
        isSubmitting={isApproving}
      />
    </div>
  );
}
