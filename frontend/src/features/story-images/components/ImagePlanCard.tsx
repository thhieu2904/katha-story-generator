import { CharacterMapping } from './CharacterMapping';
import { GeneratedImageCard } from './GeneratedImageCard';
import type { StoryImageCharacter, StoryImagePage } from '../types';

interface ImagePlanCardProps {
  page: StoryImagePage;
  characters: StoryImageCharacter[];
  selectedCharacterIds: number[];
  mappingEditable: boolean;
  disabled: boolean;
  onMappingChange: (characterIds: number[]) => void;
}

export function ImagePlanCard({
  page,
  characters,
  selectedCharacterIds,
  mappingEditable,
  disabled,
  onMappingChange,
}: ImagePlanCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Trang {page.page_no}</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/55">Lần xử lý {page.image_attempt_count}</span>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Tiếng Việt</h3>
              <p className="mt-1 text-white/85">{page.text_vi}</p>
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Khmer</h3>
              <p className="text-khmer mt-1 text-lg leading-8 text-white/70">{page.text_km}</p>
            </section>
          </div>

          <details className="mt-5 rounded-xl border border-white/10 bg-black/15 p-3">
            <summary className="cursor-pointer text-sm font-medium text-white/75">Xem kế hoạch tiếng Anh và prompt (chỉ đọc)</summary>
            <div className="mt-4 space-y-4 text-sm leading-6 text-white/60">
              <section><h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Bản dịch</h3><p className="mt-1 whitespace-pre-wrap">{page.text_en || 'Chưa có kế hoạch minh họa.'}</p></section>
              <section><h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Cảnh minh họa</h3><p className="mt-1 whitespace-pre-wrap">{page.image_scene_en || 'Chưa có kế hoạch minh họa.'}</p></section>
              <section><h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Prompt sinh ảnh</h3><p className="mt-1 whitespace-pre-wrap">{page.image_prompt_en || 'Chưa có kế hoạch minh họa.'}</p></section>
            </div>
          </details>

          <CharacterMapping
            pageNo={page.page_no}
            characters={characters}
            selectedCharacterIds={selectedCharacterIds}
            disabled={!mappingEditable || disabled}
            onChange={onMappingChange}
          />
        </div>
        <div className="border-t border-white/10 bg-black/10 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <GeneratedImageCard page={page} />
        </div>
      </div>
    </article>
  );
}
