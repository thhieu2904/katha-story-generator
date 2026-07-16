"""Import all models so Alembic autogenerate can discover them."""

from katha.features.characters.models import Character  # noqa: F401
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre  # noqa: F401
from katha.features.stories.models import Story, StoryCharacter, StoryPage  # noqa: F401
