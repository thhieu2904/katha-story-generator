export interface SpeakingSentence {
  id: string;
  category?: string;
  category_label_vi?: string;
  khmer: string;
  vietnamese: string;
  transliteration: string;
  level: number | string;
  required_terms?: string[];
  note_vi?: string | null;
}

export interface SpeakingAttemptResult {
  transcript: string;
  /** Recognition confidence is returned on the API's 0-100 scale when available. */
  confidence: number | null;
  score: number;
  character_accuracy: number;
  required_term_coverage: number;
  feedback_vi: string;
  matched_segments: string[];
  missing_segments: string[];
  passed?: boolean;
  session_id?: string;
}

export interface CompletedSpeakingAttempt {
  sentence: SpeakingSentence;
  result: SpeakingAttemptResult;
}

export interface SpeakingSessionProgress {
  id: string;
  story_id: number | null;
  status: string;
  selected_sentence_ids: string[];
  attempted_sentence_ids: string[];
  passed_sentence_ids: string[];
  attempted_count: number;
  passed_count: number;
  target_count: number;
  completed: boolean;
  /** Immutable sentence snapshot selected for this session/catalog version. */
  sentences: SpeakingSentence[];
}
