import type { KhmerKnowledge } from '@/features/vision/api';

export interface PublicPage {
  page_no: number;
  text_km: string;
  text_vi: string;
  image_url: string | null;
}

export interface PublicCover {
  background_url: string | null;
}

export interface PublicStory {
  title_km: string | null;
  title_vi: string | null;
  target_age: string | null;
  page_count: number;
  cover: PublicCover;
  pages: PublicPage[];
  learning_context?: {
    class_name: string;
    knowledge: KhmerKnowledge;
  } | null;
}

export type ReaderLanguage = 'km' | 'vi';
