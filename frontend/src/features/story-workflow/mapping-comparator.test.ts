import { describe, expect, it } from 'vitest';
import { exactMappingMatch } from './mapping-comparator';
import type { StoryImagesState } from '@/features/story-images/types';
import type { StoryImageMappingInput } from '@/features/story-images/types';

function makePage(id: number, characterIds: number[]) {
  return {
    id,
    page_no: id,
    text_vi: '',
    text_km: '',
    text_en: null,
    image_scene_en: null,
    image_prompt_en: null,
    character_ids: characterIds,
    image_status: 'pending' as const,
    image_url: null,
    image_attempt_count: 0,
    image_error_code: null,
    updated_at: null,
  };
}

function makeCanonical(pages: { id: number; character_ids: number[] }[]): Pick<StoryImagesState, 'pages'> {
  return { pages: pages.map((p) => makePage(p.id, p.character_ids)) };
}

function makePayload(entries: { page_id: number; character_ids: number[] }[]): StoryImageMappingInput[] {
  return entries;
}

describe('exactMappingMatch', () => {
  it('returns true for exact match', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [10, 20] },
      { id: 2, character_ids: [30] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [10, 20] },
      { page_id: 2, character_ids: [30] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(true);
  });

  it('returns true when IDs are unsorted but equivalent', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [20, 10] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [10, 20] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(true);
  });

  it('returns true when IDs have duplicates but equivalent after normalize', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [10, 10, 20] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [20, 10, 10] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(true);
  });

  it('returns false for missing page in payload', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [10] },
      { id: 2, character_ids: [20] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [10] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(false);
  });

  it('returns false for extra page in payload', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [10] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [10] },
      { page_id: 99, character_ids: [20] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(false);
  });

  it('returns false for different character IDs', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [10, 20] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [10, 30] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(false);
  });

  it('returns false for different character count', () => {
    const canonical = makeCanonical([
      { id: 1, character_ids: [10, 20] },
    ]);
    const payload = makePayload([
      { page_id: 1, character_ids: [10] },
    ]);
    expect(exactMappingMatch(canonical, payload)).toBe(false);
  });

  it('returns true for empty pages on both sides', () => {
    const canonical = makeCanonical([]);
    const payload = makePayload([]);
    expect(exactMappingMatch(canonical, payload)).toBe(true);
  });
});
