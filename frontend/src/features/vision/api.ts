import { ApiError, apiFetch } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const KEYWORD_AUDIO_TIMEOUT_MS = 180_000;

export interface KnowledgeSource {
  publisher: string;
  title: string;
  url: string;
}

export interface KhmerKeyword {
  khmer: string;
  vietnamese: string;
  transliteration: string | null;
}

export interface KhmerKnowledge {
  khmer: string;
  vietnamese: string;
  transliteration: string;
  category: string;
  cultural_explanation: string;
  story_seed: string;
  keywords: KhmerKeyword[];
  verified: boolean;
  sources: KnowledgeSource[];
}

export interface VisionResult {
  class: string;
  predicted_class: string;
  confidence: number;
  knowledge: KhmerKnowledge | null;
}

type VisionResultPayload = Omit<VisionResult, 'knowledge'> & {
  knowledge: (Omit<KhmerKnowledge, 'keywords'> & { keywords?: KhmerKeyword[] }) | null;
};

export async function classifyImage(file: File): Promise<VisionResult> {
  const formData = new FormData();
  formData.append('image', file);

  const result = await apiFetch<VisionResultPayload>('/api/vision/classify', {
    method: 'POST',
    body: formData,
    timeoutMs: 60_000,
  });

  return {
    ...result,
    knowledge: result.knowledge
      ? { ...result.knowledge, keywords: result.knowledge.keywords ?? [] }
      : null,
  };
}

export async function fetchKeywordAudio(
  className: string,
  keywordNo: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const timeoutSignal = AbortSignal.timeout(KEYWORD_AUDIO_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/vision/classes/${encodeURIComponent(className)}/keywords/${keywordNo}/audio`,
      {
        headers: { Accept: 'audio/wav' },
        signal: requestSignal,
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('Không thể chuẩn bị giọng đọc từ khóa.', 0);
  }

  if (!response.ok) {
    let detail = 'Không thể chuẩn bị giọng đọc từ khóa.';
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // Keep the safe Vietnamese fallback for a non-JSON proxy response.
    }
    throw new ApiError(detail, response.status);
  }

  const audio = await response.blob();
  if (audio.size === 0) {
    throw new ApiError('Máy chủ trả về tệp giọng đọc trống.', 0);
  }
  return audio;
}
