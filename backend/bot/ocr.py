"""OCR adapter for fuel-station daily reports.

Pluggable: StubOCR returns a deterministic placeholder so the whole flow
(bot → preview → confirm → DB) can be exercised without any external service.
TesseractOCR is enabled when OCR_BACKEND=tesseract and pytesseract is installed.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Protocol

from . import config


@dataclass
class ParsedItem:
    fuel_name: str
    sold: Decimal = Decimal('0')
    revenue: Decimal = Decimal('0')
    remainder: Decimal = Decimal('0')


@dataclass
class OCRResult:
    items: list[ParsedItem] = field(default_factory=list)
    raw_text: str = ''


class OCRBackend(Protocol):
    async def parse(self, image_path: Path) -> OCRResult: ...


class StubOCR:
    """Deterministic stub used in dev. Returns a 4-fuel skeleton with zeros
    so the operator can fill values via the edit flow."""

    async def parse(self, image_path: Path) -> OCRResult:
        return OCRResult(
            items=[
                ParsedItem(fuel_name='Бензин', sold=Decimal('300'), revenue=Decimal('3000'), remainder=Decimal('0')),
                ParsedItem(fuel_name='Солярка', sold=Decimal('450'), revenue=Decimal('4500'), remainder=Decimal('0')),
                ParsedItem(fuel_name='Газ', sold=Decimal('0'), revenue=Decimal('0'), remainder=Decimal('0')),
                ParsedItem(fuel_name='Масло', sold=Decimal('0'), revenue=Decimal('0'), remainder=Decimal('0')),
            ],
            raw_text='[stub OCR — install Tesseract and set OCR_BACKEND=tesseract for real parsing]',
        )


class TesseractOCR:
    """Naive Tesseract-based extractor. Looks for lines like
    «Бензин 300 3000» (fuel_name + sold + revenue [+ remainder]).
    Returns whatever it can find; missing fuels are added with zeros."""

    FUEL_ALIASES = {
        'Бензин': ('бензин', 'аи', 'gasoline', 'petrol'),
        'Солярка': ('солярка', 'дизель', 'дт', 'diesel'),
        'Газ': ('газ', 'gas', 'lpg'),
        'Масло': ('масло', 'oil'),
    }

    def __init__(self) -> None:
        try:
            import pytesseract  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                'OCR_BACKEND=tesseract requires `pip install pytesseract` and the Tesseract binary.',
            ) from exc
        if config.TESSERACT_CMD:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD

    async def parse(self, image_path: Path) -> OCRResult:
        import pytesseract
        from PIL import Image

        text = pytesseract.image_to_string(Image.open(image_path), lang=config.TESSERACT_LANG)
        items = self._extract(text)
        return OCRResult(items=items, raw_text=text)

    def _extract(self, text: str) -> list[ParsedItem]:
        found: dict[str, ParsedItem] = {}
        for line in text.splitlines():
            low = line.lower()
            for canonical, aliases in self.FUEL_ALIASES.items():
                if any(a in low for a in aliases):
                    nums = [Decimal(n.replace(',', '.')) for n in re.findall(r'\d+(?:[.,]\d+)?', line)]
                    if not nums:
                        continue
                    item = ParsedItem(fuel_name=canonical)
                    if len(nums) >= 1:
                        item.sold = nums[0]
                    if len(nums) >= 2:
                        item.revenue = nums[1]
                    if len(nums) >= 3:
                        item.remainder = nums[2]
                    found[canonical] = item
                    break
        for canonical in self.FUEL_ALIASES:
            found.setdefault(canonical, ParsedItem(fuel_name=canonical))
        return list(found.values())


def get_backend() -> OCRBackend:
    if config.OCR_BACKEND == 'tesseract':
        return TesseractOCR()
    return StubOCR()
