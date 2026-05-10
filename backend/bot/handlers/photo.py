"""Photo flow: receive → OCR → preview → confirm/edit → save."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.files import File
from django.utils import timezone

from app.models import DailyReport, Employee, FuelType, ReportItem

from ..ocr import OCRResult, ParsedItem, get_backend
from ..states import ReportStates

router = Router()
_ocr = get_backend()

EDIT_FIELDS = ('sold', 'revenue', 'remainder')
FIELD_LABELS = {'sold': 'Продано', 'revenue': 'Выручка', 'remainder': 'Остаток'}


def _format_preview(items: list[dict]) -> str:
    lines = ['🧾 Распознанные данные:', '']
    for it in items:
        lines.append(
            f'• <b>{it["fuel_name"]}</b>: '
            f'продано {it["sold"]}, выручка {it["revenue"]}, остаток {it["remainder"]}'
        )
    lines += ['', 'Всё верно?']
    return '\n'.join(lines)


def _confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text='✅ Подтвердить', callback_data='rpt:confirm'),
        InlineKeyboardButton(text='✏️ Редактировать', callback_data='rpt:edit'),
        InlineKeyboardButton(text='❌ Отмена', callback_data='rpt:cancel'),
    ]])


def _edit_kb(items: list[dict]) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for idx, it in enumerate(items):
        for field in EDIT_FIELDS:
            kb.button(
                text=f'{it["fuel_name"]}/{FIELD_LABELS[field]}: {it[field]}',
                callback_data=f'rpt:set:{idx}:{field}',
            )
    kb.button(text='⬅️ Готово', callback_data='rpt:back')
    kb.adjust(1)
    return kb.as_markup()


@sync_to_async
def _save_draft_with_photo(employee: Employee, blob: bytes, ext: str) -> int:
    report = DailyReport.objects.create(
        date=date.today(),
        employee=employee,
        station=employee.station,
        status=DailyReport.Status.DRAFT,
    )
    name = f'{uuid.uuid4().hex}.{ext}'
    from io import BytesIO
    report.photo.save(name, File(BytesIO(blob)), save=True)
    return report.id


@sync_to_async
def _commit_report(report_id: int, items: list[dict]) -> None:
    report = DailyReport.objects.get(id=report_id)
    fuel_map = {f.name: f for f in FuelType.objects.all()}
    report.items.all().delete()
    for it in items:
        fuel = fuel_map.get(it['fuel_name'])
        if fuel is None:
            continue
        ReportItem.objects.create(
            report=report,
            fuel_type=fuel,
            sold=Decimal(str(it['sold'])),
            revenue=Decimal(str(it['revenue'])),
            remainder=Decimal(str(it['remainder'])),
        )
    report.status = DailyReport.Status.CONFIRMED
    report.confirmed_at = timezone.now()
    report.save(update_fields=['status', 'confirmed_at'])


@sync_to_async
def _delete_draft(report_id: int) -> None:
    DailyReport.objects.filter(id=report_id).delete()


def _items_to_dicts(parsed: list[ParsedItem]) -> list[dict]:
    return [
        {
            'fuel_name': p.fuel_name,
            'sold': str(p.sold),
            'revenue': str(p.revenue),
            'remainder': str(p.remainder),
        }
        for p in parsed
    ]


@router.message(ReportStates.waiting_photo, F.photo)
async def on_photo(message: Message, state: FSMContext, bot: Bot, employee: Employee | None) -> None:
    if employee is None:
        await message.answer('🚫 Доступ запрещён.')
        return

    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)
    tmp_path = Path(settings.MEDIA_ROOT) / 'tmp'
    tmp_path.mkdir(parents=True, exist_ok=True)
    local = tmp_path / f'{uuid.uuid4().hex}.jpg'
    await bot.download_file(file.file_path, destination=local)

    try:
        ocr_result: OCRResult = await _ocr.parse(local)
    except Exception as exc:  # noqa: BLE001
        await message.answer(f'⚠️ Ошибка OCR: {exc}\nПопробуйте переснять документ.')
        await state.clear()
        return

    if not ocr_result.items:
        await message.answer('Фото не распознано. Переснимите ярче и без бликов.')
        return

    blob = local.read_bytes()
    report_id = await _save_draft_with_photo(employee, blob, 'jpg')
    local.unlink(missing_ok=True)

    items = _items_to_dicts(ocr_result.items)
    await state.set_state(ReportStates.preview)
    await state.update_data(report_id=report_id, items=items)

    await message.answer(_format_preview(items), parse_mode='HTML', reply_markup=_confirm_kb())


@router.message(ReportStates.waiting_photo)
async def need_photo(message: Message) -> None:
    await message.answer('Жду фото отчёта 📷')


@router.callback_query(ReportStates.preview, F.data == 'rpt:confirm')
async def on_confirm(call: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    await _commit_report(data['report_id'], data['items'])
    await state.clear()
    await call.message.edit_text('✅ Отчёт сохранён и подтверждён. Спасибо!')
    await call.answer()


@router.callback_query(F.data == 'rpt:cancel')
async def on_cancel(call: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    if rid := data.get('report_id'):
        await _delete_draft(rid)
    await state.clear()
    await call.message.edit_text('❌ Отменено.')
    await call.answer()


@router.callback_query(ReportStates.preview, F.data == 'rpt:edit')
async def on_edit(call: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    await call.message.edit_text(
        'Выберите поле для правки:',
        reply_markup=_edit_kb(data['items']),
    )
    await call.answer()


@router.callback_query(ReportStates.preview, F.data == 'rpt:back')
async def on_back(call: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    await call.message.edit_text(
        _format_preview(data['items']), parse_mode='HTML', reply_markup=_confirm_kb(),
    )
    await call.answer()


@router.callback_query(ReportStates.preview, F.data.startswith('rpt:set:'))
async def on_pick_field(call: CallbackQuery, state: FSMContext) -> None:
    _, _, idx_s, field = call.data.split(':')
    await state.update_data(edit_idx=int(idx_s), edit_field=field)
    await state.set_state(ReportStates.editing_value)
    data = await state.get_data()
    item = data['items'][int(idx_s)]
    await call.message.edit_text(
        f'Введите новое значение для <b>{item["fuel_name"]} / {FIELD_LABELS[field]}</b> '
        f'(текущее: {item[field]}):',
        parse_mode='HTML',
    )
    await call.answer()


@router.message(ReportStates.editing_value)
async def on_new_value(message: Message, state: FSMContext) -> None:
    raw = (message.text or '').replace(',', '.').strip()
    try:
        value = Decimal(raw)
    except InvalidOperation:
        await message.answer('Нужно число. Пример: 312.5')
        return
    data = await state.get_data()
    items = data['items']
    items[data['edit_idx']][data['edit_field']] = str(value)
    await state.update_data(items=items)
    await state.set_state(ReportStates.preview)
    await message.answer(
        _format_preview(items), parse_mode='HTML', reply_markup=_confirm_kb(),
    )
