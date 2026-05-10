# Good Oil CRM

CRM-система для учёта работы АЗС: остатки топлива, ежедневные отчёты сотрудников,
привозы на склад, сводный дашборд для владельца. Демо-режим включает дополнительный
тип бизнеса — производство цемент-блоков.

## Технологии

- **Backend:** Django 5 + Django REST Framework, SQLite (dev) / PostgreSQL (prod), Token Auth
- **Frontend:** React 19 + TypeScript + Vite, React Router, Recharts, Axios
- **Бот:** aiogram 3 (Telegram-бот для сотрудников АЗС, OCR чеков)

## Структура

```
good_oil/
├─ backend/        Django REST API + Telegram-бот
│  ├─ app/         Бизнес-логика (модели, сериализаторы, вьюхи)
│  ├─ bot/         Telegram-бот для сотрудников
│  ├─ config/      Настройки Django
│  └─ .env.example
├─ frontend/       React + Vite клиент
│  └─ src/
│     ├─ pages/        Дашборд, Отчёты, Склад, Сотрудники, Логин
│     ├─ components/   Layout, Sidebar, Header
│     ├─ hooks/        useTheme
│     └─ api/          Axios-клиент
└─ Техническое задание.docx
```

## Быстрый старт

### Backend (Django)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # затем отредактировать
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver   # http://127.0.0.1:8000
```

### Frontend (Vite)

```powershell
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

### Telegram-бот (опционально)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m bot                # требует BOT_TOKEN в .env
```

## Возможности

### Дашборд
- 6 цветных KPI-карточек (станции, топливо, привозы, продажи, сотрудники, отчёты)
- Таблицы остатков по каждой АЗС
- Линейный график динамики продаж за 30 дней с трендом
- Donut-диаграмма распределения остатков по типам топлива
- Переключатель типа бизнеса: ⛽ АЗС / 🧱 Цемент-блок

### Цемент-блок (демо)
- KPI производства, выручки, заказов
- Цеха с таблицей: тип блока, размер, произведено, брак, на складе
- Сырьё на складе (цемент, песок, керамзит и т.д.)
- Активные заказы клиентов

### UI
- Современный glassmorphism-дизайн с анимациями
- Светлая и тёмная темы (переключатель в сайдбаре)
- Адаптивный layout (desktop / tablet / mobile)
- Сворачиваемый сайдбар
- Хедер с поиском, выбором языка, уведомлениями и аватар-меню

## Лицензия

Private. © 2026 zafarze
