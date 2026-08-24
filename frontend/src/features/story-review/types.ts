export interface ReviewPageData {
  id: number;
  page_no: number;
  text_km: string;
  text_vi: string;
  spellcheck_flags: Record<string, unknown>[];
  khmer_validated_at: string | null;
  image_url: string | null;
  image_status: string;
  image_attempt_count: number;
  image_error_code: string | null;
  audio_status?: 'pending' | 'generating' | 'completed' | 'failed';
  audio_url?: string | null;
  audio_text_revision?: number | null;
  audio_error_code?: string | null;
  review_status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  reviewed_at: string | null;
  can_approve: boolean;
  can_reject: boolean;
  can_regenerate: boolean;
}

export interface ReviewProgress {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface ReviewJob {
  kind: 'review_regeneration' | null;
  active_page_id: number | null;
  is_running: boolean;
  is_stale: boolean;
  can_resume: boolean;
}

export interface ReviewShare {
  active: boolean;
  revision: number;
  token: string | null;
  path: string | null;
  activated_at: string | null;
  revoked_at: string | null;
}

export interface ReviewCapabilities {
  can_edit_khmer: boolean;
  can_review_pages: boolean;
  can_complete_review: boolean;
  can_publish: boolean;
  can_create_share_link: boolean;
  can_revoke_share_link: boolean;
  can_archive: boolean;
  read_only: boolean;
}

export interface ReviewStory {
  id: number;
  title_vi: string | null;
  title_km: string | null;
  status: string;
  text_revision: number;
  target_age: string | null;
  genre: { id: number; name_vi: string; name_en: string } | null;
  published_at: string | null;
}

export interface ReviewState {
  story: ReviewStory;
  progress: ReviewProgress;
  job: ReviewJob;
  share: ReviewShare;
  capabilities: ReviewCapabilities;
  pages: ReviewPageData[];
}
