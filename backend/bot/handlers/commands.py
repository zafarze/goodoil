from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message
from asgiref.sync import sync_to_async
from django.db.models import Sum

from app.models import DailyReport, Delivery, Employee, FuelType, ReportItem

from ..states import ReportStates

router = Router()


def _no_access_text() -> str:
    return (
        '🚫 Доступ запрещён.\n'
        'Ваш Telegram ID не зарегистрирован. Обратитесь к владельцу.'
    )


@router.message(CommandStart())
async def cmd_start(message: Message, employee: Employee | None) -> None:
    if employee is None:
        await message.answer(_no_access_text() + f'\n\nВаш ID: <code>{message.from_user.id}</code>', parse_mode='HTML')
        return
    await message.answer(
        f'👋 Здравствуйте, {employee.full_name}!\n'
        f'Закреплены за: <b>{employee.station.name}</b>\n\n'
        'Команды:\n'
        '/report — отправить отчёт за смену (фото)\n'
        '/ostatki — расчётные остатки на вашей АЗС',
        parse_mode='HTML',
    )


@router.message(Command('report'))
async def cmd_report(message: Message, state: FSMContext, employee: Employee | None) -> None:
    if employee is None:
        await message.answer(_no_access_text())
        return
    await state.clear()
    await state.set_state(ReportStates.waiting_photo)
    await message.answer('📷 Пришлите фотографию заполненного бумажного отчёта.')


@sync_to_async
def _compute_remainders(employee: Employee) -> list[dict]:
    rows = []
    for fuel in FuelType.objects.all():
        delivered = Delivery.objects.filter(
            station=employee.station, fuel_type=fuel,
        ).aggregate(s=Sum('volume'))['s'] or 0
        sold = ReportItem.objects.filter(
            report__station=employee.station,
            report__status=DailyReport.Status.CONFIRMED,
            fuel_type=fuel,
        ).aggregate(s=Sum('sold'))['s'] or 0
        rows.append({
            'name': fuel.name,
            'unit': fuel.get_unit_display(),
            'delivered': float(delivered),
            'sold': float(sold),
            'remainder': float(delivered) - float(sold),
        })
    return rows


@router.message(Command('ostatki'))
async def cmd_ostatki(message: Message, employee: Employee | None) -> None:
    if employee is None:
        await message.answer(_no_access_text())
        return
    rows = await _compute_remainders(employee)
    lines = [f'📊 Остатки — <b>{employee.station.name}</b>:']
    for r in rows:
        lines.append(
            f'• {r["name"]}: <b>{r["remainder"]:.2f}</b> {r["unit"]} '
            f'(привоз {r["delivered"]:.2f}, продано {r["sold"]:.2f})'
        )
    await message.answer('\n'.join(lines), parse_mode='HTML')
