'use client';

import { useState } from 'react';
import { archiveStory, fetchStory } from '../api';
import { isUncertainError } from '@/features/story-workflow/mutation-helpers';

interface ArchiveStoryDialogProps {
  storyId: number;
  storyTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ArchiveStoryDialog({ storyId, storyTitle, onClose, onSuccess }: ArchiveStoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await archiveStory(storyId);
      onSuccess();
    } catch (err) {
      if (isUncertainError(err)) {
        try {
          const current = await fetchStory(storyId);
          if (current.status === 'archived') {
            onSuccess();
            return;
          }
        } catch {
          // Re-read also failed
        }
      }
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-katha-surface shadow-2xl p-6">
        <h3 className="text-xl font-bold mb-2">Lưu trữ truyện</h3>
        <p className="text-sm text-white/70 mb-4">
          Bạn có chắc chắn muốn lưu trữ truyện <span className="font-semibold text-white">&ldquo;{storyTitle}&rdquo;</span>? Truyện sẽ bị lưu trữ. Bạn có thể khôi phục sau.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-katha-error/20 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={isSubmitting}
            className="rounded-lg bg-katha-error px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu trữ...' : 'Lưu trữ'}
          </button>
        </div>
      </div>
    </div>
  );
}
