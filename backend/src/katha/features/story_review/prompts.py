"""Effective prompt builder for single-page image regeneration.

Constructs a composite prompt from the original immutable image prompt and
the reviewer's rejection reason, with a hard character-count cap enforced
*before* any provider call.
"""

IMAGE_PROMPT_MAX_CHARS = 8_000

_REVIEW_FEEDBACK_DELIMITER = "\n\n[REVIEW FEEDBACK FOR THIS REPLACEMENT]\n"

_REVIEW_FEEDBACK_SUFFIX = (
    "\n\n"
    "Keep the locked characters, visual identity, art style and story scene.\n"
    "Address only the review feedback where compatible with those constraints."
)


class EffectivePromptTooLongError(Exception):
    """Raised when the composite prompt exceeds IMAGE_PROMPT_MAX_CHARS."""

    def __init__(self, total_chars: int) -> None:
        self.total_chars = total_chars
        super().__init__(
            f"Effective prompt ({total_chars:,} chars) exceeds limit "
            f"({IMAGE_PROMPT_MAX_CHARS:,} chars). "
            f"The base image prompt or rejection reason must be shortened."
        )


def build_effective_prompt(base_prompt: str, rejection_reason: str) -> str:
    """Build composite prompt for image regeneration.

    The builder preserves *both* the base prompt and the rejection reason
    in their entirety — it never silently truncates either.  If the total
    exceeds IMAGE_PROMPT_MAX_CHARS, it raises EffectivePromptTooLongError
    so the endpoint can return 422 before scheduling the provider call.

    Args:
        base_prompt: The original ``image_prompt_en`` from the story page.
            Must be non-empty after stripping.
        rejection_reason: The reviewer's feedback.  Must be non-empty after
            stripping and ≤ 500 chars (validated by the caller / schema).

    Returns:
        The composite prompt string, guaranteed ≤ IMAGE_PROMPT_MAX_CHARS.

    Raises:
        EffectivePromptTooLongError: if the composite exceeds the limit.
        ValueError: if base_prompt or rejection_reason is blank.
    """
    base = base_prompt.strip()
    reason = rejection_reason.strip()

    if not base:
        raise ValueError("base_prompt must not be blank")
    if not reason:
        raise ValueError("rejection_reason must not be blank")

    effective = base + _REVIEW_FEEDBACK_DELIMITER + reason + _REVIEW_FEEDBACK_SUFFIX

    if len(effective) > IMAGE_PROMPT_MAX_CHARS:
        raise EffectivePromptTooLongError(len(effective))

    return effective
