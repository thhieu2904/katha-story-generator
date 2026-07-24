import { useState } from 'react';
import type { StoryImageCharacter, StoryImagePage } from '../types';
import { CharacterMapping } from './CharacterMapping';

interface ImagePlanCompactRowProps {
  page: StoryImagePage;
  characters: StoryImageCharacter[];
  selectedCharacterIds: number[];
  mappingEditable: boolean;
  disabled: boolean;
  onMappingChange: (characterIds: number[]) => void;
}

export function ImagePlanCompactRow({
  page,
  characters,
  selectedCharacterIds,
  mappingEditable,
  disabled,
  onMappingChange,
}: ImagePlanCompactRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
            {page.page_no}
          </span>
          <div>
            <h4 className="text-sm font-medium text-white line-clamp-1">
              {page.image_scene_en || page.text_vi || `Trang ${page.page_no}`}
            </h4>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 text-xs text-katha-primary-light hover:underline focus:outline-none"
            >
              {expanded ? '▲ Thu gọn chi tiết' : '▶ Xem nội dung và chi tiết kỹ thuật'}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3">
        <CharacterMapping
          pageNo={page.page_no}
          characters={characters}
          selectedCharacterIds={selectedCharacterIds}
          disabled={disabled || !mappingEditable}
          onChange={onMappingChange}
        />
      </div>

      {expanded && (
        <div className="rounded-xl bg-black/30 p-4 space-y-3 text-xs border border-white/5">
          <div>
            <span className="font-semibold text-white/50 block mb-1">
              Nội dung tiếng Việt:
            </span>
            <p className="text-white/90">{page.text_vi}</p>
          </div>

          <div>
            <span className="font-semibold text-white/50 block mb-1">
              Nội dung tiếng Khmer:
            </span>
            <p className="text-khmer text-white/80">{page.text_km}</p>
          </div>

          {page.image_prompt_en && (
            <details className="text-white/40 pt-2 border-t border-white/5">
              <summary className="cursor-pointer hover:text-white/70">
                Chi tiết Prompt (English)
              </summary>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/60">
                {page.image_prompt_en}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
