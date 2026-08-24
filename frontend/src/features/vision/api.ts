import { apiFetch } from '@/lib/api';

export interface KnowledgeSource {
  publisher: string;
  title: string;
  url: string;
}

export interface KhmerKnowledge {
  khmer: string;
  vietnamese: string;
  transliteration: string;
  category: string;
  cultural_explanation: string;
  story_seed: string;
  verified: boolean;
  sources: KnowledgeSource[];
}

export interface VisionResult {
  class: string;
  predicted_class: string;
  confidence: number;
  knowledge: KhmerKnowledge | null;
}

export function classifyImage(file: File): Promise<VisionResult> {
  const formData = new FormData();
  formData.append('image', file);

  return apiFetch<VisionResult>('/api/vision/classify', {
    method: 'POST',
    body: formData,
    timeoutMs: 60_000,
  });
}
