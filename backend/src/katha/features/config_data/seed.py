"""Idempotent seed script for config data and default characters.

Usage: python -m katha.features.config_data.seed
Uses lookup-then-insert pattern — no ON CONFLICT, no UNIQUE constraints added.
"""

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from katha.core.config import Settings
from katha.features.characters.models import Character
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

BACKBONES = [
    {
        "name_en": "Fable",
        "name_vi": "Ngụ ngôn",
        "description_vi": "Bài học cuộc sống",
        "prompt_template_en": (
            "Follow the Fable structure: Begin by introducing the main character(s) in a "
            "familiar setting. Present a clear situation or temptation that tests the "
            "character's values. Show the character making a choice — either wise or unwise. "
            "Depict the natural consequence of that choice. End with a simple, memorable moral "
            "lesson stated explicitly. Keep language simple, age-appropriate, and culturally "
            "respectful. Each page should advance the story with one clear event."
        ),
    },
    {
        "name_en": "Three-Act",
        "name_vi": "Ba hồi",
        "description_vi": "Khởi đầu, Thử thách, Kết thúc",
        "prompt_template_en": (
            "Follow the classic Three-Act structure. ACT 1 (Setup — ~25% of pages): Introduce "
            "the main character(s), their world, and their desire or goal. End Act 1 with an "
            "inciting incident that disrupts their normal life. ACT 2 (Confrontation — ~50% of "
            "pages): The character faces escalating challenges and obstacles. Include a midpoint "
            "twist or revelation. Build tension toward a crisis moment. ACT 3 (Resolution — ~25% "
            "of pages): The character faces the biggest challenge, makes a critical decision, and "
            "resolves the conflict. End with emotional satisfaction. Keep language simple and "
            "age-appropriate."
        ),
    },
    {
        "name_en": "Cumulative",
        "name_vi": "Lặp lại",
        "description_vi": "Càng lúc càng nhiều",
        "prompt_template_en": (
            "Follow the Cumulative (chain/repetitive) structure: Start with a simple situation "
            "on page 1. Each subsequent page REPEATS all previous elements AND adds one new "
            "element, character, or event. Use a rhythmic, repetitive phrasing pattern that "
            "children can anticipate and join in. Build up to 4-6 repetitions. End with a climax "
            "where all accumulated elements come together, followed by a satisfying resolution. "
            "This structure is ideal for teaching vocabulary through repetition. Keep each "
            "addition simple and memorable."
        ),
    },
]

GENRES = [
    {
        "name_en": "Fairy Tale",
        "name_vi": "Cổ tích",
        "description_vi": "Giọng kể mơ mộng, thần tiên",
        "prompt_modifier_en": (
            "Write in a fairy tale tone: use dreamy, magical language. Open with a "
            "'Once upon a time...' style beginning. Include elements of wonder and "
            "enchantment. Characters may encounter magical objects or beings. Resolution "
            "should be gentle and hopeful. Use poetic descriptions of nature and settings."
        ),
    },
    {
        "name_en": "Hero",
        "name_vi": "Anh hùng",
        "description_vi": "Giọng kể phiêu lưu, hành động",
        "prompt_modifier_en": (
            "Write in a heroic adventure tone: the protagonist must show courage and "
            "determination. Include a clear quest or mission. Build excitement through "
            "action sequences. The hero should face fear but overcome it through bravery "
            "and cleverness. Celebrate teamwork and perseverance. Use dynamic, energetic "
            "language."
        ),
    },
    {
        "name_en": "Comedy",
        "name_vi": "Hài hước",
        "description_vi": "Giọng kể vui nhộn, nhẹ nhàng",
        "prompt_modifier_en": (
            "Write in a humorous, lighthearted tone: include funny situations, "
            "misunderstandings, or silly mistakes. Use playful language, unexpected twists, "
            "and gentle slapstick moments. Characters should be endearing even when making "
            "errors. Humor should be age-appropriate and kind — never mean-spirited. End "
            "with laughter and joy."
        ),
    },
    {
        "name_en": "Moral",
        "name_vi": "Răn dạy",
        "description_vi": "Giọng kể ấm áp, dạy bảo nhẹ nhàng",
        "prompt_modifier_en": (
            "Write in a warm, instructive tone: the story should teach a clear life lesson "
            "about kindness, honesty, sharing, respect, or responsibility. Show the "
            "consequence of both good and bad choices through the characters' actions. "
            "Avoid being preachy — let the lesson emerge naturally from the story. Include "
            "moments of reflection where characters realize their mistakes. End with a "
            "positive message."
        ),
    },
]

ART_STYLES = [
    {
        "name_en": "Watercolor",
        "name_vi": "Tranh màu nước",
        "prompt_modifier_en": (
            "Soft watercolor illustration style. Gentle pastel colors with occasional "
            "vibrant accents. Hand-painted texture with visible brush strokes and color "
            "bleeding at edges. Dreamy, ethereal atmosphere. Warm natural lighting. White "
            "paper texture showing through in lighter areas. Children's storybook "
            "illustration quality."
        ),
    },
    {
        "name_en": "Flat Illustration",
        "name_vi": "Tranh phẳng",
        "prompt_modifier_en": (
            "Modern flat illustration style. Clean vector-like shapes with bold, solid "
            "colors. Minimal shading, no gradients. Strong outlines. Geometric simplified "
            "forms. Bright, cheerful color palette. Contemporary children's book "
            "illustration. Clear visual hierarchy with distinct foreground and background "
            "layers."
        ),
    },
    {
        "name_en": "3D Cartoon",
        "name_vi": "Hoạt hình 3D",
        "prompt_modifier_en": (
            "3D cartoon render style. Smooth, rounded character forms with soft lighting "
            "and gentle shadows. Pixar/Disney-inspired aesthetic. Rich, saturated colors. "
            "Detailed textures on clothing and environment. Warm ambient lighting. Depth "
            "of field effect. Professional 3D animation quality suitable for children's "
            "content."
        ),
    },
]

CHARACTERS = [
    {
        "name": "Srey",
        "age": 7,
        "personality_vi": "Nhút nhát, tò mò, tốt bụng, dịu dàng",
        "appearance_vi": (
            "Bé gái 7 tuổi, da nâu, mắt nâu to, tóc đen dài tết đuôi sam buộc nơ đỏ, "
            "mặt tròn, mũi nhỏ, cười nhẹ nhàng. Mặc sampot Khmer xanh dương có hoa văn "
            "kim cương vàng, áo blouse trắng tay phồng. Đi chân đất, tay phải luôn cầm "
            "búp bê gỗ nhỏ."
        ),
        "appearance_prompt_en": "7-year-old Cambodian girl, 110cm tall, medium brown skin, large dark brown eyes with long eyelashes, black hair in a long braid reaching her mid-back with a red ribbon tied at the end, round face, small nose, gentle shy smile, wearing a blue traditional Khmer sampot with subtle gold diamond pattern reaching her ankles, white cotton blouse with short puffed sleeves and small buttons, bare feet, always carries a small handmade wooden doll in her right hand",  # noqa: E501
    },
    {
        "name": "Dara",
        "age": 10,
        "personality_vi": "Tự tin, thích phiêu lưu, hay bảo vệ em, nghịch ngợm",
        "appearance_vi": (
            "Bé trai 10 tuổi, da nâu, tóc đen ngắn dựng đứng, mắt nâu sáng, cười tươi "
            "lộ răng, dáng khoẻ mạnh. Mặc áo henley trắng có nút gỗ, quần short nâu sẫm "
            "ngang gối với dây thắt lưng thừng bện. Đi chân đất, túi sau phải nhét ná thun "
            "tre."
        ),
        "appearance_prompt_en": "10-year-old Cambodian boy, 130cm tall, medium brown skin, short messy black hair sticking up slightly, bright dark brown eyes, wide confident smile showing teeth, athletic build for his age, round ears, wearing a simple white short-sleeve henley shirt with two wooden buttons, dark brown knee-length cotton shorts with a thin braided rope belt, bare feet, has a small handmade bamboo slingshot tucked in his back right pocket",  # noqa: E501
    },
    {
        "name": "Yeay",
        "age": 65,
        "personality_vi": "Thông thái, kiên nhẫn, ấm áp, hay kể chuyện",
        "appearance_vi": (
            "Bà 65 tuổi, da nâu sẫm ấm, nếp nhăn quanh mắt và miệng, tóc bạc búi thấp "
            "gọn gàng, mắt hiền có nếp chân chim. Hơi còng lưng. Mặc sampot Khmer đỏ sẫm "
            "viền vàng, áo blouse cotton kem dài tay, đeo dây chuyền vàng mỏng mặt Phật. "
            "Tay phải chống gậy gỗ chạm khắc."
        ),
        "appearance_prompt_en": "65-year-old Cambodian grandmother, 150cm tall, warm dark brown skin with gentle wrinkles around eyes and mouth, silver-gray hair pulled back in a neat low bun at the nape of her neck, kind small eyes with crow's feet wrinkles, soft warm smile, slightly hunched posture with rounded shoulders, wearing a traditional dark red Khmer sampot with gold border pattern reaching her ankles, a loose cream-colored long-sleeve cotton blouse, a thin gold chain necklace with a small Buddha pendant, holds a carved wooden walking stick with a curved handle in her right hand",  # noqa: E501
    },
    {
        "name": "Mae",
        "age": 35,
        "personality_vi": "Chu đáo, chăm chỉ, yêu thương, thực tế",
        "appearance_vi": (
            "Phụ nữ 35 tuổi, da nâu mịn, tóc đen dài thẳng buộc đuôi ngựa thấp bằng dây "
            "vải xanh đậm, mắt hạnh nhân nâu sẫm, cười ấm áp. Mặc sampot Khmer xanh lá "
            "đậm viền chỉ bạc, áo blouse vàng nhạt tay ngắn cổ tròn, đeo bông tai vàng "
            "nhỏ, xỏ dép nâu. Tay trái ôm rổ mây tròn bên hông."
        ),
        "appearance_prompt_en": "35-year-old Cambodian mother, 158cm tall, medium brown skin, smooth and healthy complexion, long straight black hair tied back in a low ponytail with a dark blue fabric hair tie, almond-shaped dark brown eyes, warm caring smile, oval face, wearing a deep green traditional Khmer sampot with silver thread pattern at the hem, a light yellow short-sleeve cotton blouse with a modest round neckline, small gold stud earrings, brown sandals, carries a round woven rattan basket held against her left hip",  # noqa: E501
    },
    {
        "name": "Bopha",
        "age": 6,
        "personality_vi": "Vui vẻ, năng động, hay nói, hay cười khúc khích",
        "appearance_vi": (
            "Bé gái 6 tuổi, da nâu sáng hơn Srey một chút, tóc đen cắt bob ngang với mái "
            "thẳng trên lông mày, mắt tròn to nâu sẫm, cười rất tươi có lúm đồng tiền, "
            "má phính, mũi nhỏ tròn. Mặc váy hồng tươi in hoa trắng nhỏ dài ngang gối, "
            "xỏ dép da nâu. Đầu đội vòng hoa nhài trắng nhỏ."
        ),
        "appearance_prompt_en": "6-year-old Cambodian girl, 105cm tall, light brown skin slightly lighter than Srey, short black bob haircut with straight bangs cut above her eyebrows, big round dark brown eyes, very wide cheerful smile with dimples, chubby round cheeks, small button nose, wearing a bright pink short-sleeve cotton dress with small white flower print reaching her knees, brown leather sandals, wears a small crown of white jasmine flowers on top of her head",  # noqa: E501
    },
    {
        "name": "Lok Kru",
        "age": 45,
        "personality_vi": "Kiên nhẫn, hiểu biết, hay khuyến khích, uy nghiêm nhưng ấm áp",
        "appearance_vi": (
            "Thầy giáo 45 tuổi, da nâu sẫm, tóc đen ngắn gọn có vài sợi bạc hai bên "
            "thái dương, mắt hiền đeo kính tròn gọng dây, cười nhẹ kiên nhẫn, ria mép "
            "mỏng tỉa gọn, dáng gầy đứng thẳng. Mặc áo sơ mi xanh nhạt tay ngắn bỏ "
            "trong quần tây xanh đậm, thắt lưng đen đơn giản, giày da nâu, đeo đồng hồ "
            "điện tử đen tay trái. Tay trái cầm sách bìa cứng xanh đậm dày."
        ),
        "appearance_prompt_en": "45-year-old Cambodian male teacher, 170cm tall, dark brown skin, short neat black hair with some gray at the temples, kind eyes behind small round wire-frame glasses, gentle patient smile, thin mustache neatly trimmed, lean build, upright posture, wearing a light blue short-sleeve button-up shirt tucked into dark navy trousers with a simple black belt, dark brown leather shoes, a black digital watch on his left wrist, holds a thick hardcover book with a dark green cover in his left hand",  # noqa: E501
    },
    {
        "name": "Meas",
        "age": 2,
        "personality_vi": "Tò mò, hay chơi đùa, tinh nghịch, thích được vuốt ve",
        "appearance_vi": (
            "Mèo nhà trưởng thành còn trẻ, nhỏ đến trung bình, lông vàng cam sọc hổ cam "
            "đậm trên lưng và đuôi, ngực trắng và chân trắng, mắt vàng xanh sáng, mũi "
            "hồng nhỏ, đuôi dài bông thường cong lên. Tai tròn nhỏ ruột hồng nhạt, thân "
            "hơi mập. Đeo vòng cổ vải đỏ nhỏ gắn chuông đồng tròn."
        ),
        "appearance_prompt_en": "Young adult domestic cat, small to medium size, golden-orange tabby fur with darker orange tiger stripes on the back and tail, white chest patch and white paws, bright yellow-green eyes, small pink nose, long fluffy tail often curled upward, small rounded ears with light pink inside, slightly chubby body, friendly curious expression, wears a small red fabric collar with a tiny round brass bell attached",  # noqa: E501
    },
]


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------


async def _lookup_then_insert(session: AsyncSession, model, data: list[dict], key: str) -> int:
    """Insert records that don't already exist (lookup by key field). Return count inserted."""
    inserted = 0
    for record in data:
        result = await session.execute(select(model).where(getattr(model, key) == record[key]))
        existing = result.scalars().first()
        if existing is None:
            session.add(model(**record))
            inserted += 1
    return inserted


async def run_seed(database_url: str | None = None) -> dict[str, int]:
    """Run the idempotent seed. Returns counts of inserted records per table."""
    if database_url is None:
        settings = Settings()
        database_url = settings.DATABASE_URL

    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        async with session.begin():
            bb_count = await _lookup_then_insert(session, StoryBackbone, BACKBONES, "name_en")
            genre_count = await _lookup_then_insert(session, StoryGenre, GENRES, "name_en")
            art_count = await _lookup_then_insert(session, ArtStyle, ART_STYLES, "name_en")
            char_count = await _lookup_then_insert(session, Character, CHARACTERS, "name")

    await engine.dispose()

    return {
        "backbones": bb_count,
        "genres": genre_count,
        "art_styles": art_count,
        "characters": char_count,
    }


async def main():
    """Entry point for CLI invocation."""
    logging.basicConfig(level=logging.INFO)
    counts = await run_seed()
    print(
        f"Seed complete: {counts['backbones']} backbones, "
        f"{counts['genres']} genres, {counts['art_styles']} art_styles, "
        f"{counts['characters']} characters inserted"
    )


if __name__ == "__main__":
    asyncio.run(main())
