export function DeletePageDialog({ pageNo, pending, onCancel, onConfirm }: {
  pageNo: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-katha-text/10 bg-katha-surface p-6">
        <h2 className="text-xl font-semibold">Xóa trang {pageNo}?</h2>
        <p className="mt-3 text-sm leading-6 text-katha-text/55">Trang sẽ bị xóa ngay và không có undo/history trong MVP.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={onCancel} className="px-4 py-2 text-sm text-katha-text/60">Hủy</button>
          <button type="button" disabled={pending} onClick={onConfirm} className="rounded-lg bg-katha-error px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {pending ? 'Đang xóa…' : 'Xóa trang'}
          </button>
        </div>
      </div>
    </div>
  );
}