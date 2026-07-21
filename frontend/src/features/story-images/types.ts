export type StoryImagePageStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface StoryImageProgress {
  total: number;
  pending: number;
  generating: number;
  completed: number;
  failed: number;
}

export interface StoryImageCharacter {
  id: number;
  name: string;
  thumbnail_url: string | null;
}

export interface StoryImagePage {
  id: number;
  page_no: number;
  text_vi: string;
  text_km: string;
  text_en: string | null;
  image_scene_en: string | null;
  image_prompt_en: string | null;
  character_ids: number[];
  image_status: StoryImagePageStatus;
  image_url: string | null;
  image_attempt_count: number;
  image_error_code: string | null;
  updated_at: string | null;
}

export interface StoryImagesState {
  story_id: number;
  title_vi: string | null;
  status: string;
  text_revision: number;
  image_plan_revision: number;
  image_plan_ready: boolean;
  mapping_locked: boolean;
  job_id: string | null;
  job_stale: boolean;
  can_start: boolean;
  can_retry: boolean;
  can_resume: boolean;
  progress: StoryImageProgress;
  available_characters: StoryImageCharacter[];
  pages: StoryImagePage[];
}

export interface StoryImageMappingInput {
  page_id: number;
  character_ids: number[];
}

export interface StartImageGenerationResponse {
  job_id: string;
  already_running: boolean;
  status: string;
  progress: StoryImageProgress;
}

export type ImageGenerationDialogMode = 'start' | 'retry' | 'resume';

export type StoryImagePendingOperation = 'prepare' | 'save_mapping' | 'start' | null;
