import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, groupTasks, type Category, type GroupBy, type Task } from '../model';

function count(tasks: Task[]) {
  const c: Record<Category, number> = { NOT_STARTED: 0, IN_PROGRESS: 0, OVERDUE: 0, DONE: 0 };
  for (const t of tasks) c[t.category]++;
  return c;
}

function Legend() {
  return (
    <div className="legend">
      {CATEGORIES.map((c) => (
        <span key={c}>
          <b style={{ background: CATEGORY_COLOR[c] }} />
          {CATEGORY_LABEL[c]}
        </span>
      ))}
    </div>
  );
}

function Donut({ tasks }: { tasks: Task[] }) {
  const c = count(tasks);
  const total = tasks.length || 1;
  const r = 80;
  const C = 2 * Math.PI * r;
  let off = 0;
  const remaining = tasks.length - c.DONE;
  return (
    <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Status-Verteilung">
      <g transform="rotate(-90 110 110)">
        {CATEGORIES.map((k) => {
          const len = (c[k] / total) * C;
          const el = (
            <circle
              key={k}
              cx="110"
              cy="110"
              r={r}
              fill="none"
              stroke={CATEGORY_COLOR[k]}
              strokeWidth="26"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
              strokeDashoffset={-off}
            >
              <title>{`${CATEGORY_LABEL[k]}: ${c[k]}`}</title>
            </circle>
          );
          off += len;
          return el;
        })}
      </g>
      <text x="110" y="106" textAnchor="middle" fontSize="38" fontWeight="700" fill="currentColor">
        {remaining}
      </text>
      <text x="110" y="126" textAnchor="middle" fontSize="12" fill="currentColor">
        Verbleibende
      </text>
      <text x="110" y="141" textAnchor="middle" fontSize="12" fill="currentColor">
        Aufgaben
      </text>
    </svg>
  );
}

function StackedBars({ tasks, by, height = 220 }: { tasks: Task[]; by: GroupBy; height?: number }) {
  const groups = groupTasks(tasks, by);
  const max = Math.max(1, ...groups.map((g) => g.tasks.length));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const barW = 34;
  const gap = 18;
  const left = 36; // Platz für die Y-Achsenwerte
  const offset = 22; // Abstand erste Säule zur Y-Achse
  const width = left + offset + groups.length * (barW + gap) + 4;
  const svgH = height + 90;
  // Skaliert auf die Kartenbreite; erst wenn die Schrift zu klein würde (< 75 %), wird gescrollt.
  return (
    <div className="barscroll">
      <svg
        viewBox={`0 0 ${width} ${svgH}`}
        style={{ width: '100%', maxWidth: width, minWidth: Math.round(width * 0.75), height: 'auto' }}
        role="img"
      >
        {Array.from({ length: top / step + 1 }, (_, i) => {
          const y = height - (i * step * height) / top + 10;
          return (
            <g key={i}>
              <line x1={left} x2={width} y1={y} y2={y} stroke="#e6e6e6" />
              <text x={left - 6} y={y + 4} fontSize="10" textAnchor="end" fill="#666">
                {i * step}
              </text>
            </g>
          );
        })}
        {groups.map((g, i) => {
          const c = count(g.tasks);
          let y = height + 10;
          const x = left + offset + i * (barW + gap);
          return (
            <g key={g.key}>
              {CATEGORIES.map((k) => {
                const h = (c[k] * height) / top;
                if (!h) return null;
                y -= h;
                return (
                  <rect key={k} x={x} y={y} width={barW} height={Math.max(h - 1.5, 1)} fill={CATEGORY_COLOR[k]}>
                    <title>{`${g.label} – ${CATEGORY_LABEL[k]}: ${c[k]}`}</title>
                  </rect>
                );
              })}
              <text
                x={x + barW / 2}
                y={height + 22}
                fontSize="11"
                textAnchor="end"
                fill="#333"
                transform={`rotate(-35 ${x + barW / 2} ${height + 22})`}
              >
                {g.label.length > 16 ? `${g.label.slice(0, 15)}…` : g.label}
                <title>{g.label}</title>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 5;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
}

export function Charts({ tasks }: { tasks: Task[] }) {
  const c = count(tasks);
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;
  return (
    <div className="charts">
      <div className="kpis">
        <div className="kpi">
          <div className="v">{tasks.length}</div>
          <div className="l">Aufgaben gesamt</div>
        </div>
        <div className="kpi">
          <div className="v">{c.NOT_STARTED + c.IN_PROGRESS}</div>
          <div className="l">Offen (im Plan)</div>
        </div>
        <div className="kpi">
          <div className="v late">{c.OVERDUE}</div>
          <div className="l">Überfällig</div>
        </div>
        <div className="kpi">
          <div className="v">{avg} %</div>
          <div className="l">Ø Fortschritt</div>
        </div>
      </div>
      <div className="chartrow">
        <div className="panel">
          <h3>Status</h3>
          <div className="center">
            <Donut tasks={tasks} />
          </div>
          <Legend />
        </div>
        <div className="panel">
          <h3>Bucket (WBS-Abschnitt)</h3>
          <StackedBars tasks={tasks} by="bucket" />
          <Legend />
        </div>
        <div className="panel">
          <h3>Fälligkeit</h3>
          <StackedBars tasks={tasks} by="due" />
          <Legend />
        </div>
      </div>
      <div className="panel">
        <h3>
          Zugewiesen zu <span className="muted">(koppla-Gewerk)</span>
        </h3>
        <StackedBars tasks={tasks} by="trade" height={180} />
        <Legend />
      </div>
    </div>
  );
}
