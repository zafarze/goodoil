import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type Paginated, type Station } from '../api/client';
import { useNotify } from '../components/Notify';

const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  address: 'Адрес',
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
      className="sta-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="sta-modal-card">
        <button
          type="button"
          className="sta-modal-close"
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

export default function Stations() {
  const notify = useNotify();
  const [list, setList] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<Paginated<Station>>('/stations/');
    setList(res.data.results);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ name: '', address: '' });
    setError(null);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (s: Station) => {
    resetForm();
    setForm({ name: s.name, address: s.address ?? '' });
    setEditingId(s.id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Заполните поле: Название');
      return;
    }

    const isEdit = editingId !== null;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), address: form.address.trim() };
      if (isEdit) {
        await api.patch(`/stations/${editingId}/`, payload);
      } else {
        await api.post('/stations/', payload);
      }
      resetForm();
      setModalOpen(false);
      load();
      notify.success(isEdit ? 'Изменения сохранены.' : 'АЗС добавлена.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      setError(formatErrors(axiosErr?.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const deleteStation = async (s: Station) => {
    const ok = await notify.confirm({
      title: 'Удалить АЗС',
      message: `"${s.name}"\nДействие необратимо. Если к АЗС привязаны сотрудники, привозы или отчёты — удаление будет отклонено.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/stations/${s.id}/`);
      await load();
      notify.success('АЗС удалена.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notify.error(formatErrors(data), { title: 'Не удалось удалить' });
    }
  };

  const isEdit = editingId !== null;

  return (
    <div className="page">
      <div className="sta-page-header">
        <h1>АЗС</h1>
        <button type="button" className="sta-add-btn" onClick={openCreate}>
          + Добавить АЗС
        </button>
      </div>

      <Modal open={modalOpen} onClose={closeModal}>
        <form className="sta-modal-form form-grid" onSubmit={submit} noValidate>
          <h2 className="span-2">{isEdit ? 'Изменить АЗС' : 'Добавить АЗС'}</h2>

          <label className="span-2">
            Название
            <input
              autoFocus
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label className="span-2">
            <span className="sta-field-label">
              Адрес
              <span className="sta-field-optional">необязательно</span>
            </span>
            <input
              maxLength={255}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>

          {error && (
            <div className="error span-2" style={{ whiteSpace: 'pre-line' }}>{error}</div>
          )}

          <div className="span-2">
            <button type="submit" disabled={saving}>
              {saving ? '...' : isEdit ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="card">
        <h2>Список</h2>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : list.length === 0 ? (
          <p className="muted">Пока пусто.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="sta-col-num">№</th>
                <th>Название</th>
                <th>Адрес</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id}>
                  <td className="sta-col-num sta-col-num-cell">{i + 1}</td>
                  <td>{s.name}</td>
                  <td>{s.address || <span className="muted">—</span>}</td>
                  <td>
                    <div className="sta-row-actions">
                      <button
                        type="button"
                        className="sta-icon-btn"
                        title="Редактировать"
                        onClick={() => openEdit(s)}
                        aria-label="Редактировать"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="sta-icon-btn danger"
                        title="Удалить"
                        onClick={() => deleteStation(s)}
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
        )}
      </div>

      <style>{stationsCss}</style>
    </div>
  );
}

const stationsCss = `
.sta-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}
.sta-page-header h1 { margin: 0; }

.sta-add-btn {
  flex-shrink: 0;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.sta-row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.sta-icon-btn {
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
.sta-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--panel);
}
.sta-icon-btn.danger {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
  border-color: transparent;
}
.sta-icon-btn.danger:hover:not(:disabled) {
  box-shadow: 0 8px 20px -4px rgba(248, 113, 113, 0.5);
}

.sta-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: sta-backdrop-in 0.22s ease;
  overflow-y: auto;
}
@keyframes sta-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.sta-modal-card {
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
  animation: sta-card-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes sta-card-in {
  from { opacity: 0; transform: scale(0.96) translateY(14px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
:root[data-theme="light"] .sta-modal-card {
  background: rgba(255, 255, 255, 0.96);
  border-color: var(--border-strong);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
}

.sta-modal-close {
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
.sta-modal-close:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.16);
  background-image: none;
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.4);
  transform: none;
  box-shadow: none;
}
:root[data-theme="light"] .sta-modal-close {
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
  border-color: var(--border);
}
:root[data-theme="light"] .sta-modal-close:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.3);
}

.sta-modal-form {
  margin: 0;
  border: none;
  padding: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  animation: none;
}

.sta-field-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.sta-field-optional {
  font-size: 10px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--muted);
  opacity: 0.75;
}

.sta-col-num {
  width: 60px;
  min-width: 44px;
  text-align: center;
}
.sta-col-num-cell {
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
`;
