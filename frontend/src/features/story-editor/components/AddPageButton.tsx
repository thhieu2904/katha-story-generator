import { useState } from 'react';
import { useUiCopy } from '@/features/language/useUiCopy';

export function AddPageButton({ disabled, atMaximum, onAdd }: {
  disabled: boolean;
  atMaximum: boolean;
  onAdd: (instruction: string | null) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState('');
  const [open, setOpen] = useState(false);
  const { copy } = useUiCopy();

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled || atMaximum}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-katha-text/20 py-4 text-sm text-katha-text/60 hover:border-katha-primary hover:text-katha-text disabled:opacity-35"
      >
        {atMaximum ? copy.maxPagesReached : copy.addPageAtEnd}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-katha-text/10 bg-katha-text/[0.025] p-4">
      <label className="text-sm font-medium">{copy.newPageHint}</label>
      <input
        value={instruction}
        maxLength={1000}
        disabled={disabled}
        onChange={(event) => setInstruction(event.target.value)}
        className="mt-3 w-full rounded-lg border border-katha-text/10 bg-katha-field px-3 py-2 text-sm outline-none focus:border-katha-primary"
        placeholder={copy.newPagePlaceholder}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-katha-text/50">{copy.cancel}</button>
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
          {copy.generateNewPage}
        </button>
      </div>
    </div>
  );
}
