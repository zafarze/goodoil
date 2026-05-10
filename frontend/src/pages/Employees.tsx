import { useEffect, useState } from 'react';
import { api, type Employee, type Paginated, type Station } from '../api/client';

export default function Employees() {
  const [stations, setStations] = useState<Station[]>([]);
  const [list, setList] = useState<Employee[]>([]);
  const [form, setForm] = useState({ full_name: '', telegram_id: '', station: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<Paginated<Employee>>('/employees/');
    setList(res.data.results);
  };

  useEffect(() => {
    api.get<Paginated<Station>>('/stations/').then((r) => setStations(r.data.results));
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name || !form.telegram_id || !form.station) {
      setError('Заполните все поля.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/employees/', {
        full_name: form.full_name,
        telegram_id: Number(form.telegram_id),
        station: Number(form.station),
        is_active: true,
      });
      setForm({ full_name: '', telegram_id: '', station: '' });
      load();
    } catch (err: any) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (e: Employee) => {
    await api.patch(`/employees/${e.id}/`, { is_active: !e.is_active });
    load();
  };

  return (
    <div className="page">
      <h1>Сотрудники</h1>

      <form className="card form-grid" onSubmit={submit}>
        <h2>Добавить</h2>
        <label>ФИО<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label>Telegram ID<input type="number" value={form.telegram_id} onChange={(e) => setForm({ ...form, telegram_id: e.target.value })} /></label>
        <label>АЗС
          <select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
            <option value="">—</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {error && <div className="error span-2">{error}</div>}
        <div className="span-2"><button type="submit" disabled={saving}>{saving ? '...' : 'Добавить'}</button></div>
      </form>

      <div className="card">
        <h2>Список</h2>
        {list.length === 0 ? <p className="muted">Пока пусто.</p> : (
          <table className="table">
            <thead><tr><th>ФИО</th><th>Telegram ID</th><th>АЗС</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>{e.full_name}</td><td>{e.telegram_id}</td><td>{e.station_name}</td>
                  <td>
                    <span className={`badge badge-${e.is_active ? 'confirmed' : 'draft'}`}>
                      {e.is_active ? 'активен' : 'отключён'}
                    </span>
                  </td>
                  <td><button onClick={() => toggle(e)}>{e.is_active ? 'Отключить' : 'Включить'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
