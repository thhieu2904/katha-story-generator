import type { StoryText } from '@/features/stories/types';

export type QuickAction = 'shorten' | 'lengthen' | 'more_dramatic' | 'simplify';
export type PendingOperation =
  | 'validate'
  | 'edit'
  | 'add'
  | 'reorder'
  | 'delete'
  | 'retranslate'
  | 'confirm';

export interface ChangeSummary {
  has_changes: boolean;
  title_changed: boolean;
  edited_page_ids: number[];
  added_page_ids: number[];
  deleted_page_ids: number[];
  order_changed: boolean;
  before_count: number;
  after_count: number;
}

export interface MutationResponse {
  story: StoryText;
  changes: ChangeSummary;
}