import React, { useState } from 'react';

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
      
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-katha-surface shadow-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-2">
          Từ chối trang
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Vui lòng nhập lý do từ chối. Lý do này sẽ được sử dụng trong lần tạo lại ảnh.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <textarea
            autoFocus
            className="w-full bg-katha-surface-light border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-katha-primary transition-colors min-h-[120px] resize-y"
            placeholder="Ví dụ: Ảnh bị lỗi hiển thị, nhân vật không đúng yêu cầu..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            maxLength={500}
          />
          
          <div className="flex items-center justify-between">
            <span className={`text-xs ${reason.length > 0 && isInvalid ? 'text-red-400' : 'text-gray-400'}`}>
              {reason.trim().length} / 500 (tối thiểu 5 ký tự)
            </span>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInvalid}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-katha-error/20 text-red-300 hover:bg-katha-error/30 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Từ chối'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
