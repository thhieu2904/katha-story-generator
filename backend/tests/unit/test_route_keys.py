"""Unit tests for route_keys module (frozen S1 contract & golden vectors)."""

import pytest

from katha.features.stories.route_keys import (
    S1_MAX_STORY_ID,
    decode_story_route_key,
    encode_story_route_key,
)


def test_golden_vectors() -> None:
    """Verify S1 golden vectors specified in plan."""
    assert encode_story_route_key(1) == "s1_UkLWZg9D"
    assert encode_story_route_key(42) == "s1_JgaEBgzn"
    assert encode_story_route_key(1_000_000) == "s1_gMvFoHJd"
    assert encode_story_route_key(2_147_483_647) == "s1_UKrsQ1FL"


def test_roundtrip_decoding() -> None:
    """Test roundtrip encode and decode for various IDs."""
    test_ids = [1, 2, 42, 100, 9999, 1_000_000, 2_147_483_647]
    for sid in test_ids:
        key = encode_story_route_key(sid)
        assert decode_story_route_key(key) == sid


def test_invalid_prefix() -> None:
    """Keys without 's1_' prefix must be rejected."""
    assert decode_story_route_key("UkLWZg9D") is None
    assert decode_story_route_key("s2_UkLWZg9D") is None
    assert decode_story_route_key("s1UkLWZg9D") is None


def test_invalid_length() -> None:
    """Suffix length outside 8..32 must be rejected."""
    # Suffix too short (< 8)
    assert decode_story_route_key("s1_1234567") is None
    # Suffix too long (> 32)
    assert decode_story_route_key("s1_" + "A" * 33) is None


def test_invalid_charset() -> None:
    """Keys with non-alphabet characters must be rejected."""
    assert decode_story_route_key("s1_UkLWZg9D!") is None
    assert decode_story_route_key("s1_UkLWZg9D-") is None
    assert decode_story_route_key("s1_UkLWZg9D_") is None


def test_non_canonical_alias() -> None:
    """Non-canonical encodings must return None."""
    # Alter one character in a valid key so sqids decodes or fails canonical check
    assert decode_story_route_key("s1_UkLWZg9E") is None


def test_out_of_bounds_ids() -> None:
    """Negative, zero, or out-of-range IDs must fail encode and decode."""
    with pytest.raises(ValueError):
        encode_story_route_key(0)

    with pytest.raises(ValueError):
        encode_story_route_key(-1)

    with pytest.raises(ValueError):
        encode_story_route_key(S1_MAX_STORY_ID + 1)
