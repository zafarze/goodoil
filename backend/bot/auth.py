"""Resolve incoming Telegram user → Employee. Block strangers."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, User
from asgiref.sync import sync_to_async

from app.models import Employee


@sync_to_async
def _find_employee(telegram_id: int) -> Employee | None:
    return (
        Employee.objects.select_related('station')
        .filter(telegram_id=telegram_id, is_active=True)
        .first()
    )


class AuthMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user: User | None = data.get('event_from_user')
        if user is None:
            return await handler(event, data)

        employee = await _find_employee(user.id)
        data['employee'] = employee
        return await handler(event, data)
