import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type Employee, type Paginated, type Station } from '../api/client';
import { useNotify } from '../components/Notify';
import BackButton from '../components/BackButton';

const FIELD_LABELS: Record<string, string> = {
  full_name: 'ФИО',
  telegram_id: 'Telegram ID',
  station: 'АЗС',
  birth_date: 'Дата рождения',
  phone: 'Телефон',
  address: 'Адрес',
  passport_front: 'Паспорт (лицевая)',
  passport_back: 'Паспорт (прописка)',
  username: 'Логин',
  new_password: 'Пароль',
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Inline Modal helper ─────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ open, onClose, children }: ModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
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
      className="emp-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="emp-modal-card">
        <button
          type="button"
          className="emp-modal-close"
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

// ── Custom Station Dropdown ─────────────────────────────────────────────────
interface StationDropdownProps {
  stations: Station[];
  value: string;
  onChange: (id: string) => void;
}

function StationDropdown({ stations, value, onChange }: StationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = stations.find((s) => String(s.id) === value);

  // Close on outside click
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
        setHighlighted(0);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, stations.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < stations.length) {
        onChange(String(stations[highlighted].id));
        setOpen(false);
      }
    }
  };

  return (
    <div className="emp-dd-wrap" ref={containerRef}>
      <button
        type="button"
        className={`emp-dd-trigger${open ? ' is-open' : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          setHighlighted(-1);
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'emp-dd-placeholder'}>
          {selected ? selected.name : 'Выберите АЗС'}
        </span>
        <svg
          className={`emp-dd-chevron${open ? ' rotated' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="emp-dd-panel" role="listbox">
          {stations.length === 0 && (
            <li className="emp-dd-empty">Нет доступных АЗС</li>
          )}
          {stations.map((s, idx) => (
            <li
              key={s.id}
              className={`emp-dd-option${String(s.id) === value ? ' selected' : ''}${idx === highlighted ? ' highlighted' : ''}`}
              role="option"
              aria-selected={String(s.id) === value}
              onMouseEnter={() => setHighlighted(idx)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before selection
                onChange(String(s.id));
                setOpen(false);
              }}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Passport Upload Row ─────────────────────────────────────────────────────
interface PassportUploadProps {
  label: string;
  optional?: boolean;
  file: File | null;
  preview: string | null;
  inputKey: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  idPrefix: string;
  existingUrl?: string | null;
}

function PassportUpload({
  label,
  optional,
  file,
  preview,
  inputKey,
  fileInputRef,
  cameraInputRef,
  onPick,
  onClear,
  idPrefix,
  existingUrl,
}: PassportUploadProps) {
  return (
    <div className="emp-passport-wrap">
      <span className="emp-passport-label">
        {label}
        {optional && <span className="emp-field-optional">{' '}необязательно</span>}
      </span>
      {existingUrl && !file && (
        <p className="emp-existing-file">Файл загружен (заменить — выберите новый)</p>
      )}
      {!file ? (
        <div className="emp-passport-btns">
          <button
            type="button"
            className="emp-passport-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Загрузить файл
          </button>
          <button
            type="button"
            className="emp-passport-btn"
            onClick={() => cameraInputRef.current?.click()}
          >
            📷 Сфотографировать
          </button>
        </div>
      ) : (
        <div className="emp-passport-preview-row">
          {preview && (
            <img
              src={preview}
              alt={`${label} — предпросмотр`}
              className="emp-passport-thumb"
            />
          )}
          <div className="emp-passport-info">
            <span className="emp-passport-fname">{file.name}</span>
            <button
              type="button"
              className="emp-passport-clear"
              onClick={onClear}
              aria-label={`Удалить ${label}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        id={`${idPrefix}-file`}
        type="file"
        accept="image/jpeg,image/png"
        key={`${idPrefix}-file-${inputKey}`}
        style={{ display: 'none' }}
        onChange={onPick}
        aria-label={`${label} — выбрать файл`}
      />
      <input
        ref={cameraInputRef}
        id={`${idPrefix}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        key={`${idPrefix}-camera-${inputKey}`}
        style={{ display: 'none' }}
        onChange={onPick}
        aria-label={`${label} — сфотографировать`}
      />
    </div>
  );
}

// ── Passport viewer side ────────────────────────────────────────────────────
function PassportSide({ label, url, placeholder }: { label: string; url: string | null; placeholder: boolean }) {
  return (
    <div className="emp-passport-side">
      <div className="emp-passport-side-label">{label}</div>
      {placeholder ? (
        <div className="emp-passport-empty">Не загружено</div>
      ) : url ? (
        <img src={url} alt={label} className="emp-passport-img" />
      ) : (
        <div className="emp-passport-loading">…</div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Employees() {
  const notify = useNotify();
  const [stations, setStations] = useState<Station[]>([]);
  const [list, setList] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Track existing passport URLs when editing (so we can show the "file loaded" hint)
  const [editingPassportFront, setEditingPassportFront] = useState<string | null>(null);
  const [editingPassportBack, setEditingPassportBack] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    telegram_id: '',
    station: '',
    birth_date: '',
    phone: '',
    address: '',
    username: '',
    password: '',
  });
  const [showPwd, setShowPwd] = useState(false);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passport viewer modal state
  const [passportEmp, setPassportEmp] = useState<Employee | null>(null);
  const [frontBlobUrl, setFrontBlobUrl] = useState<string | null>(null);
  const [backBlobUrl, setBackBlobUrl] = useState<string | null>(null);
  const [passportLoading, setPassportLoading] = useState(false);
  const [passportErr, setPassportErr] = useState<string | null>(null);

  // Refs for hidden file inputs
  const frontFileRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount or when previews change
  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
    };
  }, [frontPreview, backPreview]);

  const load = async () => {
    const res = await api.get<Paginated<Employee>>('/employees/');
    setList(res.data.results);
  };

  useEffect(() => {
    api.get<Paginated<Station>>('/stations/').then((r) => setStations(r.data.results));
    load();
  }, []);

  const pickFile = (
    setFile: (f: File | null) => void,
    setPreview: (u: string | null) => void,
    prev: string | null,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      if (prev) URL.revokeObjectURL(prev);
      setFile(null);
      setPreview(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Файл больше 5 МБ.');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      setError('Только JPEG или PNG.');
      return;
    }
    setError(null);
    if (prev) URL.revokeObjectURL(prev);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFront = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setFrontFile(null);
    setFrontPreview(null);
    setFileInputKey((k) => k + 1);
  };

  const clearBack = () => {
    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(null);
    setBackPreview(null);
    setFileInputKey((k) => k + 1);
  };

  const resetFormState = () => {
    setForm({ full_name: '', telegram_id: '', station: '', birth_date: '', phone: '', address: '', username: '', password: '' });
    setShowPwd(false);
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview(null);
    setBackPreview(null);
    setFileInputKey((k) => k + 1);
    setError(null);
    setEditingId(null);
    setEditingPassportFront(null);
    setEditingPassportBack(null);
  };

  const openCreate = () => {
    resetFormState();
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    resetFormState();
    setForm({
      full_name: emp.full_name,
      telegram_id: emp.telegram_id != null ? String(emp.telegram_id) : '',
      station: emp.station != null ? String(emp.station) : '',
      birth_date: emp.birth_date ?? '',
      phone: emp.phone ?? '',
      address: emp.address ?? '',
      username: emp.user_username ?? '',
      password: '',
    });
    setEditingId(emp.id);
    setEditingPassportFront(emp.passport_front);
    setEditingPassportBack(emp.passport_back);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setEditingPassportFront(null);
    setEditingPassportBack(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isEdit = editingId !== null;

    const missing: string[] = [];
    if (!form.full_name) missing.push('ФИО');
    if (!isEdit && !form.username) missing.push('Логин');
    if (!isEdit && !form.password) missing.push('Пароль');
    if (missing.length) {
      setError('Заполните поля: ' + missing.join(', '));
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('full_name', form.full_name);

      if (!isEdit) {
        fd.append('username', form.username);
        fd.append('new_password', form.password);
        fd.append('is_active', 'true');
      }

      // In edit mode, include new_password only when the field is non-empty
      if (isEdit && form.password) {
        fd.append('new_password', form.password);
      }

      // Optional fields: only append if non-empty (avoids int-conversion errors server side)
      if (form.telegram_id) fd.append('telegram_id', form.telegram_id);
      if (form.station) fd.append('station', form.station);
      if (form.birth_date) fd.append('birth_date', form.birth_date);

      // Text fields: append even if empty — backend accepts blank strings
      fd.append('phone', form.phone);
      fd.append('address', form.address);

      // Photos: only append if a new file was picked
      if (frontFile) fd.append('passport_front', frontFile);
      if (backFile) fd.append('passport_back', backFile);

      if (isEdit) {
        await api.patch(`/employees/${editingId}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/employees/', fd);
      }

      resetFormState();
      setModalOpen(false);
      load();
      notify.success(isEdit ? 'Изменения сохранены.' : 'Сотрудник добавлен.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      const formatted = formatErrors(axiosErr?.response?.data);
      setError(formatted);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (e: Employee) => {
    try {
      await api.patch(`/employees/${e.id}/`, { is_active: !e.is_active });
      await load();
      notify.success(e.is_active ? 'Сотрудник отключён.' : 'Сотрудник включён.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notify.error(formatErrors(data), { title: 'Не удалось изменить статус' });
    }
  };

  const deleteEmployee = async (emp: Employee) => {
    const ok = await notify.confirm({
      title: 'Удалить сотрудника',
      message: `"${emp.full_name}"\nЭто удалит также его учётную запись в CRM и фото паспортов. Действие необратимо. Если у сотрудника есть отчёты — удаление невозможно.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/employees/${emp.id}/`);
      await load();
      notify.success('Сотрудник удалён.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      notify.error(formatErrors(data), { title: 'Не удалось удалить' });
    }
  };

  async function openPassportModal(emp: Employee) {
    setPassportEmp(emp);
    setFrontBlobUrl(null);
    setBackBlobUrl(null);
    setPassportErr(null);
    setPassportLoading(true);
    try {
      const tasks: Promise<void>[] = [];
      if (emp.passport_front) {
        tasks.push(
          api.get(emp.passport_front, { responseType: 'blob' }).then((r) => {
            setFrontBlobUrl(URL.createObjectURL(r.data));
          }),
        );
      }
      if (emp.passport_back) {
        tasks.push(
          api.get(emp.passport_back, { responseType: 'blob' }).then((r) => {
            setBackBlobUrl(URL.createObjectURL(r.data));
          }),
        );
      }
      await Promise.all(tasks);
    } catch (err: unknown) {
      setPassportErr('Не удалось загрузить фото.');
    } finally {
      setPassportLoading(false);
    }
  }

  function closePassportModal() {
    if (frontBlobUrl) URL.revokeObjectURL(frontBlobUrl);
    if (backBlobUrl) URL.revokeObjectURL(backBlobUrl);
    setFrontBlobUrl(null);
    setBackBlobUrl(null);
    setPassportEmp(null);
    setPassportErr(null);
  }

  const isEdit = editingId !== null;

  return (
    <div className="page">
      {/* Page header */}
      <div className="emp-page-header">
        <BackButton />
        <button
          type="button"
          className="emp-add-btn"
          onClick={openCreate}
        >
          + Добавить сотрудника
        </button>
      </div>

      {/* Create / Edit employee modal */}
      <Modal open={modalOpen} onClose={closeModal}>
        <form className="emp-modal-form form-grid" onSubmit={submit} noValidate>
          <h2 className="span-2">
            {isEdit ? 'Изменить сотрудника' : 'Добавить сотрудника'}
          </h2>

          <label>
            ФИО
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </label>

          <label>
            <span className="emp-field-label">
              TELEGRAM ID
              <span className="emp-field-optional">необязательно</span>
            </span>
            <input
              type="number"
              value={form.telegram_id}
              onChange={(e) => setForm({ ...form, telegram_id: e.target.value })}
            />
          </label>

          <label>
            <span className="emp-field-label">
              АЗС
              <span className="emp-field-optional">необязательно</span>
            </span>
            <StationDropdown
              stations={stations}
              value={form.station}
              onChange={(id) => setForm({ ...form, station: id })}
            />
          </label>

          <label>
            <span className="emp-field-label">
              Дата рождения
              <span className="emp-field-optional">необязательно</span>
            </span>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </label>

          <label>
            <span className="emp-field-label">
              Телефон
              <span className="emp-field-optional">необязательно</span>
            </span>
            <input
              type="tel"
              inputMode="tel"
              maxLength={20}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>

          <label>
            <span className="emp-field-label">
              Адрес
              <span className="emp-field-optional">необязательно</span>
            </span>
            <input
              maxLength={255}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>

          <label>
            Логин
            <input
              value={form.username}
              disabled={isEdit}
              aria-disabled={isEdit}
              style={isEdit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              onChange={(e) => !isEdit && setForm({ ...form, username: e.target.value })}
            />
          </label>

          <label>
            <span className="emp-field-label">
              {isEdit ? 'Новый пароль' : 'Пароль'}
              {isEdit && <span className="emp-field-optional">необязательно</span>}
            </span>
            <div className="go-pwd-wrap">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete={isEdit ? 'new-password' : 'new-password'}
              />
              <button
                type="button"
                className="go-pwd-toggle"
                onClick={() => setShowPwd((s) => !s)}
                tabIndex={-1}
                aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {isEdit && (
              <span className="emp-field-optional emp-pwd-hint">
                необязательно — оставьте пустым, чтобы не менять
              </span>
            )}
          </label>

          <div className="span-2">
            <PassportUpload
              label="Паспорт (лицевая)"
              optional
              file={frontFile}
              preview={frontPreview}
              inputKey={fileInputKey}
              fileInputRef={frontFileRef}
              cameraInputRef={frontCameraRef}
              onPick={pickFile(setFrontFile, setFrontPreview, frontPreview)}
              onClear={clearFront}
              idPrefix="passport-front"
              existingUrl={editingPassportFront}
            />
          </div>

          <div className="span-2">
            <PassportUpload
              label="Паспорт (прописка)"
              optional
              file={backFile}
              preview={backPreview}
              inputKey={fileInputKey}
              fileInputRef={backFileRef}
              cameraInputRef={backCameraRef}
              onPick={pickFile(setBackFile, setBackPreview, backPreview)}
              onClear={clearBack}
              idPrefix="passport-back"
              existingUrl={editingPassportBack}
            />
          </div>

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

      {/* Passport viewer modal */}
      <Modal open={passportEmp !== null} onClose={closePassportModal}>
        <div className="emp-passport-modal">
          <div className="emp-passport-modal-head">
            <h3>Паспорт — {passportEmp?.full_name}</h3>
          </div>
          {passportLoading ? (
            <div className="emp-passport-loading">Загрузка…</div>
          ) : null}
          {passportErr ? (
            <div className="error">{passportErr}</div>
          ) : null}
          {!passportLoading && !passportErr ? (
            <div className="emp-passport-grid">
              <PassportSide
                label="Лицевая"
                url={frontBlobUrl}
                placeholder={!passportEmp?.passport_front}
              />
              <PassportSide
                label="Прописка"
                url={backBlobUrl}
                placeholder={!passportEmp?.passport_back}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Employees list */}
      <div className="card">
        <h2>Список</h2>
        {list.length === 0 ? (
          <p className="muted">Пока пусто.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="emp-col-num">№</th>
                <th>ФИО</th>
                <th>Telegram ID</th>
                <th>АЗС</th>
                <th>Логин</th>
                <th>Дата рожд.</th>
                <th>Паспорт</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e, i) => {
                const hasPassport = e.passport_front !== null || e.passport_back !== null;
                return (
                  <tr key={e.id}>
                    <td className="emp-col-num emp-col-num-cell">{i + 1}</td>
                    <td>{e.full_name}</td>
                    <td>{e.telegram_id}</td>
                    <td>{e.station_name}</td>
                    <td>{e.user_username ?? '—'}</td>
                    <td>{fmtDate(e.birth_date)}</td>
                    <td>
                      {hasPassport ? (
                        <button
                          type="button"
                          className="emp-icon-btn"
                          title="Просмотреть паспорт"
                          onClick={() => openPassportModal(e)}
                          aria-label="Просмотреть паспорт"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="emp-icon-btn"
                          title="Паспорт не загружен"
                          disabled
                          aria-label="Паспорт не загружен"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`emp-status-btn ${e.is_active ? 'is-active' : 'is-inactive'}`}
                        onClick={() => toggle(e)}
                        aria-label={e.is_active ? 'Отключить сотрудника' : 'Включить сотрудника'}
                      >
                        {e.is_active ? 'активен' : 'отключён'}
                      </button>
                    </td>
                    <td>
                      <div className="emp-row-actions">
                        <button
                          type="button"
                          className="emp-icon-btn"
                          title="Редактировать"
                          onClick={() => openEdit(e)}
                          aria-label="Редактировать"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="emp-icon-btn danger"
                          title="Удалить"
                          onClick={() => deleteEmployee(e)}
                          aria-label="Удалить"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                            <path d="M3 6h18"/>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
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

      <style>{employeesCss}</style>
    </div>
  );
}

const employeesCss = `
/* ── Page header ─────────────────────────────────────────────────────── */
.emp-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}
.emp-page-header h1 {
  margin: 0;
}

.emp-add-btn {
  flex-shrink: 0;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

/* ── Row action buttons container ────────────────────────────────────── */
.emp-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

/* ── Icon buttons (edit / delete / passport) ─────────────────────────── */
.emp-icon-btn {
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
.emp-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--panel);
}
.emp-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.emp-icon-btn.danger {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
  border-color: transparent;
}
.emp-icon-btn.danger:hover:not(:disabled) {
  box-shadow: 0 8px 20px -4px rgba(248, 113, 113, 0.5);
}

/* ── Clickable status badge button ───────────────────────────────────── */
.emp-status-btn {
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
.emp-status-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.emp-status-btn.is-active {
  color: #16a34a;
  background: rgba(74, 222, 128, 0.12);
  border-color: rgba(74, 222, 128, 0.5);
}
.emp-status-btn.is-active:hover:not(:disabled) {
  background: rgba(74, 222, 128, 0.22);
}
.emp-status-btn.is-inactive {
  color: #d97706;
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.5);
}
.emp-status-btn.is-inactive:hover:not(:disabled) {
  background: rgba(250, 204, 21, 0.24);
}

/* ── Edit mode hints ─────────────────────────────────────────────────── */
.emp-existing-file {
  font-size: 12px;
  color: var(--accent);
  margin-bottom: 6px;
}
.emp-pwd-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}

/* ── Modal backdrop ──────────────────────────────────────────────────── */
.emp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: emp-backdrop-in 0.22s ease;
  overflow-y: auto;
}

@keyframes emp-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Modal card ──────────────────────────────────────────────────────── */
.emp-modal-card {
  position: relative;
  width: 100%;
  max-width: 640px;
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
  animation: emp-card-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes emp-card-in {
  from { opacity: 0; transform: scale(0.96) translateY(14px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

:root[data-theme="light"] .emp-modal-card {
  background: rgba(255, 255, 255, 0.96);
  border-color: var(--border-strong);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
}

/* ── Modal close button ──────────────────────────────────────────────── */
.emp-modal-close {
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
.emp-modal-close:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.16);
  background-image: none;
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.4);
  transform: none;
  box-shadow: none;
}

:root[data-theme="light"] .emp-modal-close {
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
  border-color: var(--border);
}
:root[data-theme="light"] .emp-modal-close:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.3);
}

/* ── Modal form ──────────────────────────────────────────────────────── */
.emp-modal-form {
  margin: 0;
  border: none;
  padding: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  animation: none;
}

/* ── Station custom dropdown ─────────────────────────────────────────── */
.emp-dd-wrap {
  position: relative;
}

.emp-dd-trigger {
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
.emp-dd-trigger:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  background-image: none;
  border-color: var(--border-strong);
  transform: none;
  box-shadow: none;
}
.emp-dd-trigger.is-open,
.emp-dd-trigger:focus {
  outline: none;
  border-color: rgba(74, 222, 128, 0.55);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.15);
  background-image: none;
}

:root[data-theme="light"] .emp-dd-trigger {
  background: rgba(15, 23, 42, 0.04);
  border-color: var(--border);
  color: var(--text);
}
:root[data-theme="light"] .emp-dd-trigger:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.07);
}
:root[data-theme="light"] .emp-dd-trigger.is-open,
:root[data-theme="light"] .emp-dd-trigger:focus {
  background: #fff;
  border-color: rgba(74, 222, 128, 0.6);
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.18);
}

.emp-dd-placeholder {
  color: rgba(255, 255, 255, 0.30);
}
:root[data-theme="light"] .emp-dd-placeholder {
  color: rgba(15, 23, 42, 0.35);
}

.emp-dd-chevron {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--muted);
  transition: transform 0.2s ease;
}
.emp-dd-chevron.rotated {
  transform: rotate(180deg);
}

.emp-dd-panel {
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
  animation: emp-dd-in 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes emp-dd-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

:root[data-theme="light"] .emp-dd-panel {
  background: rgba(255, 255, 255, 0.97);
  border-color: var(--border-strong);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
}

.emp-dd-option {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s;
  user-select: none;
}
.emp-dd-option:hover,
.emp-dd-option.highlighted {
  background: rgba(255, 255, 255, 0.07);
}
.emp-dd-option.selected {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.20), rgba(56, 189, 248, 0.14));
  color: #d8ffe6;
  font-weight: 600;
}
.emp-dd-option.selected.highlighted {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.28), rgba(56, 189, 248, 0.20));
}

:root[data-theme="light"] .emp-dd-option { color: var(--text); }
:root[data-theme="light"] .emp-dd-option:hover,
:root[data-theme="light"] .emp-dd-option.highlighted {
  background: rgba(15, 23, 42, 0.05);
}
:root[data-theme="light"] .emp-dd-option.selected {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.20), rgba(56, 189, 248, 0.14));
  color: #047857;
}

.emp-dd-empty {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}

/* ── Passport upload ─────────────────────────────────────────────────── */
.emp-passport-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emp-passport-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.emp-passport-btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.emp-passport-btn {
  flex: 1 1 auto;
  min-width: 160px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.emp-passport-preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-2);
}

.emp-passport-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.emp-passport-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.emp-passport-fname {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emp-passport-clear {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  min-height: 0;
  padding: 0;
  font-size: 13px;
  border-radius: 50%;
  background: rgba(248, 113, 113, 0.12);
  background-image: none;
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fca5a5;
  display: grid;
  place-items: center;
  box-shadow: none;
  transition: background 0.18s, color 0.18s, transform 0.15s;
}
.emp-passport-clear:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.22);
  background-image: none;
  color: #f87171;
  transform: none;
  box-shadow: none;
}

:root[data-theme="light"] .emp-passport-clear {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.28);
  color: #b91c1c;
}
:root[data-theme="light"] .emp-passport-clear:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.14);
}

/* ── Optional field label hint ───────────────────────────────────────── */
.emp-field-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.emp-field-optional {
  font-size: 10px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--muted);
  opacity: 0.75;
}

/* ── Password eye toggle (self-contained, mirrors Login.tsx pattern) ─── */
.go-pwd-wrap { position: relative; }
.go-pwd-wrap input { padding-right: 44px; }
.go-pwd-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  min-height: 0;
  padding: 0;
  background: transparent;
  background-image: none;
  border: none;
  box-shadow: none;
  font-size: 16px;
  cursor: pointer;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text);
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s;
}
.go-pwd-toggle:hover:not(:disabled) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
  background-image: none;
  transform: translateY(-50%);
  box-shadow: none;
}

/* ── Passport viewer modal ───────────────────────────────────────────── */
.emp-passport-modal {
  padding-top: 4px;
}
.emp-passport-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.emp-passport-modal-head h3 {
  margin: 0;
  font-size: 17px;
}
.emp-passport-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 640px) {
  .emp-passport-grid { grid-template-columns: 1fr; }
}
.emp-passport-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.emp-passport-side-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted);
}
.emp-passport-img {
  width: 100%;
  height: auto;
  max-height: 480px;
  object-fit: contain;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
}
.emp-passport-empty,
.emp-passport-loading {
  display: grid;
  place-items: center;
  min-height: 200px;
  border-radius: 12px;
  border: 1px dashed var(--border);
  color: var(--muted);
  font-size: 13px;
}

/* ── Row number column ───────────────────────────────────────────────────── */
.emp-col-num {
  width: 60px;
  min-width: 44px;
  text-align: center;
}
.emp-col-num-cell {
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
`;
