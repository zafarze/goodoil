from aiogram import Dispatcher

from . import commands, photo


def register(dp: Dispatcher) -> None:
    dp.include_router(commands.router)
    dp.include_router(photo.router)
