"""Opaque story route key encoder/decoder using frozen Sqids S1 contract."""

from sqids import Sqids

S1_PREFIX = "s1_"
S1_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
S1_MIN_LENGTH = 8
S1_BLOCKLIST: tuple[str, ...] = ()
S1_MAX_ENCODED_INPUT_LENGTH = 32
S1_MIN_STORY_ID = 1
S1_MAX_STORY_ID = 2_147_483_647

_sqids = Sqids(
    alphabet=S1_ALPHABET,
    min_length=S1_MIN_LENGTH,
    blocklist=list(S1_BLOCKLIST),
)


def encode_story_route_key(story_id: int) -> str:
    """Encode an internal integer story_id into a versioned opaque route key string."""
    if not (S1_MIN_STORY_ID <= story_id <= S1_MAX_STORY_ID):
        raise ValueError(f"story_id must be between {S1_MIN_STORY_ID} and {S1_MAX_STORY_ID}")

    suffix = _sqids.encode([story_id])
    return f"{S1_PREFIX}{suffix}"


def decode_story_route_key(route_key: str | None) -> int | None:
    """Decode a route key string into an internal integer story_id.

    Returns None if the route key is malformed, non-canonical, or out of range.
    """
    if not route_key or not isinstance(route_key, str):
        return None

    if not route_key.startswith(S1_PREFIX):
        return None

    suffix = route_key[len(S1_PREFIX) :]
    if not (S1_MIN_LENGTH <= len(suffix) <= S1_MAX_ENCODED_INPUT_LENGTH):
        return None

    # Check all chars in alphabet
    if any(ch not in S1_ALPHABET for ch in suffix):
        return None

    decoded = _sqids.decode(suffix)
    if len(decoded) != 1:
        return None

    story_id = decoded[0]
    if not (S1_MIN_STORY_ID <= story_id <= S1_MAX_STORY_ID):
        return None

    # Canonical re-encode check
    if encode_story_route_key(story_id) != route_key:
        return None

    return story_id
