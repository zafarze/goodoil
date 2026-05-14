import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  api,
  currentUser,
  type Paginated,
  type SystemUser,
} from '../api/client';
import { useNotify } from '../components/Notify';

const FIELD_LABELS: Record<string, string> = {
  username: 'Логин',
  new_password: 'Пароль',
  is_active: 'Статус',
  detail: 'Ошибка',
  non_field_errors: 'Ошибка',
};

function formatErrors(data: unknown): string {
  if (!data) return 'Ошибка';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const label = FIELD_LABELS[k] ?? k;
    const msg = Array.isArray(v) ? v.join(', ') : String(v);
    lines.push(`${label}: ${msg}`);
  }
  return lines.join('\n');
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${mon}.${yr} ${hh}:${mm}`;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="usr-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="usr-modal-card">
        <button
          type="button"
          className="usr-modal-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function Users() {
  const notify = useNotify();
  const me = currentUser();
  const myId = me?.id ?? null;

  const [list, setList] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create owner modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', password: '' });
  const [createShowPwd, setCreateShowPwd] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset-password modal
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null);
  const [resetForm, setResetForm] = useState({ password: '' });
  const [resetShowPwd, setResetShowPwd] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<Paginated<SystemUser>>('/users/');
    setList(res.data.results);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ── Create owner ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setCreateForm({ username: '', password: '' });
    setCreateError(null);
    setCreateShowPwd(false);
    setCreateOpen(true);
  };

  const closeCreate = () => setCreateOpen(false);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const missing: string[] = [];
    if (!createForm.username.trim()) missing.push('Логин');
    if (!createForm.password) missing.push('Пароль');
    if (missing.length) {
      setCreateError('Заполните поля: ' + missing.join(', '));
      return;
    }
    setCreateSaving(true);
    try {
      await api.post('/users/', {
        username: createForm.username.trim(),
        new_password: createForm.password,
        is_staff: true,
        is_active: true,
      });
      closeCreate();
      load();
      notify.success('Владелец добавлен.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      setCreateError(formatErrors(axiosErr?.response?.data));
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const openReset = (u: SystemUser) => {
    setResetTarget(u);
    setResetForm({ password: '' });
    setResetError(null);
    setResetShowPwd(false);
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetForm({ password: '' });
    setResetError(null);
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (!resetForm.password) {
      setResetError('Заполните поле: Пароль');
      return;
    }
    setResetSaving(true);
    try {
      await api.post(`/users/${resetTarget.id}/reset-password/`, {
        new_password: resetForm.password,
      });
      closeReset();
      notify.success('Пароль обновлён.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      setResetError(formatErrors(axiosErr?.response?.data));
    } finally {
      setResetSaving(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (u: SystemUser) => {
    try {
      await api.patch(`/users/${u.id}/`, { is_active: !u.is_active });
      await load();
      notify.success(u.is_active ? 'Учётная запись отключена.' : 'Учётная запись включена.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notify.error(formatErrors(data), { title: 'Не удалось изменить статус' });
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteUser = async (u: SystemUser) => {
    const ok = await notify.confirm({
      title: 'Удалить пользователя',
      message: `"${u.username}"\nДействие необратимо. Учётная запись будет удалена окончательно.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}/`);
      await load();
      notify.success('Пользователь удалён.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notify.error(formatErrors(data), { title: 'Не удалось удалить' });
    }
  };

  const owners = list.filter((u) => u.role === 'owner');
  const employees = list.filter((u) => u.role === 'employee');
  const others = list.filter((u) => u.role === 'user');

  return (
    <div className="page">
      <div className="usr-page-header">
        <h1>Доступ и роли</h1>
        <button type="button" className="usr-add-btn" onClick={openCreate}>
          + Добавить владельца
        </button>
      </div>

      {/* ── Create owner modal ─────────────────────────────────────────────── */}
      <Modal open={createOpen} onClose={closeCreate}>
        <form className="usr-modal-form form-grid" onSubmit={submitCreate} noValidate>
          <h2 className="span-2">Добавить владельца</h2>

          <label className="span-2">
            Логин
            <input
              autoFocus
              maxLength={150}
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              autoComplete="off"
            />
          </label>

          <label className="span-2">
            Пароль
            <div className="go-pwd-wrap">
              <input
                type={createShowPwd ? 'text' : 'password'}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="go-pwd-toggle"
                onClick={() => setCreateShowPwd((s) => !s)}
                tabIndex={-1}
                aria-label={createShowPwd ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {createShowPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {createError && (
            <div className="error span-2" style={{ whiteSpace: 'pre-line' }}>{createError}</div>
          )}

          <div className="span-2">
            <button type="submit" disabled={createSaving}>
              {createSaving ? '...' : 'Добавить'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Reset password modal ───────────────────────────────────────────── */}
      <Modal open={resetTarget !== null} onClose={closeReset}>
        <form className="usr-modal-form form-grid" onSubmit={submitReset} noValidate>
          <h2 className="span-2">Сброс пароля</h2>
          <p className="usr-reset-hint span-2">
            {resetTarget?.id === myId
              ? 'Вы меняете пароль своей учётной записи. Текущая сессия не прервётся.'
              : `Пользователь: ${resetTarget?.username}. После сброса все его сессии будут завершены.`}
          </p>

          <label className="span-2">
            Новый пароль
            <div className="go-pwd-wrap">
              <input
                autoFocus
                type={resetShowPwd ? 'text' : 'password'}
                value={resetForm.password}
                onChange={(e) => setResetForm({ password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="go-pwd-toggle"
                onClick={() => setResetShowPwd((s) => !s)}
                tabIndex={-1}
                aria-label={resetShowPwd ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {resetShowPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {resetError && (
            <div className="error span-2" style={{ whiteSpace: 'pre-line' }}>{resetError}</div>
          )}

          <div className="span-2">
            <button type="submit" disabled={resetSaving}>
              {resetSaving ? '...' : 'Сменить пароль'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Owners section ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="usr-section-head">
          <h2>Владельцы</h2>
          <span className="usr-section-count">{owners.length}</span>
        </div>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : owners.length === 0 ? (
          <p className="muted">Пока пусто.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="usr-col-num">№</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Последний вход</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {owners.map((u, i) => {
                const isMe = u.id === myId;
                return (
                  <tr key={u.id}>
                    <td className="usr-col-num usr-col-num-cell">{i + 1}</td>
                    <td>
                      <span className="usr-username">{u.username}</span>
                      {isMe && <span className="usr-me-badge">вы</span>}
                      {u.is_superuser && <span className="usr-su-badge">superuser</span>}
                    </td>
                    <td>
                      <span className="usr-role-badge owner">Владелец</span>
                    </td>
                    <td className="usr-muted-cell">{fmtDateTime(u.last_login)}</td>
                    <td>
                      <button
                        type="button"
                        className={`usr-status-btn ${u.is_active ? 'is-active' : 'is-inactive'}`}
                        onClick={() => !isMe && toggleActive(u)}
                        disabled={isMe}
                        title={isMe ? 'Нельзя отключить свою учётную запись' : undefined}
                        aria-label={u.is_active ? 'Отключить' : 'Включить'}
                      >
                        {u.is_active ? 'активен' : 'отключён'}
                      </button>
                    </td>
                    <td>
                      <div className="usr-row-actions">
                        <button
                          type="button"
                          className="usr-icon-btn"
                          title="Сбросить пароль"
                          onClick={() => openReset(u)}
                          aria-label="Сбросить пароль"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="usr-icon-btn danger"
                          title={isMe ? 'Нельзя удалить свою учётную запись' : 'Удалить'}
                          onClick={() => deleteUser(u)}
                          disabled={isMe}
                          aria-label="Удалить"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Employees section (read-only) ──────────────────────────────────── */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="usr-section-head">
          <h2>Сотрудники</h2>
          <span className="usr-section-count">{employees.length}</span>
          <Link to="/employees" className="usr-section-link">
            Управление сотрудниками →
          </Link>
        </div>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : employees.length === 0 ? (
          <p className="muted">Учётных записей сотрудников пока нет.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="usr-col-num">№</th>
                <th>Логин</th>
                <th>ФИО</th>
                <th>АЗС</th>
                <th>Последний вход</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((u, i) => (
                <tr key={u.id}>
                  <td className="usr-col-num usr-col-num-cell">{i + 1}</td>
                  <td>
                    <span className="usr-username">{u.username}</span>
                  </td>
                  <td>{u.employee_name ?? '—'}</td>
                  <td>{u.employee_station ?? <span className="muted">—</span>}</td>
                  <td className="usr-muted-cell">{fmtDateTime(u.last_login)}</td>
                  <td>
                    <span className={`usr-status-pill ${u.is_active ? 'is-active' : 'is-inactive'}`}>
                      {u.is_active ? 'активен' : 'отключён'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Orphan accounts (rare — no staff, no employee link) ───────────── */}
      {others.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="usr-section-head">
            <h2>Прочие</h2>
            <span className="usr-section-count">{others.length}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th className="usr-col-num">№</th>
                <th>Логин</th>
                <th>Последний вход</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {others.map((u, i) => (
                <tr key={u.id}>
                  <td className="usr-col-num usr-col-num-cell">{i + 1}</td>
                  <td>{u.username}</td>
                  <td className="usr-muted-cell">{fmtDateTime(u.last_login)}</td>
                  <td>
                    <button
                      type="button"
                      className={`usr-status-btn ${u.is_active ? 'is-active' : 'is-inactive'}`}
                      onClick={() => toggleActive(u)}
                      aria-label={u.is_active ? 'Отключить' : 'Включить'}
                    >
                      {u.is_active ? 'активен' : 'отключён'}
                    </button>
                  </td>
                  <td>
                    <div className="usr-row-actions">
                      <button
                        type="button"
                        className="usr-icon-btn"
                        title="Сбросить пароль"
                        onClick={() => openReset(u)}
                        aria-label="Сбросить пароль"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="usr-icon-btn danger"
                        title="Удалить"
                        onClick={() => deleteUser(u)}
                        aria-label="Удалить"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{usrCss}</style>
    </div>
  );
}

const usrCss = `
.usr-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}
.usr-page-header h1 { margin: 0; }

.usr-add-btn {
  flex-shrink: 0;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.usr-section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.usr-section-head h2 { margin: 0; }
.usr-section-count {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 10px;
}
.usr-section-link {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  transition: opacity 0.18s;
}
.usr-section-link:hover { opacity: 0.8; text-decoration: none; }

.usr-username {
  font-weight: 600;
}

.usr-me-badge,
.usr-su-badge {
  margin-left: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
}
.usr-me-badge {
  background: rgba(74, 222, 128, 0.16);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: #4ade80;
}
.usr-su-badge {
  background: rgba(168, 85, 247, 0.16);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: #c084fc;
}

.usr-role-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
}
.usr-role-badge.owner {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(236, 72, 153, 0.14));
  border: 1px solid rgba(168, 85, 247, 0.45);
  color: #d8b4fe;
}
:root[data-theme="light"] .usr-role-badge.owner {
  color: #7c3aed;
}

.usr-muted-cell {
  color: var(--muted);
  font-size: 13px;
}

.usr-row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.usr-icon-btn {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  transition: background 0.18s, transform 0.15s, box-shadow 0.2s, border-color 0.18s, color 0.18s;
  padding: 0;
}
.usr-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--panel);
}
.usr-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.usr-icon-btn.danger {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
  border-color: transparent;
}
.usr-icon-btn.danger:hover:not(:disabled) {
  box-shadow: 0 8px 20px -4px rgba(248, 113, 113, 0.5);
}
.usr-icon-btn.danger:disabled {
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.4), rgba(239, 68, 68, 0.4));
}

.usr-status-btn {
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.18s, transform 0.12s, box-shadow 0.2s;
  white-space: nowrap;
}
.usr-status-btn:hover:not(:disabled) { transform: translateY(-1px); }
.usr-status-btn:disabled { cursor: not-allowed; opacity: 0.6; }
.usr-status-btn.is-active {
  color: #16a34a;
  background: rgba(74, 222, 128, 0.12);
  border-color: rgba(74, 222, 128, 0.5);
}
.usr-status-btn.is-active:hover:not(:disabled) {
  background: rgba(74, 222, 128, 0.22);
}
.usr-status-btn.is-inactive {
  color: #d97706;
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.5);
}
.usr-status-btn.is-inactive:hover:not(:disabled) {
  background: rgba(250, 204, 21, 0.24);
}

.usr-status-pill {
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.usr-status-pill.is-active {
  color: #16a34a;
  background: rgba(74, 222, 128, 0.10);
  border-color: rgba(74, 222, 128, 0.4);
}
.usr-status-pill.is-inactive {
  color: #d97706;
  background: rgba(250, 204, 21, 0.10);
  border-color: rgba(250, 204, 21, 0.4);
}

.usr-reset-hint {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.usr-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: usr-backdrop-in 0.22s ease;
  overflow-y: auto;
}
@keyframes usr-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.usr-modal-card {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  padding: 28px 28px 24px;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  animation: usr-card-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes usr-card-in {
  from { opacity: 0; transform: scale(0.96) translateY(14px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
:root[data-theme="light"] .usr-modal-card {
  background: rgba(255, 255, 255, 0.96);
  border-color: var(--border-strong);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
}

.usr-modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  min-height: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  background-image: none;
  color: var(--muted);
  font-size: 14px;
  display: grid;
  place-items: center;
  box-shadow: none;
  line-height: 1;
  transition: background 0.18s, color 0.18s, transform 0.15s, box-shadow 0.18s;
  z-index: 1;
}
.usr-modal-close:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.16);
  background-image: none;
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.4);
  transform: none;
  box-shadow: none;
}
:root[data-theme="light"] .usr-modal-close {
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
  border-color: var(--border);
}
:root[data-theme="light"] .usr-modal-close:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.3);
}

.usr-modal-form {
  margin: 0;
  border: none;
  padding: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  animation: none;
}

.usr-col-num {
  width: 60px;
  min-width: 44px;
  text-align: center;
}
.usr-col-num-cell {
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
`;
