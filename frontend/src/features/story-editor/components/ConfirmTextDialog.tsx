import { useState } from 'react';

export function ConfirmTextDialog({
  pageCount,
  warningCount,
  unvalidatedCount,
  pending,
  onCancel,
  onConfirm,
}: {
  pageCount: number;
  warningCount: number;
  unvalidatedCount: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (acknowledge: boolean) => void;
}) {
  const needsAck = warningCount > 0 || unvalidatedCount > 0;
  const [acknowledge, setAcknowledge] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-katha-text/10 bg-katha-surface p-6">
        <h2 className="text-xl font-semibold">Xác nhận nội dung</h2>
        <p className="mt-3 text-sm leading-6 text-katha-text/60">
          Sau bước này, {pageCount} trang sẽ bị khóa và không thể sửa text trong MVP. Bước này chưa sinh ảnh.
        </p>
        <div className="mt-4 rounded-xl bg-katha-text/[0.04] p-4 text-sm text-katha-text/55">
          <p>{warningCount} cảnh báo Khmer · {unvalidatedCount} trang chưa kiểm tra</p>
        </div>
        {needsAck && (
          <label className="mt-4 flex items-start gap-3 text-sm text-katha-text/70">
            <input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} className="mt-1" />
            Tôi đã xem các cảnh báo/trang chưa kiểm tra và vẫn muốn xác nhận.
          </label>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={onCancel} className="px-4 py-2 text-sm text-katha-text/60">Hủy</button>
          <button
            type="button"
            disabled={pending || (needsAck && !acknowledge)}
            onClick={() => onConfirm(acknowledge)}
            className="rounded-lg bg-katha-primary px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {pending ? 'Đang xác nhận…' : 'Xác nhận nội dung'}
          </button>
        </div>
      </div>
    </div>
  );
}