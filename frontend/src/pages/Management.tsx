import { Link } from 'react-router-dom';

interface Card {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  disabled?: boolean;
}

const cards: Card[] = [
  {
    to: '/employees',
    title: 'Сотрудники',
    desc: 'Добавление работников, привязка к АЗС, Telegram-идентификаторы и активность.',
    icon: <UsersIcon />,
    gradient: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)',
    glow: 'rgba(74, 222, 128, 0.35)',
  },
  {
    to: '#',
    title: 'АЗС',
    desc: 'Список заправочных станций, адреса и привязка персонала.',
    icon: <PumpIcon />,
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
    glow: 'rgba(56, 189, 248, 0.35)',
    disabled: true,
  },
  {
    to: '#',
    title: 'Виды топлива',
    desc: 'Каталог видов топлива, единицы измерения, цены.',
    icon: <DropIcon />,
    gradient: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
    glow: 'rgba(250, 204, 21, 0.35)',
    disabled: true,
  },
  {
    to: '#',
    title: 'Доступ и роли',
    desc: 'Пользователи системы, права, смена паролей.',
    icon: <ShieldIcon />,
    gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    glow: 'rgba(168, 85, 247, 0.35)',
    disabled: true,
  },
];

export default function Management() {
  return (
    <div className="mgmt-page">
      <header className="mgmt-head">
        <h1 className="mgmt-title">Управление</h1>
        <p className="mgmt-sub">Выберите раздел для настройки данных системы</p>
      </header>

      <div className="mgmt-grid">
        {cards.map((c) =>
          c.disabled ? (
            <div
              key={c.title}
              className="mgmt-card disabled"
              style={{ ['--card-glow' as string]: c.glow }}
              aria-disabled="true"
            >
              <CardInner card={c} />
              <span className="mgmt-soon">Скоро</span>
            </div>
          ) : (
            <Link
              key={c.title}
              to={c.to}
              className="mgmt-card"
              style={{ ['--card-glow' as string]: c.glow }}
            >
              <CardInner card={c} />
              <ArrowIcon />
            </Link>
          ),
        )}
      </div>

      <style>{css}</style>
    </div>
  );
}

function CardInner({ card }: { card: Card }) {
  return (
    <>
      <div className="mgmt-card-glow" />
      <div className="mgmt-icon" style={{ background: card.gradient }}>
        {card.icon}
      </div>
      <div className="mgmt-text">
        <div className="mgmt-card-title">{card.title}</div>
        <div className="mgmt-card-desc">{card.desc}</div>
      </div>
    </>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M15 14.5a4.5 4.5 0 0 1 6.5 4" />
    </svg>
  );
}

function PumpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M4 21h10" />
      <path d="M7 9h4" />
      <path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-2-2" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="mgmt-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

const css = `
.mgmt-page {
  padding: 8px 4px 40px;
}

.mgmt-head {
  margin-bottom: 28px;
}
.mgmt-title {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(90deg, #4ade80, #38bdf8, #a855f7);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: mgmt-title-shine 6s linear infinite;
}
@keyframes mgmt-title-shine {
  to { background-position: 200% 0; }
}
.mgmt-sub {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.mgmt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

.mgmt-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 22px 22px 20px;
  border-radius: 18px;
  background: var(--panel);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid var(--border);
  color: var(--text);
  text-decoration: none;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  cursor: pointer;
}
.mgmt-card:hover {
  text-decoration: none;
  transform: translateY(-4px);
  border-color: var(--border-strong);
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.25),
    0 0 60px -10px var(--card-glow, rgba(74, 222, 128, 0.3));
}
.mgmt-card:hover .mgmt-card-glow {
  opacity: 1;
}
.mgmt-card:hover .mgmt-icon {
  transform: scale(1.06) rotate(-3deg);
}
.mgmt-card:hover .mgmt-arrow {
  transform: translateX(4px);
  opacity: 1;
}

.mgmt-card.disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.mgmt-card.disabled:hover {
  transform: none;
  box-shadow: none;
  border-color: var(--border);
}
.mgmt-card.disabled:hover .mgmt-icon {
  transform: none;
}

.mgmt-card-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 0% 0%, var(--card-glow, rgba(74, 222, 128, 0.25)) 0%, transparent 55%);
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.mgmt-icon {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  box-shadow: 0 8px 20px -6px var(--card-glow, rgba(74, 222, 128, 0.5));
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.mgmt-icon svg {
  width: 26px;
  height: 26px;
}

.mgmt-text {
  flex: 1;
  min-width: 0;
}
.mgmt-card-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
  margin-bottom: 4px;
  color: var(--text);
}
.mgmt-card-desc {
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
}

.mgmt-arrow {
  position: absolute;
  right: 18px;
  bottom: 18px;
  width: 20px;
  height: 20px;
  color: var(--muted);
  opacity: 0.5;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.mgmt-soon {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  color: var(--muted);
}

@media (max-width: 560px) {
  .mgmt-grid { grid-template-columns: 1fr; }
  .mgmt-title { font-size: 24px; }
}
`;
