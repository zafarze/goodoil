import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { currentUser, logout } from '../api/client';

interface Props {
  onBurger: () => void;
}

type Lang = 'RU' | 'UZ' | 'EN';
const langOptions: { code: Lang; flag: string; name: string }[] = [
  { code: 'RU', flag: '🇷🇺', name: 'Русский' },
  { code: 'UZ', flag: '🇺🇿', name: "O‘zbek" },
  { code: 'EN', flag: '🇬🇧', name: 'English' },
];

const demoNotifications = [
  { id: 1, text: 'Новый отчёт от АЗС 1', time: '5 мин назад' },
  { id: 2, text: 'Низкий остаток солярки на АЗС 2', time: '1 час назад' },
  { id: 3, text: 'Привоз бензина подтверждён', time: '3 часа назад' },
];

const titleMap: Record<string, [string, string]> = {
  '/': ['Дашборд', 'Добро пожаловать в систему'],
  '/reports': ['Отчёты', 'Список отчётов сотрудников'],
  '/deliveries': ['Склад / Привоз', 'Учёт поступлений топлива'],
  '/employees': ['Сотрудники', 'Управление командой'],
};

export default function Header({ onBurger }: Props) {
  const user = currentUser();
  const [menu, setMenu] = useState<null | 'lang' | 'notif' | 'user'>(null);
  const [lang, setLang] = useState<Lang>('RU');
  const [search, setSearch] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const loc = useLocation();

  const [title, subtitle] = titleMap[loc.pathname] ?? ['Good Oil CRM', ''];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMenu(null); }, [loc.pathname]);

  const initial = (user?.username ?? '?').slice(0, 1).toUpperCase();
  const currentLang = langOptions.find((l) => l.code === lang)!;
  const hasUnread = demoNotifications.length > 0;

  return (
    <header className="topbar" ref={headerRef}>
      <button className="burger" aria-label="Меню" onClick={onBurger}>
        <span /><span /><span />
      </button>

      <div className="head-titles">
        <div className="head-pgtitle">{title}</div>
        {subtitle && <div className="head-pgsub">{subtitle}</div>}
      </div>

      <div className="hdr-search">
        <SearchIcon />
        <input
          placeholder="Поиск по системе…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="head-kbd">⌘K</span>
      </div>

      <div className="hdr-actions">
        <div className="hdr-menu">
          <button
            className="hdr-icon"
            onClick={() => setMenu((m) => (m === 'lang' ? null : 'lang'))}
            aria-label="Язык"
          >
            <GlobeIcon />
            <span>{currentLang.code}</span>
          </button>
          {menu === 'lang' && (
            <div className="hdr-dropdown">
              {langOptions.map((l) => (
                <button
                  key={l.code}
                  className={'hdr-dd-item' + (l.code === lang ? ' active' : '')}
                  onClick={() => { setLang(l.code); setMenu(null); }}
                >
                  <span className="hdr-dd-flag">{l.flag}</span>
                  <span>{l.name}</span>
                  <span className="hdr-dd-code">{l.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hdr-menu">
          <button
            className="hdr-icon hdr-icon-square"
            onClick={() => setMenu((m) => (m === 'notif' ? null : 'notif'))}
            aria-label="Уведомления"
          >
            <BellIcon />
            {hasUnread && <span className="hdr-dot" />}
          </button>
          {menu === 'notif' && (
            <div className="hdr-dropdown hdr-dd-wide">
              <div className="hdr-dd-title">Уведомления</div>
              {demoNotifications.length === 0 ? (
                <div className="hdr-dd-empty">Нет новых уведомлений</div>
              ) : (
                demoNotifications.map((n) => (
                  <div key={n.id} className="hdr-notif">
                    <div className="hdr-notif-dot" />
                    <div className="hdr-notif-body">
                      <div className="hdr-notif-text">{n.text}</div>
                      <div className="hdr-notif-time">{n.time}</div>
                    </div>
                  </div>
                ))
              )}
              <button className="hdr-dd-item hdr-dd-foot">Открыть все →</button>
            </div>
          )}
        </div>

        <div className="hdr-menu head-user-menu">
          <button
            className="head-user"
            onClick={() => setMenu((m) => (m === 'user' ? null : 'user'))}
            aria-label="Профиль"
          >
            <span className="head-user-ava">{initial}</span>
            <span className="head-user-info">
              <span className="head-user-name">{user?.username ?? 'Гость'}</span>
              <span className="head-user-role">Владелец</span>
            </span>
            <ChevronDown />
          </button>
          {menu === 'user' && (
            <div className="hdr-dropdown">
              <div className="hdr-dd-user">
                <div className="hdr-dd-avatar">{initial}</div>
                <div>
                  <div className="hdr-dd-name">{user?.username ?? 'Гость'}</div>
                  <div className="hdr-dd-role">Владелец</div>
                </div>
              </div>
              <button className="hdr-dd-item" onClick={() => setMenu(null)}>
                <span>👤</span><span>Профиль</span>
              </button>
              <button className="hdr-dd-item" onClick={() => setMenu(null)}>
                <span>⚙️</span><span>Настройки</span>
              </button>
              <div className="hdr-dd-sep" />
              <button className="hdr-dd-item hdr-dd-danger" onClick={logout}>
                <span>🚪</span><span>Выйти</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="head-user-chev">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
