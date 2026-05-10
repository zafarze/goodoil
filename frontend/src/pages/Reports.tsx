import { useEffect, useState } from 'react';
import { api, type DailyReport, type FuelType, type Paginated, type Station } from '../api/client';

export default function Reports() {
  const [stations, setStations] = useState<Station[]>([]);
  const [fuels, setFuels] = useState<FuelType[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [filters, setFilters] = useState({ station: '', fuel: '', date_from: '', date_to: '', status: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Station>>('/stations/'),
      api.get<Paginated<FuelType>>('/fuel-types/'),
    ]).then(([s, f]) => {
      setStations(s.data.results);
      setFuels(f.data.results);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.station) params.set('station', filters.station);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.status) params.set('status', filters.status);
    const res = await api.get<Paginated<DailyReport>>(`/reports/?${params}`);
    let data = res.data.results;
    if (filters.fuel) {
      data = data.filter((r) => r.items.some((i) => String(i.fuel_type) === filters.fuel));
    }
    setReports(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const confirm = async (id: number) => {
    await api.post(`/reports/${id}/confirm/`);
    load();
  };

  return (
    <div className="page">
      <h1>Отчёты</h1>

      <div className="card filters">
        <select value={filters.station} onChange={(e) => setFilters({ ...filters, station: e.target.value })}>
          <option value="">Все АЗС</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.fuel} onChange={(e) => setFilters({ ...filters, fuel: e.target.value })}>
          <option value="">Все типы топлива</option>
          {fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Любой статус</option>
          <option value="draft">Черновик</option>
          <option value="confirmed">Подтверждён</option>
        </select>
        <button onClick={load} disabled={loading}>{loading ? '...' : 'Применить'}</button>
      </div>

      <div className="card">
        {reports.length === 0 ? (
          <p className="muted">Отчётов нет.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th><th>АЗС</th><th>Сотрудник</th><th>Топливо</th>
                <th>Продано</th><th>Выручка</th><th>Остаток</th><th>Фото</th><th>Статус</th><th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) =>
                r.items.length ? r.items.map((it, idx) => (
                  <tr key={`${r.id}-${it.id}`}>
                    {idx === 0 && <td rowSpan={r.items.length}>{r.date}</td>}
                    {idx === 0 && <td rowSpan={r.items.length}>{r.station_name}</td>}
                    {idx === 0 && <td rowSpan={r.items.length}>{r.employee_name}</td>}
                    <td>{it.fuel_type_name}</td>
                    <td>{it.sold}</td>
                    <td>{it.revenue}</td>
                    <td>{it.remainder}</td>
                    {idx === 0 && (
                      <td rowSpan={r.items.length}>
                        {r.photo ? <a href={r.photo} target="_blank" rel="noreferrer">📷</a> : '—'}
                      </td>
                    )}
                    {idx === 0 && (
                      <td rowSpan={r.items.length}>
                        <span className={`badge badge-${r.status}`}>
                          {r.status === 'confirmed' ? 'Подтверждён' : 'Черновик'}
                        </span>
                      </td>
                    )}
                    {idx === 0 && (
                      <td rowSpan={r.items.length}>
                        {r.status === 'draft' && (
                          <button onClick={() => confirm(r.id)}>Подтвердить</button>
                        )}
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr key={r.id}>
                    <td>{r.date}</td><td>{r.station_name}</td><td>{r.employee_name}</td>
                    <td colSpan={4} className="muted">— нет позиций —</td>
                    <td>{r.photo ? <a href={r.photo}>📷</a> : '—'}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td></td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
