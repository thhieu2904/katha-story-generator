import React, { useState } from 'react';
import type { ReviewShare, ReviewCapabilities } from '../types';

interface ShareLinkPanelProps {
  share: ReviewShare;
  capabilities: ReviewCapabilities;
  storyTitle: string | null;
  onRevokeShare: () => void;
  onCreateShareLink: () => void;
  onArchive: () => void;
  disabled: boolean;
}

export function ShareLinkPanel({
  share,
  capabilities,
  storyTitle,
  onRevokeShare,
  onCreateShareLink,
  onArchive,
  disabled,
}: ShareLinkPanelProps) {
  const [copied, setCopied] = useState(false);

  const isActive = share.active && share.path;
  const shareUrl = isActive ? `${window.location.origin}${share.path}` : '';

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: storyTitle || 'Katha Story',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // Cancelled share
      // fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <div className="bg-katha-surface-light rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-white flex items-center gap-2">
            {isActive ? (
              <>
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Liên kết chia sẻ đang hoạt động
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Liên kết đã bị vô hiệu hóa
              </>
            )}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {isActive 
              ? 'Bất kỳ ai có liên kết này đều có thể đọc truyện.'
              : 'Liên kết cũ không còn hoạt động.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              <button
                onClick={handleCopy}
                disabled={disabled}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Đã sao chép!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Sao chép liên kết
                  </>
                )}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-katha-primary/10 hover:bg-katha-primary/20 text-katha-primary-light rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                Mở bản đọc
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </>
          ) : (
            capabilities.can_create_share_link && (
              <button
                onClick={onCreateShareLink}
                disabled={disabled}
                className="px-4 py-2 bg-katha-primary hover:bg-katha-primary-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Tạo liên kết chia sẻ mới
              </button>
            )
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 flex gap-4">
        {isActive && capabilities.can_revoke_share_link && (
          <button
            onClick={onRevokeShare}
            disabled={disabled}
            className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50"
          >
            Ngừng chia sẻ
          </button>
        )}
        {capabilities.can_archive && (
          <button
            onClick={onArchive}
            disabled={disabled}
            className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50"
          >
            Lưu trữ
          </button>
        )}
      </div>
    </div>
  );
}
