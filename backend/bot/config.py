import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

BOT_TOKEN = os.getenv('BOT_TOKEN', '').strip()
OCR_BACKEND = os.getenv('OCR_BACKEND', 'stub').lower()
TESSERACT_CMD = os.getenv('TESSERACT_CMD', '').strip()
TESSERACT_LANG = os.getenv('TESSERACT_LANG', 'rus+eng').strip()
