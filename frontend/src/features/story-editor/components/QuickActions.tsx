import { QUICK_ACTIONS } from '../constants';
import type { QuickAction } from '../types';

export function QuickActions({ disabled, onAction }: {
  disabled: boolean;
  onAction: (action: QuickAction) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-white/70">Chỉnh nhanh bằng AI</h2>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action.value)}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm transition hover:bg-white/10 disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}