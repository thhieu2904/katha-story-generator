import { useState } from 'react';

interface EditKhmerTitleDialogProps {
  open: boolean;
  initialTitle: string;
  onClose: () => void;
  onConfirm: (textKm: string) => Promise<void>;
  isSubmitting: boolean;
}

export function EditKhmerTitleDialog({
  open,
  initialTitle,
  onClose,
  onConfirm,
  isSubmitting,
}: EditKhmerTitleDialogProps) {
  const [prevTitle, setPrevTitle] = useState(initialTitle);
  const [titleKm, setTitleKm] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);

  if (initialTitle !== prevTitle) {
    setPrevTitle(initialTitle);
    setTitleKm(initialTitle);
    setError(null);
  }

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = titleKm.trim();
    if (!trimmed) {
      setError('Tiêu đề tiếng Khmer không được để trống.');
      return;
    }
    if (trimmed.length > 160) {
      setError('Tiêu đề tối đa 160 ký tự.');
      return;
    }
    setError(null);
    await onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-katha-surface p-6 shadow-2xl space-y-4"
      >
        <h2 className="text-lg font-bold text-white">Chỉnh sửa tiêu đề tiếng Khmer</h2>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Tiêu đề tiếng Khmer (tối đa 160 ký tự)
          </label>
          <input
            type="text"
            value={titleKm}
            onChange={(e) => setTitleKm(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-khmer text-base focus:outline-none focus:border-katha-primary"
            placeholder="Nội dung tiêu đề tiếng Khmer"
            autoFocus
          />
          <p
            className={`mt-1 text-xs ${
              titleKm.trim().length > 160 ? 'text-red-400' : 'text-gray-400'
            }`}
          >
            {titleKm.trim().length} / 160
          </p>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !titleKm.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-katha-primary hover:bg-katha-primary-light text-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu tiêu đề'}
          </button>
        </div>
      </form>
    </div>
  );
}
