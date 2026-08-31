import { QUICK_ACTIONS } from '../constants';
import type { QuickAction } from '../types';
import { useUiCopy } from '@/features/language/useUiCopy';

export function QuickActions({ disabled, onAction }: {
  disabled: boolean;
  onAction: (action: QuickAction) => void;
}) {
  const { copy } = useUiCopy();
  const labels: Record<QuickAction, string> = {
    shorten: copy.quickShorten,
    lengthen: copy.quickLengthen,
    more_dramatic: copy.quickDramatic,
    simplify: copy.quickSimplify,
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-katha-text/70">{copy.quickEditAi}</h2>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action.value)}
            className="rounded-lg border border-katha-text/15 bg-katha-text/[0.04] px-3 py-2 text-sm transition hover:bg-katha-text/10 disabled:opacity-40"
          >
            {labels[action.value]}
          </button>
        ))}
      </div>
    </section>
  );
}
