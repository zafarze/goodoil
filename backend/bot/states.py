from aiogram.fsm.state import State, StatesGroup


class ReportStates(StatesGroup):
    waiting_photo = State()
    preview = State()
    editing_value = State()
