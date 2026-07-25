const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class PublicApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'PublicApiError';
  }
}

export async function publicFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new PublicApiError(
      response.status === 404 ? 'Story not found' : 'Failed to load story',
      response.status,
    );
  }
  return (await response.json()) as T;
}
