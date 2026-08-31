import { beforeEach, describe, expect, it } from 'vitest';
import type { KhmerKnowledge } from '@/features/vision/api';
import {
  buildVisionStoryDescription,
  clearVisionStoryDraft,
  loadVisionStoryDraft,
  saveVisionStoryDraft,
} from './visionStoryDraft';

const knowledge: KhmerKnowledge = {
  khmer: 'បុណ្យអកអំបុក',
  vietnamese: 'Lễ hội Ok Om Bok',
  transliteration: 'bon Ok Om Bok',
  category: 'Lễ hội',
  cultural_explanation: 'Lễ cúng Trăng của người Khmer Nam Bộ.',
  story_seed: 'Hai bạn nhỏ cùng chuẩn bị cốm dẹp cho lễ hội.',
  verified: true,
  sources: [],
  keywords: [
    { khmer: 'បុណ្យ', vietnamese: 'Lễ hội', transliteration: 'bon' },
    { khmer: 'អកអំបុក', vietnamese: 'Ok Om Bok', transliteration: null },
  ],
};

describe('visionStoryDraft', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('builds story content only from the verified knowledge fields', () => {
    const description = buildVisionStoryDescription(knowledge);

    expect(description).toContain('Chủ đề văn hóa Khmer: Lễ hội Ok Om Bok');
    expect(description).toContain('Gợi ý câu chuyện: Hai bạn nhỏ');
    expect(description).toContain('បុណ្យ — Lễ hội (bon)');
    expect(description).toContain('Kiến thức văn hóa đã xác minh');
    expect(description.length).toBeLessThanOrEqual(2000);
  });

  it('stores and clears the handoff for the existing story creator', () => {
    expect(saveVisionStoryDraft('ok_om_bok', knowledge)).toBe(true);
    expect(loadVisionStoryDraft()).toMatchObject({
      className: 'ok_om_bok',
      sourceLabel: 'Lễ hội Ok Om Bok',
      knowledge: { vietnamese: 'Lễ hội Ok Om Bok' },
    });

    clearVisionStoryDraft();
    expect(loadVisionStoryDraft()).toBeNull();
  });
});
