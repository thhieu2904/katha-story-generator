'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import type { StoryTextPage } from '@/features/stories/types';
import { SpellcheckFlags } from './SpellcheckFlags';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

export function StoryPageCard({
  page,
  index,
  count,
  disabled,
  canDelete,
  onMove,
  onDelete,
  onRetranslate,
}: {
  page: StoryTextPage;
  index: number;
  count: number;
  disabled: boolean;
  canDelete: boolean;
  onMove: (from: number, to: number) => void;
  onDelete: () => void;
  onRetranslate: () => void;
}) {
  const { language: contentLanguage } = useContentLanguage();
  const { copy } = useUiCopy();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`katha-card rounded-2xl border border-katha-text/10 bg-katha-text/[0.025] p-5 sm:p-7 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            aria-label={formatCopy(copy.dragPage, { page: page.page_no })}
            className="cursor-grab rounded-lg border border-katha-text/10 px-2 py-1 text-katha-text/45 disabled:cursor-default"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-katha-primary-light">
            {formatCopy(copy.pageLabel, { page: page.page_no })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)} className="rounded-md border border-katha-text/10 px-2 py-1 text-xs disabled:opacity-30" aria-label={copy.movePageUp}>↑</button>
          <button type="button" disabled={disabled || index === count - 1} onClick={() => onMove(index, index + 1)} className="rounded-md border border-katha-text/10 px-2 py-1 text-xs disabled:opacity-30" aria-label={copy.movePageDown}>↓</button>
          <button type="button" disabled={disabled} onClick={onRetranslate} className="rounded-md border border-katha-text/10 px-2 py-1 text-xs disabled:opacity-30">{copy.retranslateKhmer}</button>
          <button type="button" disabled={disabled || !canDelete} onClick={onDelete} className="rounded-md border border-katha-error/30 px-2 py-1 text-xs text-red-200 disabled:opacity-30">{copy.deleteAction}</button>
        </div>
      </div>
      <p
        lang={contentLanguage}
        className={`font-medium leading-8 text-katha-text/90 ${
          contentLanguage === 'km' ? 'text-khmer' : 'text-[17px]'
        }`}
      >
        {contentLanguage === 'km' ? page.text_km : page.text_vi}
      </p>
      <div className="my-5 border-t border-katha-text/10" />
      <p
        lang={contentLanguage === 'km' ? 'vi' : 'km'}
        className={`text-base leading-8 text-katha-text/65 ${
          contentLanguage === 'vi' ? 'text-khmer' : ''
        }`}
      >
        {contentLanguage === 'km' ? page.text_vi : page.text_km}
      </p>
      <SpellcheckFlags flags={page.spellcheck_flags} validatedAt={page.khmer_validated_at} />
    </article>
  );
}
