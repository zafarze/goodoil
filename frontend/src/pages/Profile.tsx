import { useEffect, useRef, useState } from 'react';
import { api, type UserProfile } from '../api/client';
import { useNotify } from '../components/Notify';

// ── Helpers ─────────────────────────────────────────────────────────────────

const FIELD_LABELS_PROFILE: Record<string, string> = {
  full_name: 'ФИО',
  phone: 'Телефон',
  address: 'Адрес',
  birth_date: 'Дата рождения',
  photo: 'Фото',
  current_password: 'Текущий пароль',
  new_password: 'Новый пароль',
  non_field_errors: 'Ошибка',
};

function formatErrors(data: unknown): string {
  if (!data) return 'Ошибка';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const label = FIELD_LABELS_PROFILE[k] ?? k;
    const msg = Array.isArray(v) ? v.join(', ') : String(v);
    lines.push(`${label}: ${msg}`);
  }
  return lines.join('\n');
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Profile() {
  const notify = useNotify();

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal data form
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    birth_date: '',
  });
  const [saving, setSaving] = useState(false);

  // Photo state
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  // Password form
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Refs for hidden file inputs
  const photoFileRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);

  // Track current photoBlobUrl for cleanup
  const photoBlobUrlRef = useRef<string | null>(null);

  async function refetchPhotoBlob(p: UserProfile) {
    // Revoke previous saved blob URL
    if (photoBlobUrlRef.current) {
      URL.revokeObjectURL(photoBlobUrlRef.current);
      photoBlobUrlRef.current = null;
    }
    if (p.photo) {
      try {
        const blob = await api.get(p.photo, { responseType: 'blob' });
        const url = URL.createObjectURL(blob.data as Blob);
        photoBlobUrlRef.current = url;
        setPhotoBlobUrl(url);
      } catch {
        setPhotoBlobUrl(null);
      }
    } else {
      setPhotoBlobUrl(null);
    }
  }

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await api.get<UserProfile>('/profile/me/');
      const p = res.data;
      setProfile(p);
      setForm({
        full_name: p.full_name,
        phone: p.phone,
        address: p.address,
        birth_date: p.birth_date ?? '',
      });
      await refetchPhotoBlob(p);
    } catch {
      notify.error('Не удалось загрузить профиль.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
    return () => {
      // Cleanup all blob URLs on unmount
      if (photoBlobUrlRef.current) {
        URL.revokeObjectURL(photoBlobUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup newPhotoPreview when it changes
  const newPhotoPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    newPhotoPreviewRef.current = newPhotoPreview;
  }, [newPhotoPreview]);

  useEffect(() => {
    return () => {
      if (newPhotoPreviewRef.current) {
        URL.revokeObjectURL(newPhotoPreviewRef.current);
      }
    };
  }, []);

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      notify.error('Файл больше 5 МБ.');
      return;
    }
    if (!f.type.toLowerCase().startsWith('image/')) {
      notify.error(`Это не изображение (тип: ${f.type || 'неизвестный'}).`);
      return;
    }
    // Revoke old preview
    if (newPhotoPreview) {
      URL.revokeObjectURL(newPhotoPreview);
    }
    const url = URL.createObjectURL(f);
    setNewPhotoFile(f);
    setNewPhotoPreview(url);
  };

  const clearPhoto = () => {
    if (newPhotoPreview) {
      URL.revokeObjectURL(newPhotoPreview);
    }
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    setPhotoInputKey((k) => k + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('full_name', form.full_name);
      fd.append('phone', form.phone);
      fd.append('address', form.address);
      if (form.birth_date) fd.append('birth_date', form.birth_date);
      if (newPhotoFile) fd.append('photo', newPhotoFile);
      const res = await api.patch<UserProfile>('/profile/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify.success('Профиль сохранён.');
      // Reset photo selection state
      if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
      setPhotoInputKey((k) => k + 1);
      setProfile(res.data);
      setForm({
        full_name: res.data.full_name,
        phone: res.data.phone,
        address: res.data.address,
        birth_date: res.data.birth_date ?? '',
      });
      await refetchPhotoBlob(res.data);
    } catch (err: unknown) {
      notify.error(formatErrors((err as { response?: { data?: unknown } })?.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next || !confirm) {
      notify.error('Заполните все поля.');
      return;
    }
    if (next !== confirm) {
      notify.error('Новые пароли не совпадают.');
      return;
    }
    setSavingPwd(true);
    try {
      await api.post('/profile/me/change-password/', { current_password: current, new_password: next });
      notify.success('Пароль обновлён.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err: unknown) {
      notify.error(formatErrors((err as { response?: { data?: unknown } })?.response?.data));
    } finally {
      setSavingPwd(false);
    }
  };

  // What to display as avatar
  const avatarSrc = newPhotoPreview ?? photoBlobUrl;
  const fallbackInitial = (profile?.full_name || profile?.username || '?').slice(0, 1).toUpperCase();

  return (
    <div className="page">
      <h1>Профиль</h1>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="prof-cards">
          {/* ── Card 1: Personal data ─────────────────────────────────── */}
          <div className="prof-card">
            <h2>Личные данные</h2>
            <form onSubmit={submit} noValidate>
              {/* Photo uploader */}
              <div className="prof-photo-wrap">
                <div className="prof-avatar-ring">
                  <div className="prof-avatar">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Фото профиля" />
                    ) : (
                      <span>{fallbackInitial}</span>
                    )}
                  </div>
                </div>
                {!newPhotoFile ? (
                  <div className="prof-photo-btns">
                    <button
                      type="button"
                      className="emp-passport-btn"
                      onClick={() => photoFileRef.current?.click()}
                    >
                      📁 Загрузить файл
                    </button>
                    <button
                      type="button"
                      className="emp-passport-btn"
                      onClick={() => photoCameraRef.current?.click()}
                    >
                      📷 Сфотографировать
                    </button>
                  </div>
                ) : (
                  <div className="prof-photo-preview-row">
                    <span className="emp-passport-fname">{newPhotoFile.name}</span>
                    <button
                      type="button"
                      className="emp-passport-clear"
                      onClick={clearPhoto}
                      aria-label="Удалить выбранное фото"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <input
                  ref={photoFileRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  key={`photo-file-${photoInputKey}`}
                  style={{ display: 'none' }}
                  onChange={pickPhoto}
                  aria-label="Выбрать фото профиля из файлов"
                />
                <input
                  ref={photoCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  key={`photo-camera-${photoInputKey}`}
                  style={{ display: 'none' }}
                  onChange={pickPhoto}
                  aria-label="Сфотографировать для профиля"
                />
              </div>

              {/* Form grid */}
              <div className="prof-form-grid">
                <label className="prof-label">
                  <span>ФИО</span>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Иванов Иван Иванович"
                  />
                </label>

                <label className="prof-label">
                  <span>Логин</span>
                  <input
                    value={profile?.username ?? ''}
                    disabled
                    aria-disabled="true"
                    style={{ opacity: 0.55, cursor: 'not-allowed' }}
                    readOnly
                  />
                </label>

                <label className="prof-label">
                  <span>Телефон</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={20}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </label>

                <label className="prof-label">
                  <span>Адрес</span>
                  <input
                    maxLength={255}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="г. Ташкент, ул. Амира Темура 1"
                  />
                </label>

                <label className="prof-label">
                  <span>Дата рождения</span>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  />
                </label>
              </div>

              <div className="prof-submit-row">
                <button type="submit" disabled={saving} className="prof-btn-save">
                  {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Card 2: Change password ───────────────────────────────── */}
          <div className="prof-card">
            <h2>Смена пароля</h2>
            <form onSubmit={submitPassword} noValidate>
              <div className="prof-form-col">
                <label className="prof-label">
                  <span>Текущий пароль</span>
                  <div className="go-pwd-wrap">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="go-pwd-toggle"
                      onClick={() => setShowCurrent((s) => !s)}
                      tabIndex={-1}
                      aria-label={showCurrent ? 'Скрыть текущий пароль' : 'Показать текущий пароль'}
                    >
                      {showCurrent ? '🙈' : '👁️'}
                    </button>
                  </div>
                </label>

                <label className="prof-label">
                  <span>Новый пароль</span>
                  <div className="go-pwd-wrap">
                    <input
                      type={showNext ? 'text' : 'password'}
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="go-pwd-toggle"
                      onClick={() => setShowNext((s) => !s)}
                      tabIndex={-1}
                      aria-label={showNext ? 'Скрыть новый пароль' : 'Показать новый пароль'}
                    >
                      {showNext ? '🙈' : '👁️'}
                    </button>
                  </div>
                </label>

                <label className="prof-label">
                  <span>Повторите новый пароль</span>
                  <div className="go-pwd-wrap">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="go-pwd-toggle"
                      onClick={() => setShowConfirm((s) => !s)}
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Скрыть подтверждение пароля' : 'Показать подтверждение пароля'}
                    >
                      {showConfirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                </label>
              </div>

              <div className="prof-submit-row">
                <button type="submit" disabled={savingPwd} className="prof-btn-save">
                  {savingPwd ? 'Сохраняем…' : 'Сменить пароль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{profileCss}</style>
    </div>
  );
}

const profileCss = `
/* ── Two cards stacked vertically ─────────────────────────────────────── */
.prof-cards {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ── Card shell ───────────────────────────────────────────────────────── */
.prof-card {
  padding: 24px;
  border-radius: 18px;
  background: var(--panel);
  border: 1px solid var(--border);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
}
.prof-card h2 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

:root[data-theme="light"] .prof-card {
  background: rgba(255, 255, 255, 0.92);
  border-color: var(--border);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.07), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
}

/* ── Avatar / photo area ──────────────────────────────────────────────── */
.prof-photo-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.prof-avatar-ring {
  position: relative;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #4ade80, #38bdf8, #a855f7, #facc15, #4ade80);
  animation: prof-ring-rotate 6s linear infinite;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
@keyframes prof-ring-rotate {
  to { transform: rotate(360deg); }
}

.prof-avatar {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: var(--grad-btn);
  background-size: 200% 200%;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 36px;
  font-weight: 800;
  color: #04210d;
  box-shadow: 0 4px 16px rgba(74, 222, 128, 0.35);
}
.prof-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.prof-photo-btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.prof-photo-preview-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-2);
  max-width: 340px;
  width: 100%;
}

/* ── Form grid (2 cols on desktop, 1 on mobile) ───────────────────────── */
.prof-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 640px) {
  .prof-form-grid { grid-template-columns: 1fr; }
}

/* ── Single-column form (password card) ──────────────────────────────── */
.prof-form-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Label style ──────────────────────────────────────────────────────── */
.prof-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}
.prof-label input {
  font-size: 15px;
  width: 100%;
}

/* ── Submit row ───────────────────────────────────────────────────────── */
.prof-submit-row {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* ── Save button ──────────────────────────────────────────────────────── */
.prof-btn-save {
  padding: 13px 32px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #04210d;
  background: linear-gradient(135deg, #4ade80 0%, #22d3ee 50%, #a855f7 100%);
  background-size: 200% 200%;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(74, 222, 128, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: transform 0.15s ease, box-shadow 0.2s ease, background-position 0.5s ease;
}
.prof-btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  background-position: 100% 0%;
  box-shadow: 0 14px 34px rgba(74, 222, 128, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}
.prof-btn-save:active:not(:disabled) { transform: translateY(0); }
.prof-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Eye toggle (self-contained, mirrors Employees.tsx pattern) ───────── */
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

/* ── Passport-style upload button (reused class) ──────────────────────── */
.emp-passport-btn {
  flex: 1 1 auto;
  min-width: 140px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
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
.emp-passport-fname {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;
