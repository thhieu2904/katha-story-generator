import React, { useState } from 'react';

interface KhmerTextEditorProps {
  value: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
  maxLength: number;
  disabled: boolean;
}

export function KhmerTextEditor({
  value,
  onSave,
  onCancel,
  maxLength,
  disabled,
}: KhmerTextEditorProps) {
  const [text, setText] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > maxLength) return;
    try {
      setIsSaving(true);
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  const isInvalid = !text.trim() || text.trim().length > maxLength;

  return (
    <div className="flex flex-col space-y-3 w-full">
      <textarea
        className="w-full bg-katha-surface-light border border-katha-text/10 rounded-xl p-3 text-katha-text font-khmer resize-y min-h-[100px] focus:outline-none focus:border-katha-primary transition-colors"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || isSaving}
        maxLength={maxLength * 2} // Allow some room during typing
        placeholder="Nhập nội dung tiếng Khmer..."
      />
      <div className="flex items-center justify-between">
        <div
          className={`text-xs ${
            text.trim().length > maxLength ? 'text-red-400' : 'text-katha-text/55'
          }`}
        >
          {text.trim().length} / {maxLength}
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || isSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-katha-text/70 hover:bg-katha-text/5 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || isSaving || isInvalid}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-katha-primary hover:bg-katha-primary-light text-katha-text transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}
