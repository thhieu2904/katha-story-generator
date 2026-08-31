import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

export function SpellcheckFlags({ flags, validatedAt }: {
  flags: Record<string, unknown>[];
  validatedAt: string | null;
}) {
  const { copy } = useUiCopy();

  if (!validatedAt) {
    return <p className="mt-3 text-xs text-amber-300">{copy.khmerCheckNotRun}</p>;
  }
  if (flags.length === 0) {
    return <p className="mt-3 text-xs text-emerald-300/70">{copy.noTechnicalWarnings}</p>;
  }
  return (
    <details className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
      <summary className="cursor-pointer text-xs font-medium text-amber-200">
        {formatCopy(copy.flaggedCharacterCount, { count: flags.length })}
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-katha-text/55">
        {flags.map((flag, index) => (
          <li key={`${String(flag.kind)}-${String(flag.start)}-${index}`}>
            {formatCopy(copy.flagPosition, {
              kind: String(flag.kind),
              start: String(flag.start),
              end: String(flag.end),
            })}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-katha-text/35">{copy.spellcheckDisclaimer}</p>
    </details>
  );
}
