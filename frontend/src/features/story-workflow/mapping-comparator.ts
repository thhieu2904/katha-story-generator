import type { StoryImageMappingInput, StoryImagesState } from '@/features/story-images/types';

/**
 * Normalize character IDs: deduplicate and sort ascending.
 */
function normalizeIds(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Compare the canonical image state mapping against a local payload.
 *
 * Returns `true` only when:
 *   - every canonical page ID exists in the payload;
 *   - every payload page ID exists in canonical;
 *   - for every page, the normalized (unique + sorted) character IDs are identical.
 *
 * This comparator does NOT infer capability — callers must separately
 * check `can_start`, `status`, etc.
 */
export function exactMappingMatch(
  canonical: Pick<StoryImagesState, 'pages'>,
  payload: StoryImageMappingInput[],
): boolean {
  const canonicalPageIds = new Set(canonical.pages.map((p) => p.id));
  const payloadPageIds = new Set(payload.map((p) => p.page_id));

  // Reject missing or extra pages
  if (canonicalPageIds.size !== payloadPageIds.size) return false;
  for (const id of canonicalPageIds) {
    if (!payloadPageIds.has(id)) return false;
  }

  // Compare character IDs per page
  const canonicalMap = new Map(
    canonical.pages.map((p) => [p.id, normalizeIds(p.character_ids)]),
  );

  for (const entry of payload) {
    const expected = canonicalMap.get(entry.page_id);
    if (!expected) return false;

    const actual = normalizeIds(entry.character_ids);
    if (expected.length !== actual.length) return false;
    if (!expected.every((id, i) => id === actual[i])) return false;
  }

  return true;
}
