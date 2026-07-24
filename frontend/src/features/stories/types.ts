export type StoryRouteKey = string & { readonly __brand: 'StoryRouteKey' };

export interface Story {
  id: number;
  route_key: StoryRouteKey;
  title_vi: string | null;
  title_km: string | null;
  description_vi: string;
  backbone_id: number | null;
  genre_id: number | null;
  art_style_id: number | null;
  target_age: string | null;
  length_pref: string | null;
  status: string;
  text_revision: number;
  cover_image_url: string | null;
  created_by: string | null;
  character_ids: number[];
  created_at: string | null;
  updated_at: string | null;
}

export interface StoryListItem {
  id: number;
  route_key: StoryRouteKey;
  title_vi: string | null;
  title_km: string | null;
  description_vi: string;
  target_age: string | null;
  length_pref: string | null;
  status: string;
  text_revision: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoryCreate {
  description_vi: string;
  backbone_id: number;
  genre_id: number;
  art_style_id: number;
  target_age: string;
  length_pref: string;
  character_ids: number[];
}

export type StoryUpdate = Partial<StoryCreate>;

// Config types for the setup form options
export interface Backbone {
  id: number;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
}

export interface Genre {
  id: number;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
}

export interface ArtStyle {
  id: number;
  name_vi: string;
  name_en: string;
  sample_image_url: string | null;
}

export interface StoryTextPage {
  id: number;
  page_no: number;
  text_vi: string;
  text_km: string;
  spellcheck_flags: Record<string, unknown>[];
  khmer_validated_at: string | null;
}

export interface StoryText {
  id: number;
  title_vi: string;
  title_km: string;
  description_vi: string;
  target_age: string;
  length_pref: string;
  status: string;
  text_revision: number;
  character_ids: number[];
  updated_at: string | null;
  pages: StoryTextPage[];
}
