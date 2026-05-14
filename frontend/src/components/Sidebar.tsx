import { NavLink } from 'react-router-dom';
import { logout } from '../api/client';
import { applyTheme, useTheme } from '../hooks/useTheme';

interface Props {
  open: boolean;
  collapsed: boolean;
  onCollapse: () => void;
}

const links = [
  { to: '/', label: 'Дашборд', end: true, icon: <DashIcon /> },
  { to: '/reports', label: 'Отчёты', icon: <DocIcon /> },
  { to: '/deliveries', label: 'Склад / Привоз', icon: <TruckIcon /> },
  { to: '/management', label: 'Управление', icon: <ManageIcon /> },
  { to: '/settings', label: 'Настройка', icon: <SettingsIcon /> },
];

export default function Sidebar({ open, collapsed, onCollapse }: Props) {
  const theme = useTheme();
  return (
    <aside className={'sidebar' + (open ? ' open' : '') + (collapsed ? ' collapsed' : '')}>
      <div className="side-head">
        <div className="side-logo">⛽</div>
        <div className="side-brand">
          <div className="side-brand-name">GOOD OIL</div>
          <div className="side-brand-sub">CRM&nbsp;СИСТЕМА</div>
        </div>
        <button className="side-collapse" onClick={onCollapse} aria-label="Свернуть">
          <ChevronIcon collapsed={collapsed} />
        </button>
      </div>

      <nav className="side-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => 'side-link' + (isActive ? ' active' : '')}
          >
            <span className="side-link-ico">{l.icon}</span>
            <span className="side-link-label">{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-foot">
        <div className="theme-toggle" role="group" aria-label="Тема">
          <button
            type="button"
            className={'theme-opt' + (theme === 'light' ? ' active' : '')}
            onClick={() => applyTheme('light')}
          >
            <span className="theme-ico">☀</span><span>Light</span>
          </button>
          <button
            type="button"
            className={'theme-opt' + (theme === 'dark' ? ' active' : '')}
            onClick={() => applyTheme('dark')}
          >
            <span className="theme-ico">☾</span><span>Dark</span>
          </button>
        </div>

        <button className="side-logout" onClick={logout}>
          <LogoutIcon />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
}

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
function ManageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h13" />
      <path d="M3 12h13" />
      <path d="M3 18h13" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
