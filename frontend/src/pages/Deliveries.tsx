import { useEffect, useState } from 'react';
import { api, type Delivery, type FuelType, type Paginated, type Station } from '../api/client';

export default function Deliveries() {
  const [stations, setStations] = useState<Station[]>([]);
  const [fuels, setFuels] = useState<FuelType[]>([]);
  const [list, setList] = useState<Delivery[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, station: '', fuel_type: '', volume: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<Paginated<Delivery>>('/deliveries/');
    setList(res.data.results);
  };

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Station>>('/stations/'),
      api.get<Paginated<FuelType>>('/fuel-types/'),
    ]).then(([s, f]) => {
      setStations(s.data.results);
      setFuels(f.data.results);
    });
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.station || !form.fuel_type || !form.volume) {
      setError('Заполните АЗС, тип топлива и объём.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/deliveries/', {
        date: form.date,
        station: Number(form.station),
        fuel_type: Number(form.fuel_type),
        volume: form.volume,
        note: form.note,
      });
      setForm({ date: today, station: '', fuel_type: '', volume: '', note: '' });
      load();
    } catch (err: any) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h1>Склад / Привоз</h1>

      <form className="card form-grid" onSubmit={submit}>
        <h2>Оформить поступление</h2>
        <label>Дата<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>АЗС
          <select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
            <option value="">—</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Тип топлива
          <select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}>
            <option value="">—</option>
            {fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label>Объём<input type="number" step="0.01" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} /></label>
        <label className="span-2">Примечание<input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        {error && <div className="error span-2">{error}</div>}
        <div className="span-2"><button type="submit" disabled={saving}>{saving ? '...' : 'Сохранить'}</button></div>
      </form>

      <div className="card">
        <h2>Поступления</h2>
        {list.length === 0 ? <p className="muted">Пока пусто.</p> : (
          <table className="table">
            <thead><tr><th>Дата</th><th>АЗС</th><th>Топливо</th><th>Объём</th><th>Примечание</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>{d.date}</td><td>{d.station_name}</td><td>{d.fuel_type_name}</td>
                  <td>{d.volume}</td><td>{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
