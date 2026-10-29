"""
LIRA ESP32 ILI9341 1-Bit Monochrome Glyph Renderer
Requirement 7:
Renders text into 1-bit monochrome bitmap:
Width = 312 px (39 bytes per row, exact multiple of 8)
Height = 32 px
Bytes = 39 * 32 = 1248 bytes
Mode = "1" .tobytes() (MSB = leftmost pixel, 1 = ink)
Font = Nirmala.ttc or Noto Sans Devanagari
Caches results by (text, lang)
"""

import os
from typing import Dict, Tuple
from PIL import Image, ImageDraw, ImageFont

_GLYPH_CACHE: Dict[Tuple[str, str], bytes] = {}

def get_glyph_font(font_size: int = 20) -> ImageFont.ImageFont:
    candidate_paths = [
        "C:\\Windows\\Fonts\\Nirmala.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, font_size)
            except Exception:
                pass
    return ImageFont.load_default()


def render_glyph_1bit(
    text: str,
    lang: str = "hi",
    width: int = 312,
    height: int = 32
) -> bytes:
    """
    Renders text onto a 1-bit monochrome bitmap of exact dimensions (width x height).
    Returns packed MSB-first bytes of length (width // 8) * height.
    """
    cache_key = (text, lang)
    if cache_key in _GLYPH_CACHE:
        return _GLYPH_CACHE[cache_key]

    font = get_glyph_font(font_size=20)
    img = Image.new("1", (width, height), 0)
    draw = ImageDraw.Draw(img)

    # Center vertically and offset slightly from left
    bbox = draw.textbbox((0, 0), text, font=font)
    text_h = bbox[3] - bbox[1]
    y_offset = max(2, (height - text_h) // 2 - 2)

    draw.text((6, y_offset), text, font=font, fill=1)

    raw_bytes = img.tobytes()
    _GLYPH_CACHE[cache_key] = raw_bytes
    return raw_bytes

