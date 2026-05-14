import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type FuelType, type Paginated } from '../api/client';
import { useNotify } from '../components/Notify';
import BackButton from '../components/BackButton';

const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  unit: 'Единица',
  detail: 'Ошибка',
  non_field_errors: 'Ошибка',
};

const UNIT_OPTIONS: Array<{ value: 'L' | 'T'; label: string }> = [
  { value: 'L', label: 'Литры' },
  { value: 'T', label: 'Тонны' },
];

function unitLabel(unit: 'L' | 'T'): string {
  return UNIT_OPTIONS.find((o) => o.value === unit)?.label ?? unit;
}

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
      className="ft-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="ft-modal-card">
        <button
          type="button"
          className="ft-modal-close"
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

interface UnitDropdownProps {
  value: 'L' | 'T';
  onChange: (v: 'L' | 'T') => void;
}

function UnitDropdown({ value, onChange }: UnitDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = UNIT_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setHighlighted(UNIT_OPTIONS.findIndex((o) => o.value === value));
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, UNIT_OPTIONS.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < UNIT_OPTIONS.length) {
        onChange(UNIT_OPTIONS[highlighted].value);
        setOpen(false);
      }
    }
  };

  return (
    <div className="ft-dd-wrap" ref={containerRef}>
      <button
        type="button"
        className={`ft-dd-trigger${open ? ' is-open' : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          setHighlighted(UNIT_OPTIONS.findIndex((o) => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label}</span>
        <svg
          className={`ft-dd-chevron${open ? ' rotated' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="ft-dd-panel" role="listbox">
          {UNIT_OPTIONS.map((o, idx) => (
            <li
              key={o.value}
              className={`ft-dd-option${o.value === value ? ' selected' : ''}${idx === highlighted ? ' highlighted' : ''}`}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setHighlighted(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FuelTypes() {
  const notify = useNotify();
  const [list, setList] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; unit: 'L' | 'T' }>({ name: '', unit: 'L' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<Paginated<FuelType>>('/fuel-types/');
    setList(res.data.results);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ name: '', unit: 'L' });
    setError(null);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (f: FuelType) => {
    resetForm();
    setForm({ name: f.name, unit: f.unit });
    setEditingId(f.id);
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
      const payload = { name: form.name.trim(), unit: form.unit };
      if (isEdit) {
        await api.patch(`/fuel-types/${editingId}/`, payload);
      } else {
        await api.post('/fuel-types/', payload);
      }
      resetForm();
      setModalOpen(false);
      load();
      notify.success(isEdit ? 'Изменения сохранены.' : 'Вид топлива добавлен.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      setError(formatErrors(axiosErr?.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const deleteFuel = async (f: FuelType) => {
    const ok = await notify.confirm({
      title: 'Удалить вид топлива',
      message: `"${f.name}"\nДействие необратимо. Если вид топлива используется в привозах или отчётах — удаление будет отклонено.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/fuel-types/${f.id}/`);
      await load();
      notify.success('Вид топлива удалён.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notify.error(formatErrors(data), { title: 'Не удалось удалить' });
    }
  };

  const isEdit = editingId !== null;

  return (
    <div className="page">
      <div className="ft-page-header">
        <BackButton />
        <button type="button" className="ft-add-btn" onClick={openCreate}>
          + Добавить вид
        </button>
      </div>

      <Modal open={modalOpen} onClose={closeModal}>
        <form className="ft-modal-form form-grid" onSubmit={submit} noValidate>
          <h2 className="span-2">{isEdit ? 'Изменить вид топлива' : 'Добавить вид топлива'}</h2>

          <label className="span-2">
            Название
            <input
              autoFocus
              maxLength={50}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Например: АИ-92"
            />
          </label>

          <label className="span-2">
            Единица измерения
            <UnitDropdown value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
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
                <th className="ft-col-num">№</th>
                <th>Название</th>
                <th>Единица</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((f, i) => (
                <tr key={f.id}>
                  <td className="ft-col-num ft-col-num-cell">{i + 1}</td>
                  <td>{f.name}</td>
                  <td>{unitLabel(f.unit)}</td>
                  <td>
                    <div className="ft-row-actions">
                      <button
                        type="button"
                        className="ft-icon-btn"
                        title="Редактировать"
                        onClick={() => openEdit(f)}
                        aria-label="Редактировать"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="ft-icon-btn danger"
                        title="Удалить"
                        onClick={() => deleteFuel(f)}
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

      <style>{fuelCss}</style>
    </div>
  );
}

const fuelCss = `
.ft-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}
.ft-page-header h1 { margin: 0; }

.ft-add-btn {
  flex-shrink: 0;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.ft-row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.ft-icon-btn {
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
.ft-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--panel);
}
.ft-icon-btn.danger {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
  border-color: transparent;
}
.ft-icon-btn.danger:hover:not(:disabled) {
  box-shadow: 0 8px 20px -4px rgba(248, 113, 113, 0.5);
}

.ft-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: ft-backdrop-in 0.22s ease;
  overflow-y: auto;
}
@keyframes ft-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.ft-modal-card {
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
  animation: ft-card-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes ft-card-in {
  from { opacity: 0; transform: scale(0.96) translateY(14px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
:root[data-theme="light"] .ft-modal-card {
  background: rgba(255, 255, 255, 0.96);
  border-color: var(--border-strong);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
}

.ft-modal-close {
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
.ft-modal-close:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.16);
  background-image: none;
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.4);
  transform: none;
  box-shadow: none;
}
:root[data-theme="light"] .ft-modal-close {
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
  border-color: var(--border);
}
:root[data-theme="light"] .ft-modal-close:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.3);
}

.ft-modal-form {
  margin: 0;
  border: none;
  padding: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  animation: none;
}

.ft-dd-wrap { position: relative; }
.ft-dd-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 13px;
  font-size: 15px;
  font-family: inherit;
  font-weight: 400;
  min-height: 42px;
  background: var(--panel-2);
  background-image: none;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: none;
  transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  text-align: left;
}
.ft-dd-trigger:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  background-image: none;
  border-color: var(--border-strong);
  transform: none;
  box-shadow: none;
}
.ft-dd-trigger.is-open,
.ft-dd-trigger:focus {
  outline: none;
  border-color: rgba(74, 222, 128, 0.55);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.15);
  background-image: none;
}
:root[data-theme="light"] .ft-dd-trigger {
  background: rgba(15, 23, 42, 0.04);
  border-color: var(--border);
  color: var(--text);
}
:root[data-theme="light"] .ft-dd-trigger:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.07);
}
:root[data-theme="light"] .ft-dd-trigger.is-open,
:root[data-theme="light"] .ft-dd-trigger:focus {
  background: #fff;
  border-color: rgba(74, 222, 128, 0.6);
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.18);
}
.ft-dd-chevron {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--muted);
  transition: transform 0.2s ease;
}
.ft-dd-chevron.rotated { transform: rotate(180deg); }

.ft-dd-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 240px;
  overflow-y: auto;
  background: rgba(20, 24, 42, 0.95);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  animation: ft-dd-in 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes ft-dd-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
:root[data-theme="light"] .ft-dd-panel {
  background: rgba(255, 255, 255, 0.97);
  border-color: var(--border-strong);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
}

.ft-dd-option {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s;
  user-select: none;
}
.ft-dd-option:hover,
.ft-dd-option.highlighted {
  background: rgba(255, 255, 255, 0.07);
}
.ft-dd-option.selected {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.20), rgba(56, 189, 248, 0.14));
  color: #d8ffe6;
  font-weight: 600;
}
.ft-dd-option.selected.highlighted {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.28), rgba(56, 189, 248, 0.20));
}
:root[data-theme="light"] .ft-dd-option { color: var(--text); }
:root[data-theme="light"] .ft-dd-option:hover,
:root[data-theme="light"] .ft-dd-option.highlighted {
  background: rgba(15, 23, 42, 0.05);
}
:root[data-theme="light"] .ft-dd-option.selected {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.20), rgba(56, 189, 248, 0.14));
  color: #047857;
}

.ft-col-num {
  width: 60px;
  min-width: 44px;
  text-align: center;
}
.ft-col-num-cell {
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
`;
