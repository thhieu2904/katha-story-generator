export interface Story {
  id: number;
  title_vi: string | null;
  title_km: string | null;
  description_vi: string;
  backbone_id: number | null;
  genre_id: number | null;
  art_style_id: number | null;
  target_age: string | null;
  length_pref: string | null;
  status: string;
  cover_image_url: string | null;
  created_by: string | null;
  character_ids: number[];
  created_at: string | null;
  updated_at: string | null;
}

export interface StoryListItem {
  id: number;
  title_vi: string | null;
  title_km: string | null;
  description_vi: string;
  target_age: string | null;
  length_pref: string | null;
  status: string;
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
