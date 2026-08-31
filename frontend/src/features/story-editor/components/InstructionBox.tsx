import { useState } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

export function InstructionBox({ disabled, onSubmit }: {
  disabled: boolean;
  onSubmit: (instruction: string) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState('');
  const { copy } = useUiCopy();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = instruction.trim();
    if (value.length < 5 || disabled) return;
    if (await onSubmit(value)) setInstruction('');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="story-instruction" className="block text-sm font-semibold text-katha-text/70">
        {copy.editInstruction}
      </label>
      <textarea
        id="story-instruction"
        value={instruction}
        disabled={disabled}
        minLength={5}
        maxLength={1000}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder={copy.editInstructionPlaceholder}
        className="min-h-24 w-full rounded-xl border border-katha-text/10 bg-katha-field p-4 text-sm outline-none focus:border-katha-primary disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-katha-text/35">
          {formatCopy(copy.noChatHistory, { count: instruction.length })}
        </span>
        <button
          type="submit"
          disabled={disabled || instruction.trim().length < 5}
          className="rounded-lg bg-katha-primary px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {copy.sendRequest}
        </button>
      </div>
    </form>
  );
}
