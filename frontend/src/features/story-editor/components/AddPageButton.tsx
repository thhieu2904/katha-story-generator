import { useState } from 'react';

export function AddPageButton({ disabled, atMaximum, onAdd }: {
  disabled: boolean;
  atMaximum: boolean;
  onAdd: (instruction: string | null) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled || atMaximum}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-white/20 py-4 text-sm text-white/60 hover:border-katha-primary hover:text-white disabled:opacity-35"
      >
        {atMaximum ? 'Đã đạt số trang tối đa của band' : '+ Thêm trang ở cuối'}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <label className="text-sm font-medium">Gợi ý cho trang mới (không bắt buộc)</label>
      <input
        value={instruction}
        maxLength={1000}
        disabled={disabled}
        onChange={(event) => setInstruction(event.target.value)}
        className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-katha-primary"
        placeholder="Thêm một đoạn chuyển nhẹ trước cao trào"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white/50">Hủy</button>
        <button
          type="button"
          disabled={disabled || (instruction.length > 0 && instruction.trim().length < 5)}
          onClick={async () => {
            if (await onAdd(instruction.trim() || null)) {
              setInstruction('');
              setOpen(false);
            }
          }}
          className="rounded-lg bg-katha-primary px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Sinh trang mới
        </button>
      </div>
    </div>
  );
}