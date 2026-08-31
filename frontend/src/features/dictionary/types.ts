export interface DictionaryEntry {
  id: number;
  khmer: string;
  vietnamese: string;
  transliteration: string | null;
  transliteration_reviewed: boolean;
  page: number | null;
  quality: string | null;
}

export interface DictionarySearchResponse {
  source: string;
  query: string;
  items: DictionaryEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
