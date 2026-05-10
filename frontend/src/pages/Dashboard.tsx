import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  api,
  type DailyReport,
  type Delivery,
  type Employee,
  type Paginated,
  type Remainder,
  type Station,
} from '../api/client';
import { useTheme } from '../hooks/useTheme';

interface StationRemainders {
  station: Station;
  rows: Remainder[];
}

const FUEL_COLORS = ['#4ade80', '#60a5fa', '#facc15', '#f472b6', '#a78bfa'];

type BizType = 'azs' | 'cement';

export default function Dashboard() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationRem, setStationRem] = useState<StationRemainders[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState<BizType>(
    () => (localStorage.getItem('goodoil_biz') as BizType) || 'azs',
  );
  const switchBiz = (b: BizType) => {
    setBiz(b);
    localStorage.setItem('goodoil_biz', b);
  };
  const theme = useTheme();
  const isLight = theme === 'light';
  const gridStroke = isLight ? '#e2e8f0' : '#2a2f3a';
  const axisStroke = isLight ? '#64748b' : '#9ca3af';
  const tooltipStyle = isLight
    ? { background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', borderRadius: 10 }
    : { background: '#1f2430', border: '1px solid #2a2f3a', borderRadius: 10 };

  useEffect(() => {
    (async () => {
      try {
        const stRes = await api.get<Paginated<Station>>('/stations/');
        setStations(stRes.data.results);

        const remRes = await Promise.all(
          stRes.data.results.map(async (s) => ({
            station: s,
            rows: (await api.get<Remainder[]>(`/stations/${s.id}/remainders/`)).data,
          })),
        );
        setStationRem(remRes);

        const repRes = await api.get<Paginated<DailyReport>>('/reports/?status=confirmed');
        setReports(repRes.data.results);

        try {
          const dRes = await api.get<Paginated<Delivery>>('/deliveries/');
          setDeliveries(dRes.data.results);
        } catch { /* deliveries optional */ }

        try {
          const eRes = await api.get<Paginated<Employee>>('/employees/');
          setEmployees(eRes.data.results);
        } catch { /* employees optional */ }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const totalFuel = useMemo(
    () => stationRem.reduce((sum, sr) => sum + sr.rows.reduce((a, r) => a + Number(r.remainder), 0), 0),
    [stationRem],
  );

  const fuelByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const sr of stationRem) {
      for (const r of sr.rows) {
        m.set(r.fuel_type, (m.get(r.fuel_type) ?? 0) + Number(r.remainder));
      }
    }
    return [...m.entries()].map(([name, value], i) => ({
      name,
      value: Math.max(0, value),
      color: FUEL_COLORS[i % FUEL_COLORS.length],
    }));
  }, [stationRem]);

  const deliveredToday = useMemo(
    () => deliveries.filter((d) => d.date === todayIso).reduce((a, d) => a + Number(d.volume), 0),
    [deliveries, todayIso],
  );

  const soldWeek = useMemo(() => {
    let sum = 0;
    for (const r of reports) {
      if (r.date >= sevenDaysAgo) {
        for (const it of r.items) sum += Number(it.sold);
      }
    }
    return sum;
  }, [reports, sevenDaysAgo]);

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    for (const r of reports) {
      const bucket = byDate.get(r.date) ?? {};
      for (const it of r.items) {
        bucket[it.fuel_type_name] = (bucket[it.fuel_type_name] ?? 0) + Number(it.sold);
      }
      byDate.set(r.date, bucket);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, vals]) => ({ date: date.slice(5), ...vals }));
  }, [reports]);

  const fuelKeys = useMemo(() => {
    const s = new Set<string>();
    chartData.forEach((d) => Object.keys(d).forEach((k) => k !== 'date' && s.add(k)));
    return [...s];
  }, [chartData]);

  const trendPct = useMemo(() => {
    if (chartData.length < 4) return null;
    const half = Math.floor(chartData.length / 2);
    const sumOf = (rows: typeof chartData) =>
      rows.reduce((a, r) => a + Object.entries(r).reduce((x, [k, v]) => k === 'date' ? x : x + Number(v), 0), 0);
    const first = sumOf(chartData.slice(0, half));
    const last = sumOf(chartData.slice(half));
    if (first <= 0) return null;
    return Math.round(((last - first) / first) * 100);
  }, [chartData]);

  const totalOps = reports.reduce((a, r) => a + r.items.length, 0);
  const expectedReports = stations.length * 7;
  const reportPct = expectedReports > 0
    ? Math.min(100, Math.round((reports.filter((r) => r.date >= sevenDaysAgo).length / expectedReports) * 100))
    : 0;

  const kpis = [
    { color: 'cyan', label: 'Всего станций', value: stations.length, percent: 100, icon: '⛽' },
    { color: 'green', label: 'Топливо в наличии', value: totalFuel, unit: 'л', percent: clampPct(totalFuel / 50), icon: '🛢' },
    { color: 'purple', label: 'Привезено сегодня', value: deliveredToday, unit: 'л', percent: deliveredToday > 0 ? 100 : 0, icon: '🚚' },
    { color: 'orange', label: 'Продано за неделю', value: soldWeek, unit: 'л', percent: clampPct(soldWeek / 30), icon: '💰' },
    { color: 'pink', label: 'Сотрудников', value: employees.length, percent: employees.length > 0 ? 100 : 0, icon: '👥' },
    { color: 'blue', label: 'Отчётов за неделю', value: reports.filter((r) => r.date >= sevenDaysAgo).length, percent: reportPct, icon: '📋' },
  ] as const;

  if (loading) return <div className="page"><div className="dash-head"><h1 className="dash-h1">Дашборд</h1></div><p className="muted">Загрузка…</p></div>;

  return (
    <div className="page">
      <div className="dash-canvas">
      <div className="dash-head">
        <div>
          <h1 className="dash-h1">Панель управления</h1>
          <p className="dash-sub">
            {biz === 'azs' ? 'Обзор работы АЗС за сегодня' : 'Обзор продаж цемент-блока'}
          </p>
        </div>
        <div className="biz-toggle" role="group" aria-label="Тип бизнеса">
          <button
            type="button"
            className={'biz-opt' + (biz === 'azs' ? ' active' : '')}
            onClick={() => switchBiz('azs')}
          >
            <span className="biz-icon">⛽</span><span>АЗС</span>
          </button>
          <button
            type="button"
            className={'biz-opt' + (biz === 'cement' ? ' active' : '')}
            onClick={() => switchBiz('cement')}
          >
            <span className="biz-icon">🧱</span><span>Цемент-блок</span>
          </button>
        </div>
      </div>

      {biz === 'cement' ? (
        <CementBlock
          gridStroke={gridStroke}
          axisStroke={axisStroke}
          tooltipStyle={tooltipStyle}
        />
      ) : (<>

      <section className="kpi-grid">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      <section className="grid-2">
        {stationRem.map((sr) => (
          <div key={sr.station.id} className="card">
            <h2>{sr.station.name}</h2>
            {sr.rows.length === 0 ? (
              <p className="muted">Нет данных</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Топливо</th><th>Привоз</th><th>Продано</th><th>Остаток</th></tr>
                </thead>
                <tbody>
                  {sr.rows.map((r) => (
                    <tr key={r.fuel_type_id}>
                      <td>{r.fuel_type}</td>
                      <td>{r.delivered.toFixed(2)}</td>
                      <td>{r.sold.toFixed(2)}</td>
                      <td><b>{r.remainder.toFixed(2)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      <section className="dash-donut-grid">
        <div className="card">
          <div className="dash-chart-head">
            <div>
              <h2 style={{ marginBottom: 4 }}>Динамика продаж за 30 дней</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Всего операций: {totalOps}
              </p>
            </div>
            {trendPct !== null && (
              <span className={'dash-trend' + (trendPct >= 0 ? ' up' : ' down')}>
                {trendPct >= 0 ? '↗' : '↘'} {trendPct >= 0 ? '+' : ''}{trendPct}%
              </span>
            )}
          </div>
          {chartData.length === 0 ? (
            <p className="muted">Подтверждённых отчётов пока нет.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {fuelKeys.map((k, i) => {
                    const c = FUEL_COLORS[i % FUEL_COLORS.length];
                    return (
                      <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={12} />
                <YAxis stroke={axisStroke} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
                {fuelKeys.map((k, i) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={FUEL_COLORS[i % FUEL_COLORS.length]}
                    fill={`url(#grad-${i})`}
                    strokeWidth={2.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2>Сводка по топливу</h2>
          {fuelByType.length === 0 || totalFuel <= 0 ? (
            <p className="muted">Остатков пока нет.</p>
          ) : (
            <>
              <div className="dash-donut-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={fuelByType}
                      dataKey="value"
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {fuelByType.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-donut-center">
                  <div className="dash-donut-num">{Math.round(totalFuel).toLocaleString('ru-RU')}</div>
                  <div className="dash-donut-lbl">всего, л</div>
                </div>
              </div>
              <div className="dash-legend">
                {fuelByType.map((d) => (
                  <div key={d.name} className="dash-leg-row">
                    <span className="dash-leg-dot" style={{ background: d.color }} />
                    <span className="dash-leg-name">{d.name}</span>
                    <span className="dash-leg-val">{Math.round(d.value).toLocaleString('ru-RU')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      </>)}
      </div>
    </div>
  );
}

function clampPct(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

interface KpiProps {
  color: 'cyan' | 'green' | 'purple' | 'orange' | 'pink' | 'blue';
  label: string;
  value: number;
  unit?: string;
  percent: number;
  icon: string;
}

function KpiCard({ color, label, value, unit, percent, icon }: KpiProps) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {Number(value).toLocaleString('ru-RU')}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-bar">
        <div className="kpi-bar-fill" style={{ width: `${percent}%` }} />
        <div className="kpi-bar-pct">{percent}%</div>
      </div>
      <div className="kpi-icon" aria-hidden="true">{icon}</div>
    </div>
  );
}

interface CementProps {
  gridStroke: string;
  axisStroke: string;
  tooltipStyle: React.CSSProperties;
}

function CementBlock({ gridStroke, axisStroke, tooltipStyle }: CementProps) {
  const kpis: KpiProps[] = [
    { color: 'cyan',   label: 'Произведено сегодня', value: 3200,    unit: 'шт', percent: 80,  icon: '🏭' },
    { color: 'green',  label: 'Готовая продукция',   value: 18540,   unit: 'шт', percent: 92,  icon: '📦' },
    { color: 'purple', label: 'За неделю',           value: 21400,   unit: 'шт', percent: 75,  icon: '🧱' },
    { color: 'orange', label: 'Выручка месяца',      value: 4200000, unit: '₽',  percent: 88,  icon: '💰' },
    { color: 'pink',   label: 'Заказы в работе',     value: 12,                  percent: 60,  icon: '📋' },
    { color: 'blue',   label: 'Рабочих в смене',     value: 24,                  percent: 100, icon: '👷' },
  ];

  const workshops = [
    {
      name: 'Цех №1 — Пеноблок',
      rows: [
        { type: 'Пеноблок D500',  size: '600×300×200', produced: 1200, defect: 18, stock: 5400 },
        { type: 'Пеноблок D600',  size: '600×300×200', produced: 800,  defect: 12, stock: 3200 },
        { type: 'Газоблок',       size: '600×250×200', produced: 600,  defect: 9,  stock: 2800 },
      ],
    },
    {
      name: 'Цех №2 — Шлако/керамзит',
      rows: [
        { type: 'Шлакоблок',      size: '390×190×190', produced: 400,  defect: 6,  stock: 4200 },
        { type: 'Керамзитоблок',  size: '390×190×190', produced: 200,  defect: 3,  stock: 2940 },
      ],
    },
  ];

  const series = ['Пеноблок', 'Газоблок', 'Шлакоблок'];
  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: String(i + 1).padStart(2, '0'),
    'Пеноблок': 1000 + Math.round(Math.sin(i / 3) * 220 + i * 12),
    'Газоблок': 600  + Math.round(Math.cos(i / 4) * 150 + i * 7),
    'Шлакоблок': 400 + Math.round(Math.sin(i / 5) * 110 + i * 5),
  }));

  const donut = [
    { name: 'Пеноблок D500',  value: 5400, color: '#4ade80' },
    { name: 'Пеноблок D600',  value: 3200, color: '#60a5fa' },
    { name: 'Газоблок',       value: 2800, color: '#facc15' },
    { name: 'Шлакоблок',      value: 4200, color: '#f472b6' },
    { name: 'Керамзитоблок',  value: 2940, color: '#a78bfa' },
  ];
  const totalStock = donut.reduce((a, d) => a + d.value, 0);

  const raw = [
    { icon: '🪨', name: 'Цемент М500',     value: 42.5, unit: 'т',  pct: 70, color: '#4ade80' },
    { icon: '🏖', name: 'Песок',            value: 128,  unit: 'т',  pct: 85, color: '#facc15' },
    { icon: '⚪', name: 'Пенообразователь', value: 320,  unit: 'л',  pct: 55, color: '#60a5fa' },
    { icon: '🧊', name: 'Керамзит',         value: 26,   unit: 'м³', pct: 40, color: '#a78bfa' },
    { icon: '📦', name: 'Поддоны',          value: 240,  unit: 'шт', pct: 78, color: '#f472b6' },
  ];

  const orders = [
    { id: '#1042', client: 'ООО «СтройГрад»', product: 'Пеноблок D500',  qty: '3 200 шт', deadline: '15.05.2026', status: 'in', label: 'В производстве' },
    { id: '#1043', client: 'Хайдаров Ш.',      product: 'Газоблок',        qty: '800 шт',   deadline: '12.05.2026', status: 'wait', label: 'Ожидает' },
    { id: '#1044', client: 'ИП «Бунёд»',       product: 'Шлакоблок',       qty: '4 500 шт', deadline: '20.05.2026', status: 'in', label: 'В производстве' },
    { id: '#1045', client: '«Узбекстрой»',     product: 'Керамзитоблок',   qty: '1 200 шт', deadline: '14.05.2026', status: 'wait', label: 'Ожидает' },
    { id: '#1046', client: 'ООО «ТАШ-БУНЁД»',  product: 'Пеноблок D600',   qty: '2 000 шт', deadline: '18.05.2026', status: 'in', label: 'В производстве' },
  ];

  const colors = ['#4ade80', '#60a5fa', '#facc15'];

  return (
    <>
      <section className="kpi-grid">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </section>

      <section className="grid-2">
        {workshops.map((w) => (
          <div key={w.name} className="card">
            <h2>{w.name}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Блок</th><th>Размер</th><th>Произв.</th><th>Брак</th><th>На складе</th>
                </tr>
              </thead>
              <tbody>
                {w.rows.map((r) => (
                  <tr key={r.type}>
                    <td>{r.type}</td>
                    <td className="muted">{r.size}</td>
                    <td>{r.produced.toLocaleString('ru-RU')}</td>
                    <td><span className="cement-defect">{r.defect}</span></td>
                    <td><b>{r.stock.toLocaleString('ru-RU')}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="dash-donut-grid">
        <div className="card">
          <div className="dash-chart-head">
            <div>
              <h2 style={{ marginBottom: 4 }}>Производство за 30 дней</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Всего произведено: 21 400 шт
              </p>
            </div>
            <span className="dash-trend up">↗ +18%</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {series.map((k, i) => (
                  <linearGradient key={k} id={`cgrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[i]} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={colors[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" stroke={axisStroke} fontSize={12} />
              <YAxis stroke={axisStroke} fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
              {series.map((k, i) => (
                <Area key={k} type="monotone" dataKey={k}
                      stroke={colors[i]} fill={`url(#cgrad-${i})`} strokeWidth={2.5} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Склад готовой продукции</h2>
          <div className="dash-donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={70} outerRadius={95} paddingAngle={3} stroke="none">
                  {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="dash-donut-center">
              <div className="dash-donut-num">{totalStock.toLocaleString('ru-RU')}</div>
              <div className="dash-donut-lbl">всего, шт</div>
            </div>
          </div>
          <div className="dash-legend">
            {donut.map((d) => (
              <div key={d.name} className="dash-leg-row">
                <span className="dash-leg-dot" style={{ background: d.color }} />
                <span className="dash-leg-name">{d.name}</span>
                <span className="dash-leg-val">{d.value.toLocaleString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Сырьё на складе</h2>
        <div className="cement-raw-grid">
          {raw.map((r) => (
            <div key={r.name} className="raw-item">
              <span className="raw-icon" aria-hidden="true">{r.icon}</span>
              <div className="raw-body">
                <div className="raw-name">{r.name}</div>
                <div className="raw-val">
                  {r.value.toLocaleString('ru-RU')} <small>{r.unit}</small>
                </div>
                <div className="raw-bar">
                  <div className="raw-bar-fill" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Активные заказы</h2>
        <table className="table">
          <thead>
            <tr><th>№</th><th>Заказчик</th><th>Продукция</th><th>Кол-во</th><th>Срок</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><b>{o.id}</b></td>
                <td>{o.client}</td>
                <td>{o.product}</td>
                <td>{o.qty}</td>
                <td className="muted">{o.deadline}</td>
                <td>
                  <span className={'badge ' + (o.status === 'in' ? 'badge-confirmed' : 'badge-draft')}>
                    {o.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
