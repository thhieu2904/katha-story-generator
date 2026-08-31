import type { KhmerKnowledge } from '@/features/vision/api';

const STORAGE_KEY = 'katha-vision-story-draft-v1';
const MAX_DESCRIPTION_LENGTH = 2000;
const VISION_CLASS_MARKER_REGEX = /(?:^|\n)Mã nhận diện Vision:\s*([a-z0-9_]+)\s*(?:\n|$)/;

export interface VisionStoryDraft {
  version: 1;
  className: string;
  sourceLabel: string;
  descriptionVi: string;
  knowledge?: KhmerKnowledge;
}

function isVisionStoryDraft(value: unknown): value is VisionStoryDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    draft.version === 1 &&
    typeof draft.className === 'string' &&
    typeof draft.sourceLabel === 'string' &&
    typeof draft.descriptionVi === 'string' &&
    (draft.knowledge === undefined ||
      (typeof draft.knowledge === 'object' && draft.knowledge !== null)) &&
    draft.descriptionVi.trim().length >= 10 &&
    draft.descriptionVi.length <= MAX_DESCRIPTION_LENGTH
  );
}

export function buildVisionStoryDescription(
  knowledge: KhmerKnowledge,
  className?: string,
): string {
  const keywordLines = knowledge.keywords.map((keyword) => {
    const transliteration = keyword.transliteration?.trim();
    return `- ${keyword.khmer.trim()} — ${keyword.vietnamese.trim()}${
      transliteration ? ` (${transliteration})` : ''
    }`;
  });

  const sections = [
    className && /^[a-z0-9_]+$/.test(className)
      ? `Mã nhận diện Vision: ${className}`
      : '',
    `Chủ đề văn hóa Khmer: ${knowledge.vietnamese.trim()}`,
    `Tên Khmer: ${knowledge.khmer.trim()}`,
    knowledge.transliteration.trim()
      ? `Phiên âm: ${knowledge.transliteration.trim()}`
      : '',
    knowledge.category.trim() ? `Nhóm nội dung: ${knowledge.category.trim()}` : '',
    knowledge.story_seed.trim()
      ? `Gợi ý câu chuyện: ${knowledge.story_seed.trim()}`
      : '',
    keywordLines.length > 0 ? `Từ khóa đã học:\n${keywordLines.join('\n')}` : '',
    knowledge.cultural_explanation.trim()
      ? `Kiến thức văn hóa đã xác minh:\n${knowledge.cultural_explanation.trim()}`
      : '',
  ].filter(Boolean);

  return sections.join('\n\n').slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
}

export function getVisionClassNameFromStoryDescription(description: string): string | null {
  return VISION_CLASS_MARKER_REGEX.exec(description)?.[1] ?? null;
}

export function hasVisionLearningContextInDescription(description: string): boolean {
  return Boolean(
    getVisionClassNameFromStoryDescription(description) ||
      (description.includes('Chủ đề văn hóa Khmer:') && description.includes('Tên Khmer:')),
  );
}

export function saveVisionStoryDraft(className: string, knowledge: KhmerKnowledge): boolean {
  try {
    const draft: VisionStoryDraft = {
      version: 1,
      className,
      sourceLabel: knowledge.vietnamese.trim() || className,
      descriptionVi: buildVisionStoryDescription(knowledge, className),
      knowledge,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadVisionStoryDraft(): VisionStoryDraft | null {
  try {
    const rawDraft = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawDraft) return null;
    const parsed: unknown = JSON.parse(rawDraft);
    if (!isVisionStoryDraft(parsed)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearVisionStoryDraft() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // The form remains usable if browser storage is unavailable.
  }
}
