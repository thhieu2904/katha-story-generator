import { describe, expect, it } from 'vitest';
import { areStorySetupFieldsEqual } from './page';
import type { Story, StoryCreate } from '@/features/stories/types';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 1,
    title_vi: 'Truyện test',
    title_km: null,
    description_vi: ' Mô tả truyện test ',
    backbone_id: 10,
    genre_id: 20,
    art_style_id: 30,
    target_age: 'age_3_5',
    length_pref: 'short',
    status: 'text_draft',
    text_revision: 1,
    cover_image_url: null,
    created_by: null,
    character_ids: [1, 2, 2], // with duplicate
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function makeForm(overrides: Partial<StoryCreate> = {}): StoryCreate {
  return {
    description_vi: 'Mô tả truyện test', // trimmed matches
    backbone_id: 10,
    genre_id: 20,
    art_style_id: 30,
    target_age: 'age_3_5',
    length_pref: 'short',
    character_ids: [2, 1], // different order & duplicates
    ...overrides,
  };
}

describe('areStorySetupFieldsEqual (7-field comparator)', () => {
  it('returns true when all 7 fields match (with whitespace trimming & character_ids sorting/dedup)', () => {
    const s = makeStory();
    const f = makeForm();
    expect(areStorySetupFieldsEqual(s, f)).toBe(true);
  });

  it('returns false when description_vi differs', () => {
    const s = makeStory();
    const f = makeForm({ description_vi: 'Mô tả khác' });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });

  it('returns false when backbone_id differs', () => {
    const s = makeStory();
    const f = makeForm({ backbone_id: 99 });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });

  it('returns false when genre_id differs', () => {
    const s = makeStory();
    const f = makeForm({ genre_id: 99 });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });

  it('returns false when art_style_id differs', () => {
    const s = makeStory();
    const f = makeForm({ art_style_id: 99 });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });

  it('returns false when target_age differs', () => {
    const s = makeStory();
    const f = makeForm({ target_age: 'preschool' });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });

  it('returns false when length_pref differs', () => {
    const s = makeStory();
    const f = makeForm({ length_pref: 'long' });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });

  it('returns false when character_ids differ', () => {
    const s = makeStory();
    const f = makeForm({ character_ids: [1, 3] });
    expect(areStorySetupFieldsEqual(s, f)).toBe(false);
  });
});
