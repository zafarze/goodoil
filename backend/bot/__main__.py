"""Run with: python -m bot  (from backend/, with venv active)."""
from __future__ import annotations

import asyncio
import os
import sys

import django


def _bootstrap_django() -> None:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()


_bootstrap_django()


async def main() -> None:
    from aiogram import Bot, Dispatcher
    from aiogram.client.default import DefaultBotProperties
    from aiogram.fsm.storage.memory import MemoryStorage

    from . import config
    from .auth import AuthMiddleware
    from .handlers import register

    if not config.BOT_TOKEN:
        print('ERROR: BOT_TOKEN is empty. Fill backend/.env (see .env.example).', file=sys.stderr)
        sys.exit(1)

    bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode='HTML'))
    dp = Dispatcher(storage=MemoryStorage())

    dp.message.middleware(AuthMiddleware())
    dp.callback_query.middleware(AuthMiddleware())

    register(dp)

    print(f'[bot] OCR backend = {config.OCR_BACKEND}')
    print('[bot] polling...')
    await dp.start_polling(bot)


if __name__ == '__main__':
    asyncio.run(main())
